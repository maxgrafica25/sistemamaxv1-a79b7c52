import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Custom fetch to redirect ONLY REST calls to the proxy
const customFetch = async (url: string, options: RequestInit = {}) => {
  const restUrl = `${SUPABASE_URL}/rest/v1/`;
  
  // Only redirect if it's a REST API call
  if (url.startsWith(restUrl)) {
    const proxyUrl = `${SUPABASE_URL}/functions/v1/rest-proxy/`;
    const finalUrl = url.replace(restUrl, proxyUrl);
    return fetch(finalUrl, options);
  }
  
  // For all other calls (auth, storage, etc.), use default fetch
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
