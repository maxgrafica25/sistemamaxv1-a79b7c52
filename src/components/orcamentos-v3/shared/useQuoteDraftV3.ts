import { useEffect, useRef, useState } from "react";

const KEY = "quote-draft-v3:novo";
const VERSION = 1;
const TTL_DAYS = 7;
const DEBOUNCE_MS = 800;

interface Envelope<T> {
  version: number;
  savedAt: string;
  data: T;
}

function safeRead<T>(): Envelope<T> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (parsed.version !== VERSION) return null;
    const ageMs = Date.now() - Date.parse(parsed.savedAt);
    if (ageMs > TTL_DAYS * 86_400_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useQuoteDraftV3<T>(state: T, enabled = true) {
  const [hydrated, setHydrated] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const first = useRef(true);
  const hydratedOnce = useRef(false);

  useEffect(() => {
    if (hydratedOnce.current) return;
    hydratedOnce.current = true;
    const env = safeRead<T>();
    if (env) {
      setHydrated(env.data);
      setSavedAt(env.savedAt);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      try {
        const env: Envelope<T> = {
          version: VERSION,
          savedAt: new Date().toISOString(),
          data: state,
        };
        window.localStorage.setItem(KEY, JSON.stringify(env));
        setSavedAt(env.savedAt);
      } catch {
        /* quota */
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [state, enabled]);

  const clear = () => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
    setSavedAt(null);
  };

  return { hydrated, savedAt, clear };
}
