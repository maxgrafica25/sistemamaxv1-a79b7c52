import { Navigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsFinanceiro } from "@/hooks/useIsFinanceiro";
import PageLoader from "@/components/PageLoader";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  /** "admin" exige role admin; "financeiro" exige admin OU profile.is_financeiro */
  requires: "admin" | "financeiro";
}

/**
 * Guard de página (Etapa 4) — só renderiza children se o profile do usuário tem
 * a role exigida. Espelha o RLS server-side; nunca substitui a verificação no banco.
 *
 * Em caso de falta de permissão, mostra mensagem em vez de redirect silencioso
 * (clarifica que o problema é permissão, não rota inexistente).
 */
export default function RoleProtectedRoute({
  children,
  requires,
}: RoleProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const isAdmin = useIsAdmin();
  const isFinanceiro = useIsFinanceiro();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  // Aguarda profile carregar para evitar flash de "sem permissão"
  if (!profile) return <PageLoader />;

  const allowed = requires === "financeiro" ? isFinanceiro : isAdmin;
  if (!allowed) {
    const label =
      requires === "financeiro" ? "do Financeiro" : "administradores";
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center p-6">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Esta página é exclusiva para usuários {label}. Se você precisa de
          acesso, fale com um administrador do sistema.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
