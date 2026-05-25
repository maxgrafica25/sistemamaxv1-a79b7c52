import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Botões/ações alinhados à direita, mesma linha do título. */
  actions?: ReactNode;
  /** Linha extra abaixo da descrição (badges, stats, resumo). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de página/módulo.
 *
 * Regras fixas (design system):
 * - h1 24px bold, ícone Lucide roxo (h-6 w-6 text-primary) à esquerda
 * - Subtítulo 14px muted, opcional
 * - Ações à direita na mesma linha
 *
 * Use SEMPRE este componente para títulos de módulo — não escreva <h1> à mão.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 flex-wrap", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Icon className="h-6 w-6 text-primary shrink-0" />
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
        {meta && <div className="mt-2">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
