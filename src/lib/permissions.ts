import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsFinanceiro } from "@/hooks/useIsFinanceiro";

/**
 * Guard de permissões com feedback automático.
 *
 * Uso:
 *   const { requireAdmin, requireFinanceiro, isAdmin, isFinanceiro } = usePermissionGuard();
 *
 *   const handleSave = async () => {
 *     if (!requireAdmin("cadastrar item de impressão")) return;
 *     // ...prossegue só se for admin
 *   };
 */
export function usePermissionGuard() {
  const isAdmin = useIsAdmin();
  const isFinanceiro = useIsFinanceiro();

  const requireAdmin = (action: string): boolean => {
    if (!isAdmin) {
      toast.error(
        `Sem permissão para ${action}. Esta ação é restrita aos administradores. Solicite ao administrador para realizar a alteração.`,
      );
      return false;
    }
    return true;
  };

  const requireFinanceiro = (action: string): boolean => {
    if (!isFinanceiro) {
      toast.error(
        `Sem permissão para ${action}. Esta ação é restrita aos usuários do Financeiro (Juliano ou Marcelle).`,
      );
      return false;
    }
    return true;
  };

  return { isAdmin, isFinanceiro, requireAdmin, requireFinanceiro };
}
