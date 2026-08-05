import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { authAPI, userAPI, setOnSessionExpired } from '../services/api';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  school?: string;
  major?: string;
  bio?: string;
  avatarUrl?: string;
  reputationScore?: number;
  pinsCreated?: number;
  eventsCreated?: number;
  streak?: number;
}

interface SignupResult {
  /** True when the Supabase project requires email confirmation before sign-in. */
  requiresEmailConfirmation: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, username?: string) => Promise<SignupResult>;
  forgotPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  toggleAnonymous: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Last known profile, so a cold start without network keeps the user signed in. */
const CACHED_USER_KEY = 'cachedUser';

async function cacheUser(user: User | null) {
  if (!user) {
    await SecureStore.deleteItemAsync(CACHED_USER_KEY).catch(() => {});
    return;
  }
  await SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(user)).catch(() => {});
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  // Guards against a late in-flight profile fetch resurrecting a signed-out user.
  const signedOutRef = useRef(false);

  /** Fetch the app profile for the current Supabase session. */
  const loadProfile = useCallback(async (): Promise<User | null> => {
    const response = await authAPI.getCurrentUser();
    if (!response.success) return null;
    return response.data as User;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          await cacheUser(null);
          return;
        }

        // Hydrate from cache first so a cold start with no network keeps the
        // user signed in instead of bouncing them to Welcome.
        const cached = await SecureStore.getItemAsync(CACHED_USER_KEY).catch(() => null);
        if (cached && !cancelled) {
          try {
            setUser(JSON.parse(cached));
          } catch {
            await cacheUser(null);
          }
        }

        const profile = await loadProfile();
        if (profile && !cancelled && !signedOutRef.current) {
          setUser(profile);
          await cacheUser(profile);
        }
      } catch (error) {
        // A 401 means the session is genuinely dead. Anything else (offline,
        // server down) leaves the cached user in place.
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          if (!cancelled) setUser(null);
          await cacheUser(null);
        } else {
          console.warn('Could not refresh profile, using cached session:', error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  // Supabase drives session state: a refresh failure or a sign-out on another
  // device lands here, so React state can never disagree with the real session.
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        await cacheUser(null);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      void cacheUser(null);
    });
    return () => setOnSessionExpired(null);
  }, []);

  useEffect(() => {
    SecureStore.getItemAsync('anonymousMode')
      .then((value) => {
        if (value === 'true') setIsAnonymous(true);
      })
      .catch(() => {});
  }, []);

  const toggleAnonymous = useCallback(() => {
    setIsAnonymous((prev) => {
      const next = !prev;
      SecureStore.setItemAsync('anonymousMode', next ? 'true' : 'false').catch(() => {});
      return next;
    });
  }, []);

  /** Hand the server-issued Supabase session to supabase-js so it manages refresh. */
  const adoptSession = async (session: { access_token: string; refresh_token: string }) => {
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) throw new Error('Could not start your session. Please try again.');
  };

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const response = await authAPI.login({ identifier, password });
      if (!response.success) throw new Error(response.error?.message || 'Login failed');

      signedOutRef.current = false;
      await adoptSession(response.data.session);
      setUser(response.data.user);
      await cacheUser(response.data.user);
    } catch (error) {
      throw toAuthError(error, 'Login failed');
    }
  }, []);

  const signup = useCallback(
    async (email: string, password: string, name: string, username?: string): Promise<SignupResult> => {
      try {
        const response = await authAPI.signup({ email, password, name, username });
        if (!response.success) throw new Error(response.error?.message || 'Signup failed');

        if (response.data?.requiresEmailConfirmation) {
          return { requiresEmailConfirmation: true };
        }

        signedOutRef.current = false;
        await adoptSession(response.data.session);
        setUser(response.data.user);
        await cacheUser(response.data.user);
        return { requiresEmailConfirmation: false };
      } catch (error) {
        throw toAuthError(error, 'Signup failed');
      }
    },
    []
  );

  const forgotPassword = useCallback(async (email: string) => {
    try {
      await authAPI.forgotPassword(email);
    } catch (error) {
      throw toAuthError(error, 'Could not send the reset email');
    }
  }, []);

  const logout = useCallback(async () => {
    signedOutRef.current = true;
    try {
      await authAPI.logout();
    } finally {
      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      await cacheUser(null);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    signedOutRef.current = true;
    try {
      await userAPI.deleteAccount();
    } finally {
      // Clear the session either way: staying signed in with tokens for a
      // deleted account is worse than surfacing the error.
      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      await cacheUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await loadProfile();
      if (profile && !signedOutRef.current) {
        setUser(profile);
        await cacheUser(profile);
      }
    } catch (error) {
      console.warn('Error refreshing user:', error);
    }
  }, [loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        forgotPassword,
        logout,
        deleteAccount,
        refreshUser,
        isAuthenticated: !!user,
        isAnonymous,
        toggleAnonymous,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/** Turn an axios failure into something worth showing a user. */
function toAuthError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error?.message;
    if (message) return new Error(message);
    if (!error.response) {
      return new Error('Unable to reach the server. Check your connection and try again.');
    }
  }
  return error instanceof Error ? error : new Error(fallback);
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
