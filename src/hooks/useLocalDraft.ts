import { useEffect, useRef, useState } from "react";

export type DraftError = "quota" | "unavailable" | null;

interface DraftEnvelope<T> {
  version: number;
  savedAt: string;
  data: T;
}

interface Options {
  version: number;
  debounceMs?: number;
  ttlDays?: number;
  enabled?: boolean;
}

const safeGet = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): DraftError => {
  try {
    window.localStorage.setItem(key, value);
    return null;
  } catch (e: any) {
    const name = e?.name || "";
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
      return "quota";
    }
    return "unavailable";
  }
};

const safeRemove = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
};

const parseEnvelope = <T,>(raw: string | null): DraftEnvelope<T> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.version === "number" &&
      typeof parsed.savedAt === "string" &&
      "data" in parsed
    ) {
      return parsed as DraftEnvelope<T>;
    }
    return null;
  } catch {
    return null;
  }
};

const isExpired = (savedAt: string, ttlDays?: number): boolean => {
  if (!ttlDays || ttlDays <= 0) return false;
  const ts = Date.parse(savedAt);
  if (Number.isNaN(ts)) return true;
  const ageMs = Date.now() - ts;
  return ageMs > ttlDays * 24 * 60 * 60 * 1000;
};

export function loadDraft<T>(
  key: string,
  expectedVersion: number,
  ttlDays?: number,
): { data: T; savedAt: string } | null {
  const env = parseEnvelope<T>(safeGet(key));
  if (!env) return null;
  if (env.version !== expectedVersion || isExpired(env.savedAt, ttlDays)) {
    safeRemove(key);
    return null;
  }
  return { data: env.data, savedAt: env.savedAt };
}

export function hasDraft(key: string, expectedVersion: number, ttlDays?: number): boolean {
  return loadDraft(key, expectedVersion, ttlDays) !== null;
}

export function clearDraft(key: string) {
  safeRemove(key);
}

export function useLocalDraft<T>(key: string, state: T, opts: Options) {
  const { version, debounceMs = 3000, ttlDays = 7, enabled = true } = opts;
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<DraftError>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    // Skip first run to avoid persisting initial mount state immediately.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const envelope: DraftEnvelope<T> = {
        version,
        savedAt: new Date().toISOString(),
        data: state,
      };
      let serialized: string;
      try {
        serialized = JSON.stringify(envelope);
      } catch {
        setError("unavailable");
        return;
      }
      const err = safeSet(key, serialized);
      setError(err);
      if (!err) setSavedAt(envelope.savedAt);
    }, debounceMs);
    return () => window.clearTimeout(handle);
  }, [key, state, version, debounceMs, enabled]);

  // Reset firstRun guard if the key changes (e.g., switching from new to edit).
  useEffect(() => {
    firstRun.current = true;
    setSavedAt(null);
    setError(null);
  }, [key]);

  return { savedAt, error };
}
