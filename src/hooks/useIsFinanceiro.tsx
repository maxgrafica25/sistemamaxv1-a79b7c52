import { useAuth } from "@/hooks/useAuth";

/**
 * Identifica usuários do Financeiro: admin OU profile.is_financeiro = true.
 * Espelha o RLS server-side (public.is_financeiro_user).
 */
export function useIsFinanceiro() {
  const { profile } = useAuth();
  if (!profile) return false;
  if (profile.role === "admin") return true;
  return profile.is_financeiro === true;
}
