import { Outlet } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import NotificationBell from "./NotificationBell";
import Sidebar from "./Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useCommandPalette } from "@/hooks/useCommandPalette";

export default function Layout() {
  const { profile } = useAuth();
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState();
  const { setOpen: setPaletteOpen } = useCommandPalette();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar
        collapsed={collapsed}
        toggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        closeMobile={closeMobile}
      />

      <div className="flex-1 flex flex-col overflow-auto min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-3 py-2 md:px-6">
          {/* Hambúrguer (mobile) */}
          <button
            onClick={openMobile}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Botão "Buscar..." abre Command Palette */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="group flex flex-1 max-w-md items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Abrir paleta de comandos"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Buscar ou executar comando…</span>
            <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            {profile && (
              <span className="hidden sm:inline text-sm text-muted-foreground">
                {profile.display_name}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
