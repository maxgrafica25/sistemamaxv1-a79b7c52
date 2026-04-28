import { useEffect } from "react";
import { trackEvent } from "./tracking";

/**
 * Dispara `scroll_depth` UMA ÚNICA vez por sessão, quando o usuário
 * chega a >= 90% do scroll da página. Listener com passive: true.
 */
export function useScrollDepthTracking(quoteId: string | undefined) {
  useEffect(() => {
    if (!quoteId) return;

    const key = `qv2_scroll_${quoteId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* ignore */
    }

    let fired = false;
    const onScroll = () => {
      if (fired) return;
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = total > 0 ? (scrolled / total) * 100 : 0;
      if (pct >= 90) {
        fired = true;
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
        void trackEvent(quoteId, "scroll_depth", { scroll_pct: Math.round(pct) });
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Dispara uma checagem inicial caso o conteúdo seja curto e já esteja "no fim"
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, [quoteId]);
}
