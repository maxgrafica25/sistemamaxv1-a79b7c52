import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Custom fetch to redirect REST calls to the proxy
const customFetch = async (url: string, options: RequestInit = {}) => {
  // Determine the correct REST endpoint URL
  const restUrl = `${SUPABASE_URL}/rest/v1/`;
  
  if (url.startsWith(restUrl)) {
    // Redirect to rest-proxy edge function
    const proxyUrl = `${SUPABASE_URL}/functions/v1/rest-proxy/`;
    const finalUrl = url.replace(restUrl, proxyUrl);
    console.debug('Redirecting REST call to proxy:', finalUrl);
    return fetch(finalUrl, options);
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
