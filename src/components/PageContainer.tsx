import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /**
   * Largura máxima do container.
   * - "default" (1400px) — padrão para a maioria das páginas com tabela.
   * - "wide" (1600px) — páginas com kanban / muitos cards lado a lado.
   * - "full" — sem limite (para layouts edge-to-edge).
   */
  maxWidth?: "default" | "wide" | "full";
}

/**
 * Container padrão de página: padding e largura responsivos.
 * Substitui o padrão antigo "p-6 max-w-[1400px] mx-auto" por:
 *  - p-3 em mobile, p-4 em sm, p-6 em lg+
 *  - max-w configurável
 *  - space-y entre seções automatizado
 */
export function PageContainer({
  children,
  className,
  maxWidth = "default",
}: PageContainerProps) {
  const maxWidthCls =
    maxWidth === "full"
      ? ""
      : maxWidth === "wide"
        ? "max-w-[1600px]"
        : "max-w-[1400px]";

  return (
    <div
      className={cn(
        "p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 mx-auto w-full",
        maxWidthCls,
        className,
      )}
    >
      {children}
    </div>
  );
}
