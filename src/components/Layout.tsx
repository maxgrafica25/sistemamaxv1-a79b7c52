import { LayoutDashboard, Users, Package, Settings, Factory, Receipt, Calculator, Cpu, Shield, ClipboardList, MessageSquare, TrendingUp } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/hooks/useAuth";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Orçamentos", href: "/orcamentos", icon: ClipboardList },
  { name: "Clientes/Fornecedores", href: "/cadastros", icon: Users },
  { name: "Matérias-Primas", href: "/materias-primas", icon: Package },
  { name: "Equipamentos", href: "/equipamentos", icon: Cpu },
  { name: "Processos de Produção", href: "/processos-producao", icon: Factory },
  { name: "Despesas Fixas", href: "/despesas-fixas", icon: Receipt },
  { name: "Preço Impressão", href: "/preco-impressao", icon: Calculator },
  { name: "Monitoramento", href: "/monitoramento", icon: TrendingUp },
  { name: "Chat Interno", href: "/chat", icon: MessageSquare },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
  { name: "Auditoria", href: "/auditoria", icon: Shield },
];

export default function Layout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="w-64 border-r border-sidebar-border bg-sidebar">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <h1 className="text-xl font-bold text-sidebar-primary">OrçaGráfica</h1>
        </div>
        
        <nav className="space-y-1 p-4">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-auto">
        {/* Top bar with notifications */}
        <header className="flex items-center justify-end gap-3 border-b px-6 py-2">
          <NotificationBell />
          {profile && (
            <span className="text-sm text-muted-foreground">{profile.display_name}</span>
          )}
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}