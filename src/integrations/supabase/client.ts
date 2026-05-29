import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Custom fetch to redirect REST calls to the proxy
const customFetch = async (url: string, options: RequestInit = {}) => {
  let finalUrl = url;
  
  // If the request is to the REST endpoint, redirect it to the proxy
  if (url.includes('/rest/v1/')) {
    finalUrl = url.replace('/rest/v1/', '/functions/v1/rest-proxy/');
    console.debug('Redirecting REST call to proxy:', finalUrl);
  }
  
  return fetch(finalUrl, options);
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
