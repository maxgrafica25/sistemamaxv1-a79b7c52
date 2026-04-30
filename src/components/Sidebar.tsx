import { LayoutDashboard, Users, Package, Settings, Factory, Receipt, Calculator, Cpu, Shield, ClipboardList, MessageSquare, TrendingUp, BookOpen, PanelLeftClose, PanelLeftOpen, X, Layers, Megaphone, UserCog, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initialsOf(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

interface NavItem { name: string; href: string; icon: typeof LayoutDashboard; badge?: string; adminOnly?: boolean }

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Orçamentos", href: "/orcamentos", icon: ClipboardList },
  { name: "Orçamentos V2", href: "/orcamentos-v2", icon: ClipboardList, badge: "Beta" },
  { name: "Clientes/Fornecedores", href: "/cadastros", icon: Users },
  { name: "Matérias-Primas", href: "/materias-primas", icon: Package },
  { name: "Grupos de Materiais", href: "/grupos-materiais", icon: Layers },
  { name: "Comunicação Visual", href: "/cadastros-cv", icon: Megaphone, badge: "Novo" },
  { name: "Equipamentos", href: "/equipamentos", icon: Cpu },
  { name: "Processos de Produção", href: "/processos-producao", icon: Factory },
  { name: "Despesas Fixas", href: "/despesas-fixas", icon: Receipt },
  { name: "Preço Impressão", href: "/preco-impressao", icon: Calculator },
  { name: "Monitoramento", href: "/monitoramento", icon: TrendingUp },
  { name: "Catálogo Produtos", href: "/produtos", icon: BookOpen },
  { name: "Chat Interno", href: "/chat", icon: MessageSquare },
  { name: "Usuários", href: "/usuarios", icon: UserCog, adminOnly: true },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
  { name: "Auditoria", href: "/auditoria", icon: Shield },
];

interface SidebarProps {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  closeMobile: () => void;
}

export default function Sidebar({ collapsed, toggleCollapsed, mobileOpen, closeMobile }: SidebarProps) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "admin";
  const visibleNav = navigation.filter((i) => !i.adminOnly || isAdmin);

  const handleSignOut = async () => {
    closeMobile();
    await signOut();
    navigate("/auth", { replace: true });
  };
  return (
    <>
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-300 ease-in-out",
          // Desktop: largura controlada pelo collapsed
          "hidden md:flex md:relative md:h-auto",
          collapsed ? "md:w-16" : "md:w-64",
          // Mobile: drawer off-canvas
          "fixed inset-y-0 left-0 w-64",
          mobileOpen ? "flex translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Header / Logo */}
        <div className={cn(
          "flex h-16 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "justify-between px-5",
        )}>
          {collapsed ? (
            <span className="text-2xl font-bold text-sidebar-primary leading-none">O</span>
          ) : (
            <h1 className="text-lg font-bold tracking-tight text-sidebar-primary">OrçaGráfica</h1>
          )}
          {/* Botão fechar (só mobile) */}
          <button
            onClick={closeMobile}
            className="md:hidden rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent/50"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <TooltipProvider delayDuration={200}>
          <nav className={cn("flex-1 space-y-0.5 overflow-y-auto", collapsed ? "px-2 py-3" : "p-3")}>
            {visibleNav.map((item) => {
              const link = (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end={item.href === "/"}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center rounded-md text-sm font-medium transition-colors",
                      collapsed ? "h-10 w-10 mx-auto justify-center" : "gap-3 px-3 py-2",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground",
                    )
                  }
                  aria-label={item.name}
                >
                  {({ isActive }) => (
                    <>
                      {/* Barra vertical roxa do item ativo */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                      )}
                      <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-sidebar-primary")} />
                      {!collapsed && (
                        <span className="flex flex-1 items-center justify-between gap-2 min-w-0">
                          <span className="truncate">{item.name}</span>
                          {item.badge && (
                            <span className="shrink-0 rounded-full bg-sidebar-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sidebar-primary">
                              {item.badge}
                            </span>
                          )}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </nav>
        </TooltipProvider>

        {/* Footer: usuário + sair (todas as telas) + recolher (desktop) */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          {/* Bloco do usuário (expandido) */}
          {profile && !collapsed && (
            <div className="flex items-center gap-2 rounded-md px-2 py-2">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-sidebar-primary/15 text-sidebar-primary text-xs font-semibold">
                  {initialsOf(profile.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile.display_name}
                </div>
                <div className="text-[11px] text-sidebar-foreground/60 truncate">
                  {profile.role === "admin" ? "Administrador" : "Colaborador"}
                </div>
              </div>
            </div>
          )}

          {/* Botão Sair */}
          <TooltipProvider delayDuration={200}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSignOut}
                    className="flex h-10 w-10 mx-auto items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Sair"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Sair</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            )}
          </TooltipProvider>

          {/* Recolher (só desktop) */}
          <button
            onClick={toggleCollapsed}
            className={cn(
              "hidden md:flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground transition-colors",
              collapsed ? "w-10 justify-center mx-auto" : "w-full",
            )}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span>Recolher</span></>}
          </button>
        </div>
      </aside>
    </>
  );
}
