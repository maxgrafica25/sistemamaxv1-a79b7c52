import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  steps?: ReactNode;
  children: ReactNode;
  summary: ReactNode;
  className?: string;
}

/**
 * Shell padrão dos módulos de cálculo:
 *  ┌ Header (título + ações)
 *  ├ Steps (opcional)
 *  └ Grid: [Configuração (col-span-2)] [Resumo Financeiro (sticky)]
 */
export function CalcShell({ title, icon, actions, steps, children, summary, className }: Props) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icon}</div>}
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {steps && <div>{steps}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">{children}</div>
        <div className="lg:col-span-1">{summary}</div>
      </div>
    </div>
  );
}
