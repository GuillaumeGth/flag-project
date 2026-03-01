import React, { createContext, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { File } from 'expo-file-system/next';
import { decode } from 'base64-arraybuffer';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, supabaseReady } from '@/services/supabase';
import { registerPushToken, unregisterPushToken } from '@/services/notifications';
import { clearAllCache } from '@/services/cache';
import { reportError } from '@/services/errorReporting';
import { log } from '@/utils/debug';
import { User, AuthState } from '@/types';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType extends AuthState {
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateAvatar: (imageUri: string) => Promise<{ error: Error | null }>;
  updateDisplayName: (displayName: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  const setSessionAndUpdateState = async (accessToken: string, refreshToken: string) => {
    log('AuthContext', 'setSessionAndUpdateState: START');
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        log('AuthContext', 'setSessionAndUpdateState: ERROR', error.message);
        return { error };
      }

      log('AuthContext', 'setSessionAndUpdateState: session set, userId:', data.user?.id);

      // Wait for Supabase client initialization to complete before allowing screens to mount
      // This ensures getSession() won't hang in data-fetching functions
      // Use supabaseReady (plain promise) instead of getSession() to avoid deadlock
      log('AuthContext', 'setSessionAndUpdateState: waiting for supabaseReady...');
      await supabaseReady;
      log('AuthContext', 'setSessionAndUpdateState: supabaseReady resolved');

      // Force state update in case onAuthStateChange doesn't fire
      if (data.session) {
        log('AuthContext', 'setSessionAndUpdateState: forcing setState with user');
        setState((prev) => ({
          ...prev,
          session: data.session,
          user: data.user ? mapUser(data.user) : null,
          loading: false,
        }));
      }

      return { error: null };
    } catch (e) {
      log('AuthContext', 'setSessionAndUpdateState: EXCEPTION', e);
      reportError(e, 'auth.setSessionAndUpdateState');
      return { error: e as Error };
    }
  };

  const mapUser = (supabaseUser: SupabaseUser): User => ({
    id: supabaseUser.id,
    phone: supabaseUser.phone,
    email: supabaseUser.email,
    display_name: supabaseUser.user_metadata?.display_name || supabaseUser.user_metadata?.full_name,
    avatar_url: supabaseUser.user_metadata?.avatar_url,
    created_at: supabaseUser.created_at,
  });

  // Ensure user exists in public.users table (fallback if trigger doesn't work)
  const ensureUserInDatabase = async (authUser: SupabaseUser) => {
    if (!authUser?.id) {
      log('AuthContext', 'ensureUserInDatabase: No authUser.id');
      return;
    }

    log('AuthContext', 'ensureUserInDatabase: Checking user', authUser.id);

    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle();

    log('AuthContext', 'ensureUserInDatabase: existingUser=', existingUser, 'selectError=', selectError);

    if (!existingUser) {
      log('AuthContext', 'User not found in public.users, creating...');
      const { error } = await supabase.from('users').insert({
        id: authUser.id,
        email: authUser.email,
        phone: authUser.phone,
        display_name:
          authUser.user_metadata?.display_name ||
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url,
      });

      if (error) {
        log('AuthContext', 'Error creating user in public.users:', error);
      } else {
        log('AuthContext', 'User created in public.users successfully');
      }
    } else {
      log('AuthContext', 'User already exists in public.users');
    }
  };

  // Fetch avatar from public.users table (takes priority over Google avatar)
  const fetchUserAvatar = async (userId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();
    return data?.avatar_url || null;
  };

  // Update state with avatar from database
  const updateUserWithDbAvatar = async (userId: string) => {
    const dbAvatar = await fetchUserAvatar(userId);
    if (dbAvatar) {
      setState((prev) => ({
        ...prev,
        user: prev.user ? { ...prev.user, avatar_url: dbAvatar } : null,
      }));
    }
  };

  // Sync user profile with Google data if display_name is missing
  const syncUserProfile = async (authUser: SupabaseUser) => {
    if (!authUser?.id) return;

    const googleName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.user_metadata?.display_name;
    const googleAvatar = authUser.user_metadata?.avatar_url;

    if (!googleName && !googleAvatar) return;

    // Check current profile in database
    const { data: profile } = await supabase
      .from('users')
      .select('display_name, avatar_url')
      .eq('id', authUser.id)
      .single();

    // Update if display_name or avatar_url is missing
    const updates: { display_name?: string; avatar_url?: string } = {};

    if (!profile?.display_name && googleName) {
      updates.display_name = googleName;
    }
    if (!profile?.avatar_url && googleAvatar) {
      updates.avatar_url = googleAvatar;
    }

    if (Object.keys(updates).length > 0) {
      log('AuthContext', 'Syncing user profile with Google data:', updates);
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', authUser.id);

      if (error) {
        log('AuthContext', 'Error syncing profile:', error);
      } else {
        // Update local state with the new data
        setState((prev) => ({
          ...prev,
          user: prev.user
            ? {
                ...prev.user,
                display_name: updates.display_name || prev.user.display_name,
                avatar_url: updates.avatar_url || prev.user.avatar_url,
              }
            : null,
        }));
      }
    }
  };

  useEffect(() => {
    // Safety timeout: if auth initialization doesn't complete in 10s (e.g. network
    // hung on expired-token refresh), unblock the UI so the user isn't stuck on a
    // loading screen forever.
    const loadingTimeout = setTimeout(() => {
      setState((prev) => {
        if (prev.loading) {
          log('AuthContext', 'Loading timeout reached, forcing loading=false');
          return { ...prev, loading: false };
        }
        return prev;
      });
    }, 10000);

    // Handle deep link for OAuth callback
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      log('AuthContext', '=== DEEP LINK EVENT ===', url);

      if (url.includes('auth/callback') || url.includes('auth%2Fcallback')) {
        let accessToken: string | null = null;
        let refreshToken: string | null = null;
        let code: string | null = null;

        // Try to extract tokens from hash fragment
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1) {
          const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
          log('AuthContext', 'Deep link hash - access:', !!accessToken, 'refresh:', !!refreshToken);
        }

        // Try to extract from query params
        const queryIndex = url.indexOf('?');
        if (queryIndex !== -1) {
          const queryEnd = hashIndex !== -1 ? hashIndex : url.length;
          const queryString = url.substring(queryIndex + 1, queryEnd);
          const queryParams = new URLSearchParams(queryString);
          code = queryParams.get('code');
          if (!accessToken) accessToken = queryParams.get('access_token');
          if (!refreshToken) refreshToken = queryParams.get('refresh_token');
          log('AuthContext', 'Deep link query - code:', !!code, 'access:', !!accessToken, 'refresh:', !!refreshToken);
        }

        if (accessToken && refreshToken) {
          await setSessionAndUpdateState(accessToken, refreshToken);
        } else if (code) {
          log('AuthContext', 'Exchanging code from deep link');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            log('AuthContext', 'Error exchanging code:', error.message);
          }
        }
      }
    };

    // Check for initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is running
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      log('AuthContext', 'onAuthStateChange:', _event, 'hasSession:', !!session, 'userId:', session?.user?.id);

      // Wait for Supabase client to be fully initialized before updating state.
      // Use supabaseReady (plain promise) instead of getSession() to avoid deadlock.
      // getSession() acquires an internal lock that's already held during event firing.
      log('AuthContext', 'Waiting for supabaseReady...');
      await supabaseReady;
      log('AuthContext', 'supabaseReady resolved, proceeding with:', _event);

      // On explicit sign out, clear everything
      if (_event === 'SIGNED_OUT') {
        log('AuthContext', 'SIGNED_OUT -> clearing state');
        setState({ user: null, session: null, loading: false });
        return;
      }

      // If we have a valid session, update state and run post-login setup
      if (session?.user) {
        const mappedUser = mapUser(session.user);
        log('AuthContext', 'Setting user:', mappedUser.id, 'event:', _event);
        setState((prev) => ({
          ...prev,
          session,
          user: mappedUser,
          loading: false,
        }));

        if (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') {
          log('AuthContext', 'Running post-login setup for:', _event);
          // All post-login operations are fire-and-forget to avoid deadlock.
          // Supabase queries internally call getSession() which would deadlock
          // if awaited inside onAuthStateChange (the auth lock is held).
          ensureUserInDatabase(session.user).catch((e) => log('AuthContext', 'ensureUserInDatabase error:', e));
          syncUserProfile(session.user).catch((e) => log('AuthContext', 'Sync profile error:', e));
          updateUserWithDbAvatar(mappedUser.id).catch((e) => log('AuthContext', 'Update avatar error:', e));
          registerPushToken(mappedUser.id).catch((e) => log('AuthContext', 'Register push token error:', e));
        }
        return;
      }

      // No session: only update loading state on INITIAL_SESSION (no stored session)
      // Never reset user to null from other events (prevents race condition)
      if (_event === 'INITIAL_SESSION') {
        log('AuthContext', 'INITIAL_SESSION with no session -> setting loading=false');
        setState((prev) => ({ ...prev, loading: false }));
      } else {
        log('AuthContext', 'Ignoring event with no session:', _event);
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  const signInWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });
    return { error: error as Error | null };
  };

  const verifyOtp = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = 'flag://auth/callback';
      log('AuthContext', '=== GOOGLE AUTH START ===');
      log('AuthContext', 'Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned');

      log('AuthContext', 'OAuth URL:', data.url);

      // Use openAuthSessionAsync with flag:// prefix to capture any flag:// redirect
      const result = await WebBrowser.openAuthSessionAsync(data.url, 'flag://');

      log('AuthContext', '=== AUTH DEBUG ===');
      log('AuthContext', 'Result type:', result.type);

      if (result.type === 'success' && result.url) {
        log('AuthContext', 'Full URL:', result.url);

        // Check for error in URL first
        const urlObj = new URL(result.url);
        const errorParam = urlObj.searchParams.get('error') || urlObj.hash.includes('error=');
        const errorDescription = urlObj.searchParams.get('error_description');

        if (errorParam && errorDescription) {
          const decodedError = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
          log('AuthContext', 'Auth error from Supabase:', decodedError);
          throw new Error(decodedError);
        }

        // Parse URL to extract tokens or code
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        // Try to extract from hash fragment
        const hashIndex = result.url.indexOf('#');
        if (hashIndex !== -1) {
          const hashParams = new URLSearchParams(result.url.substring(hashIndex + 1));
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
          log('AuthContext', 'Hash params - access:', !!accessToken, 'refresh:', !!refreshToken);
        }

        if (accessToken && refreshToken) {
          log('AuthContext', 'Setting session with tokens');
          const { error: sessionError } = await setSessionAndUpdateState(accessToken, refreshToken);
          return { error: sessionError };
        }

        // Tokens not in URL, let deep link listener handle it
        log('AuthContext', 'No tokens in result URL, checking deep link listener...');
      }

      if (result.type === 'cancel') {
        log('AuthContext', 'User cancelled authentication');
      }

      return { error: null };
    } catch (error) {
      log('AuthContext', 'Google sign in error:', error);
      reportError(error, 'auth.signInWithGoogle');
      return { error: error as Error };
    }
  };

  const updateAvatar = async (imageUri: string): Promise<{ error: Error | null }> => {
    try {
      if (!state.user?.id) {
        throw new Error('User not authenticated');
      }

      // Get file extension
      const fileExt = imageUri.split('.').pop()?.toLowerCase()?.split('?')[0] || 'jpg';
      const fileName = `${state.user.id}/${Date.now()}.${fileExt}`;
      const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

      // Read file as base64 using expo-file-system new API
      const file = new File(imageUri);
      const base64 = await file.base64();

      // Convert base64 to ArrayBuffer
      const arrayBuffer = decode(base64);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      // Update user metadata in auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl },
      });

      if (updateError) {
        throw updateError;
      }

      // Also update the public.users table
      const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', state.user.id);

      if (dbError) {
        log('AuthContext', 'Error updating users table:', dbError);
      }

      // Update local state
      setState((prev) => ({
        ...prev,
        user: prev.user ? { ...prev.user, avatar_url: avatarUrl } : null,
      }));

      return { error: null };
    } catch (error) {
      log('AuthContext', 'Update avatar error:', error);
      reportError(error, 'auth.updateAvatar');
      return { error: error as Error };
    }
  };

  const updateDisplayName = async (displayName: string): Promise<{ error: Error | null }> => {
    try {
      if (!state.user?.id) {
        throw new Error('User not authenticated');
      }

      // Update in public.users table
      const { error: dbError } = await supabase
        .from('users')
        .update({ display_name: displayName })
        .eq('id', state.user.id);

      if (dbError) {
        throw dbError;
      }

      // Update user metadata in auth
      await supabase.auth.updateUser({
        data: { display_name: displayName },
      });

      // Update local state
      setState((prev) => ({
        ...prev,
        user: prev.user ? { ...prev.user, display_name: displayName } : null,
      }));

      return { error: null };
    } catch (error) {
      log('AuthContext', 'Update display name error:', error);
      reportError(error, 'auth.updateDisplayName');
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    // Unregister push token before signing out
    if (state.user?.id) {
      await unregisterPushToken(state.user.id).catch((e) =>
        log('AuthContext', 'Unregister push token error:', e)
      );
    }
    // Clear local data cache
    await clearAllCache();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithPhone,
        verifyOtp,
        signInWithGoogle,
        signOut,
        updateAvatar,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
