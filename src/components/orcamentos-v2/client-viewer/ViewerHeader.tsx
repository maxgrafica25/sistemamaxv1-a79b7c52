import { Printer } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  quoteNumber: string;
  status: ReactNode;
}

export function ViewerHeader({ quoteNumber, status }: Props) {
  return (
    <header className="bg-background border-b border-border/60 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Printer className="h-5 w-5 text-primary" />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Proposta</p>
            <p className="text-sm font-semibold text-foreground">Nº {quoteNumber}</p>
          </div>
        </div>
        {status}
      </div>
    </header>
  );
}
