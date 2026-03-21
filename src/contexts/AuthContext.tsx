import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { AppState, AppStateStatus } from 'react-native';
import { File } from 'expo-file-system/next';
import { decode } from 'base64-arraybuffer';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { registerPushToken, unregisterPushToken } from '@/services/notifications';
import { clearAllCache } from '@/services/cache';
import { subscribeToUserProfileChanges } from '@/services/messages';
import { reportError, setUserContext } from '@/services/errorReporting';
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

  // Ref to track current state inside async callbacks without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  // Prevents handleDeepLink from racing with signInWithGoogle on the same callback URL
  const googleAuthActiveRef = useRef(false);

  const mapUser = (supabaseUser: SupabaseUser): User => ({
    id: supabaseUser.id,
    phone: supabaseUser.phone,
    email: supabaseUser.email,
    display_name: supabaseUser.user_metadata?.display_name || supabaseUser.user_metadata?.full_name,
    avatar_url: supabaseUser.user_metadata?.avatar_url,
    created_at: supabaseUser.created_at,
  });

  // Centralized helper: apply a Supabase session to React state + run post-login side effects
  const applySession = (session: Session, event?: string) => {
    const mappedUser = mapUser(session.user);
    log('AuthContext', 'applySession: userId:', mappedUser.id, 'event:', event);
    setUserContext(
      mappedUser.display_name ?? mappedUser.email ?? mappedUser.phone ?? null,
      null,
    );
    setState((prev) => ({
      ...prev,
      session,
      user: mappedUser,
      loading: false,
    }));
    return mappedUser;
  };

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

      // Force state update — don't rely only on onAuthStateChange
      if (data.session) {
        applySession(data.session, 'setSessionAndUpdateState');
      }

      return { error: null };
    } catch (e) {
      log('AuthContext', 'setSessionAndUpdateState: EXCEPTION', e);
      reportError(e, 'auth.setSessionAndUpdateState');
      return { error: e as Error };
    }
  };

  // Extract tokens or code from a callback URL
  const parseCallbackUrl = (url: string) => {
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let code: string | null = null;

    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
      accessToken = hashParams.get('access_token');
      refreshToken = hashParams.get('refresh_token');
    }

    const queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
      const queryEnd = hashIndex !== -1 ? hashIndex : url.length;
      const queryParams = new URLSearchParams(url.substring(queryIndex + 1, queryEnd));
      code = queryParams.get('code');
      if (!accessToken) accessToken = queryParams.get('access_token');
      if (!refreshToken) refreshToken = queryParams.get('refresh_token');
    }

    return { accessToken, refreshToken, code };
  };

  // Exchange tokens or code from a callback URL → session in state
  const processCallbackUrl = async (url: string, source: string): Promise<{ error: Error | null }> => {
    log('AuthContext', `processCallbackUrl [${source}]:`, url);
    const { accessToken, refreshToken, code } = parseCallbackUrl(url);
    log('AuthContext', `[${source}] tokens: access=${!!accessToken} refresh=${!!refreshToken} code=${!!code}`);

    if (accessToken && refreshToken) {
      return setSessionAndUpdateState(accessToken, refreshToken);
    }

    if (code) {
      log('AuthContext', `[${source}] Exchanging code for session`);
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        log('AuthContext', `[${source}] exchangeCodeForSession error:`, error.message);
        return { error: error as Error };
      }
      // exchangeCodeForSession fires onAuthStateChange, but as a safety net
      // also explicitly fetch and apply the session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        applySession(session, `${source}:codeExchange`);
      }
      return { error: null };
    }

    log('AuthContext', `[${source}] No tokens or code found in URL`);
    return { error: null };
  };

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

  // Fetch profile fields from public.users table (takes priority over auth metadata)
  const fetchUserProfile = async (userId: string): Promise<{ avatar_url: string | null; is_admin: boolean }> => {
    const { data } = await supabase
      .from('users')
      .select('avatar_url, is_admin')
      .eq('id', userId)
      .single();
    return { avatar_url: data?.avatar_url || null, is_admin: data?.is_admin ?? false };
  };

  // Update state with profile fields from database (avatar + is_admin)
  const updateUserWithDbProfile = async (userId: string) => {
    const { avatar_url, is_admin } = await fetchUserProfile(userId);
    setState((prev) => ({
      ...prev,
      user: prev.user
        ? { ...prev.user, ...(avatar_url ? { avatar_url } : {}), is_admin }
        : null,
    }));
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
    // Safety timeout: if auth initialization doesn't complete in 8s (e.g. network
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
    }, 8000);

    // Subscription to user profile changes — patches local caches in real-time
    // when any user updates their avatar or display name.
    let unsubscribeProfiles: (() => void) | null = null;

    // Post-login side effects (fire-and-forget to avoid deadlock with Supabase lock)
    const runPostLoginSetup = (session: Session) => {
      ensureUserInDatabase(session.user).catch((e) => log('AuthContext', 'ensureUserInDatabase error:', e));
      syncUserProfile(session.user).catch((e) => log('AuthContext', 'Sync profile error:', e));
      updateUserWithDbProfile(session.user.id).catch((e) => log('AuthContext', 'Update profile error:', e));
      registerPushToken(session.user.id).catch((e) => log('AuthContext', 'Register push token error:', e));

      if (!unsubscribeProfiles) {
        unsubscribeProfiles = subscribeToUserProfileChanges();
        log('AuthContext', 'Subscribed to user profile changes');
      }
    };

    // Handle deep link for OAuth callback — skipped if signInWithGoogle is active
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      log('AuthContext', '=== DEEP LINK EVENT ===', url);

      if (!url.includes('auth/callback') && !url.includes('auth%2Fcallback')) return;

      if (googleAuthActiveRef.current) {
        log('AuthContext', 'Deep link: googleAuth is active, skipping (signInWithGoogle will handle)');
        return;
      }

      await processCallbackUrl(url, 'deepLink');
    };

    // Check for initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // Listen for deep links while app is running
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      log('AuthContext', 'onAuthStateChange:', _event, 'hasSession:', !!session, 'userId:', session?.user?.id);

      // On explicit sign out, clear everything
      if (_event === 'SIGNED_OUT') {
        log('AuthContext', 'SIGNED_OUT -> clearing state');
        unsubscribeProfiles?.();
        unsubscribeProfiles = null;
        setUserContext(null, null);
        setState({ user: null, session: null, loading: false });
        return;
      }

      // If we have a valid session, update state and run post-login setup
      if (session?.user) {
        applySession(session, _event);

        if (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') {
          log('AuthContext', 'Running post-login setup for:', _event);
          runPostLoginSetup(session);
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

    // Session recovery on app foreground: if a valid session exists in storage
    // but React state lost it (e.g. after background kill / race condition),
    // restore it immediately.
    const appStateSubscription = AppState.addEventListener(
      'change',
      async (nextState: AppStateStatus) => {
        if (nextState !== 'active') return;

        const current = stateRef.current;
        // Only recover if we finished loading but have no user
        if (current.loading || current.user) return;

        log('AuthContext', 'App became active with no user, checking stored session...');
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            log('AuthContext', 'Session recovery: getSession error:', error.message);
            return;
          }
          if (session?.user) {
            log('AuthContext', 'Session recovery: found stored session, restoring user:', session.user.id);
            applySession(session, 'appStateRecovery');
            runPostLoginSetup(session);
          }
        } catch (e) {
          log('AuthContext', 'Session recovery: exception:', e);
        }
      },
    );

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      linkingSubscription.remove();
      appStateSubscription.remove();
      unsubscribeProfiles?.();
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

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned');

      log('AuthContext', 'OAuth URL obtained, opening browser');

      // Mark Google auth as active so handleDeepLink defers to us
      googleAuthActiveRef.current = true;

      // Safety timeout: prevents openAuthSessionAsync from hanging forever
      const dismissTimeout = setTimeout(() => {
        log('AuthContext', 'Safety timeout (60s): dismissing auth session');
        WebBrowser.dismissAuthSession();
      }, 60000);

      const result = await WebBrowser.openAuthSessionAsync(data.url, 'flag://');
      clearTimeout(dismissTimeout);

      log('AuthContext', 'Browser result type:', result.type);

      // ── SUCCESS: browser returned the callback URL ──
      if (result.type === 'success' && result.url) {
        log('AuthContext', 'Success URL received');

        // Check for OAuth error in URL
        try {
          const urlObj = new URL(result.url);
          const errorParam = urlObj.searchParams.get('error') || urlObj.hash.includes('error=');
          const errorDescription = urlObj.searchParams.get('error_description');
          if (errorParam && errorDescription) {
            const decoded = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
            log('AuthContext', 'OAuth error from Supabase:', decoded);
            throw new Error(decoded);
          }
        } catch (e) {
          if (e instanceof Error && e.message !== 'Invalid URL') throw e;
        }

        const { error: processError } = await processCallbackUrl(result.url, 'signInWithGoogle');
        if (processError) {
          // The callback URL processing failed, but the deep link handler
          // might have already established the session. Check before returning error.
          if (stateRef.current.user) {
            log('AuthContext', 'processCallbackUrl failed but user already set, continuing');
            return { error: null };
          }
          return { error: processError };
        }
        return { error: null };
      }

      // ── DISMISS / CANCEL: browser closed without returning a URL ──
      // On Android, the deep link often arrives separately. Since we blocked
      // handleDeepLink, we need to check for the session ourselves.
      if (result.type === 'cancel' || result.type === 'dismiss') {
        log('AuthContext', 'Browser dismissed — polling for session...');

        // Check if user was already set (e.g. onAuthStateChange fired from another path)
        if (stateRef.current.user) {
          log('AuthContext', 'User already authenticated after dismiss');
          return { error: null };
        }

        // Poll for session: the redirect intent may still be processing
        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 200));

          // Check React state first (fastest path)
          if (stateRef.current.user) {
            log('AuthContext', `User set during poll (attempt ${i + 1})`);
            return { error: null };
          }

          // Also check Supabase storage directly
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            log('AuthContext', `Session found in storage after dismiss (attempt ${i + 1})`);
            applySession(sessionData.session, 'dismissPoll');
            return { error: null };
          }
        }

        log('AuthContext', 'No session found after dismiss polling (5s), giving up');
      }

      return { error: null };
    } catch (error) {
      log('AuthContext', 'Google sign in error:', error);
      reportError(error, 'auth.signInWithGoogle');
      return { error: error as Error };
    } finally {
      googleAuthActiveRef.current = false;
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
