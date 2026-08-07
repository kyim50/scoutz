import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * SecureStore-backed session storage.
 *
 * The session contains a refresh token that is valid for far longer than the
 * access token, so it belongs in the keychain rather than AsyncStorage (which
 * is plain unencrypted files on disk). SecureStore rejects values over 2048
 * bytes, so oversized payloads fall back to AsyncStorage rather than failing
 * the sign-in outright.
 */
const secureStorage = {
  getItem: async (key: string) => {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) return value;
    } catch {
      // fall through to AsyncStorage
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (value.length <= 2048) {
      try {
        await SecureStore.setItemAsync(key, value);
        await AsyncStorage.removeItem(key).catch(() => {});
        return;
      } catch {
        // fall through to AsyncStorage
      }
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    await Promise.all([
      SecureStore.deleteItemAsync(key).catch(() => {}),
      AsyncStorage.removeItem(key).catch(() => {}),
    ]);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Web has no SecureStore; supabase-js falls back to its own web storage.
    storage: Platform.OS === 'web' ? undefined : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Current access token, refreshing it first if it is close to expiry.
 *
 * Callers that hold a long-lived connection (the Socket.IO hooks) must call
 * this on every connect attempt rather than capturing a token once — a token
 * captured at mount is dead an hour later and every reconnect then fails.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Deep-link target for password reset and email confirmation. */
export function getSupabaseRedirectUrl(): string {
  const hosted = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL ?? '';
  if (hosted && hosted.startsWith('http')) return hosted.trim();
  return 'cite://auth/callback';
}
