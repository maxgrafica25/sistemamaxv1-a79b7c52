import { useAuth } from "@/hooks/useAuth";

/**
 * Usuário do perfil "Pré-impressão": só enxerga o módulo Pré-impressão.
 * Administrador nunca é restrito. A marca só é alterada por admin
 * (gatilho prevent_somente_pre_impressao_escalation).
 *
 * Atenção: é uma trava de tela (menu e rotas). As regras de acesso do banco (RLS)
 * não diferenciam este perfil do Colaborador.
 */
export function useSomentePreImpressao() {
  const { profile } = useAuth();
  if (!profile) return false;
  if (profile.role === "admin") return false;
  return profile.somente_pre_impressao === true;
}
