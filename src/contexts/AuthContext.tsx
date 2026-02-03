import React, { createContext, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/services/supabase';
import { User, AuthState } from '@/types';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType extends AuthState {
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateAvatar: (imageUri: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  const setSessionAndUpdateState = async (accessToken: string, refreshToken: string) => {
    console.log('=== SETTING SESSION ===');
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.log('Error setting session:', error.message);
        return { error };
      }

      console.log('Session set successfully, user:', data.user?.email);

      // Force state update in case onAuthStateChange doesn't fire
      if (data.session) {
        setState((prev) => ({
          ...prev,
          session: data.session,
          user: data.user ? mapUser(data.user) : null,
          loading: false,
        }));
      }

      return { error: null };
    } catch (e) {
      console.log('Exception setting session:', e);
      return { error: e as Error };
    }
  };

  const mapUser = (supabaseUser: any): User => ({
    id: supabaseUser.id,
    phone: supabaseUser.phone,
    email: supabaseUser.email,
    display_name: supabaseUser.user_metadata?.display_name || supabaseUser.user_metadata?.full_name,
    avatar_url: supabaseUser.user_metadata?.avatar_url,
    created_at: supabaseUser.created_at,
  });

  useEffect(() => {
    // Handle deep link for OAuth callback
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('=== DEEP LINK EVENT ===', url);

      if (url.includes('auth/callback')) {
        // Try to extract tokens from hash
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1) {
          const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          console.log('Tokens from deep link - access:', !!accessToken, 'refresh:', !!refreshToken);

          if (accessToken && refreshToken) {
            await setSessionAndUpdateState(accessToken, refreshToken);
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

    // Check current session with timeout
    const checkSession = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );

        const sessionPromise = supabase.auth.getSession();
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;

        setState((prev) => ({
          ...prev,
          session,
          user: session?.user ? mapUser(session.user) : null,
          loading: false,
        }));
      } catch (error) {
        console.log('Session check failed:', error);
        setState((prev) => ({
          ...prev,
          loading: false,
        }));
      }
    };

    checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event);
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ? mapUser(session.user) : null,
        loading: false,
      }));
    });

    return () => {
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
      // Use custom scheme for development builds
      const redirectUrl = 'flag://auth/callback';

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

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      console.log('=== AUTH DEBUG ===');
      console.log('Result type:', result.type);

      if (result.type === 'success' && result.url) {
        console.log('Full URL:', result.url);

        // Try to extract tokens from hash
        const urlParts = result.url.split('#');
        if (urlParts.length > 1) {
          const hashParams = new URLSearchParams(urlParts[1]);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          console.log('Access token found:', !!accessToken);
          console.log('Refresh token found:', !!refreshToken);

          if (accessToken && refreshToken) {
            const { error: sessionError } = await setSessionAndUpdateState(accessToken, refreshToken);
            return { error: sessionError };
          }
        }

        // Try query params (PKCE flow)
        const queryParts = result.url.split('?');
        if (queryParts.length > 1) {
          const queryParams = new URLSearchParams(queryParts[1].split('#')[0]);
          const code = queryParams.get('code');

          console.log('Auth code found:', !!code);

          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) throw exchangeError;
            return { error: null };
          }
        }

        // If we got here, no tokens found
        console.log('No tokens or code found in URL');
        throw new Error('Authentication failed - no tokens received');
      }

      return { error: null };
    } catch (error) {
      console.log('Google sign in error:', error);
      return { error: error as Error };
    }
  };

  const updateAvatar = async (imageUri: string): Promise<{ error: Error | null }> => {
    try {
      if (!state.user?.id) {
        throw new Error('User not authenticated');
      }

      // Fetch the image and convert to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Generate unique filename
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `${state.user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
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

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl },
      });

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setState((prev) => ({
        ...prev,
        user: prev.user ? { ...prev.user, avatar_url: avatarUrl } : null,
      }));

      return { error: null };
    } catch (error) {
      console.log('Update avatar error:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
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
