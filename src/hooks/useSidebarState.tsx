import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "sidebar-collapsed";

/**
 * Controla o estado do sidebar:
 * - collapsed: modo slim (só ícones) no desktop, persistido em localStorage
 * - mobileOpen: drawer off-canvas no mobile (não persiste)
 */
export function useSidebarState() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => setCollapsed(c => !c), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile };
}
