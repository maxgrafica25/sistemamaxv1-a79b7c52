import { useAuth } from "@/hooks/useAuth";

/**
 * Identifica usuários do Financeiro: admin OU display_name in (Juliano, Marcelle).
 * Mesma regra do chat Financeiro. Quando o sistema de roles expandir,
 * trocar para uma role 'financeiro' dedicada.
 */
export function useIsFinanceiro() {
  const { profile } = useAuth();
  if (!profile) return false;
  if (profile.role === "admin") return true;
  return ["Juliano", "Marcelle"].includes(profile.display_name);
}
