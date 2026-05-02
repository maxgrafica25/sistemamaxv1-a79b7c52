import { ReactNode, cloneElement, isValidElement } from "react";
import { Lock } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsFinanceiro } from "@/hooks/useIsFinanceiro";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AdminOnlyProps {
  children: ReactNode;
  /**
   * Como tratar usuários sem permissão:
   * - "hide": não renderiza nada (default)
   * - "disable": renderiza filho desabilitado com tooltip explicativo
   */
  mode?: "hide" | "disable";
  /** Texto da ação para o tooltip ("editar equipamento", "excluir item") */
  action?: string;
  /** Conteúdo alternativo a renderizar quando esconder */
  fallback?: ReactNode;
  /** Restringe a Financeiro em vez de Admin */
  requires?: "admin" | "financeiro";
}

/**
 * Esconde ou desabilita conteúdo para usuários sem permissão admin/financeiro.
 *
 * Exemplo (esconder):
 *   <AdminOnly><Button>Excluir</Button></AdminOnly>
 *
 * Exemplo (desabilitar com tooltip):
 *   <AdminOnly mode="disable" action="excluir item"><Button>Excluir</Button></AdminOnly>
 */
export function AdminOnly({
  children,
  mode = "hide",
  action = "esta ação",
  fallback = null,
  requires = "admin",
}: AdminOnlyProps) {
  const isAdmin = useIsAdmin();
  const isFinanceiro = useIsFinanceiro();
  const allowed = requires === "financeiro" ? isFinanceiro : isAdmin;

  if (allowed) return <>{children}</>;

  if (mode === "hide") return <>{fallback}</>;

  // mode === "disable" — clona o filho aplicando disabled e envolve em tooltip
  const tooltipText =
    requires === "financeiro"
      ? `Apenas usuários do Financeiro podem ${action}.`
      : `Apenas administradores podem ${action}.`;

  const disabled = isValidElement(children)
    ? cloneElement(children as any, {
        disabled: true,
        "aria-disabled": true,
        onClick: (e: React.MouseEvent) => e.preventDefault(),
        className: `${(children as any).props.className ?? ""} opacity-50 cursor-not-allowed`.trim(),
      })
    : children;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{disabled}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
