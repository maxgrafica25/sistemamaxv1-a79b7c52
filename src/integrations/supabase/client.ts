import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Por enquanto, desativamos o redirecionamento para o rest-proxy para diagnosticar
 * se o erro 'Failed to fetch' é causado por limitações de rede ou pela Edge Function.
 * Chamadas REST voltarão a ser diretas temporariamente.
 */
const customFetch = async (url: string, options: RequestInit = {}) => {
  // Chamada direta para o Supabase REST
  return fetch(url, options);
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: customFetch,
  },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
