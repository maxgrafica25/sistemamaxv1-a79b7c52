import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Redireciona chamadas REST para a Edge Function de proxy por segurança.
 * Filtra para evitar que chamadas de Auth/Storage sejam interceptadas.
 */
const customFetch = async (url: string, options: RequestInit = {}) => {
  const restUrl = `${SUPABASE_URL}/rest/v1/`;
  
  if (url.startsWith(restUrl)) {
    const proxyUrl = `${SUPABASE_URL}/functions/v1/rest-proxy/`;
    const subPath = url.substring(restUrl.length);
    const finalUrl = `${proxyUrl}${subPath}`;
    
    console.log('[proxy-client] Redirecting:', subPath.split('?')[0]);
    
    try {
      const response = await fetch(finalUrl, options);
      return response;
    } catch (err) {
      console.error('[proxy-client] Network error:', err);
      throw err;
    }
  }
  
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
