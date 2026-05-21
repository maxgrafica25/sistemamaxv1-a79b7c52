import { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HelpCircle,
  ChevronDown,
  PlusCircle,
  Tags,
  Wand2,
  MoreHorizontal,
} from "lucide-react";

const LS_KEY = "kits.howItWorks.open";

export default function KitHowItWorks() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved !== null) setOpen(saved === "1");
  }, []);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    localStorage.setItem(LS_KEY, v ? "1" : "0");
  };

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <div className="rounded-md border border-primary/20 bg-primary/5">
        <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium hover:bg-primary/10 transition-colors rounded-md">
          <span className="flex items-center gap-2 text-primary">
            <HelpCircle className="h-4 w-4" />
            Como funciona este kit
          </span>
          <ChevronDown
            className={`h-4 w-4 text-primary transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="px-4 pb-3 pt-1 space-y-2.5 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <PlusCircle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">1. Adicionar acabamentos</strong> —
                clique em <em>+ Adicionar acabamentos</em> para abrir o seletor
                em massa (abas Suprimentos e Processos). Marque vários de uma vez.
              </span>
            </li>
            <li className="flex gap-2">
              <Tags className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">2. Definir o papel</strong> —
                em cada linha escolha:{" "}
                <strong>Obrigatório</strong> (sempre entra),{" "}
                <strong>Opcional</strong> (cliente decide) ou{" "}
                <strong>Alternativo</strong> (agrupado por nome, cliente escolhe 1).
                Ex.: capa LINE × CAMURCA = ambas <em>Alternativo</em> no grupo
                {" "}<code className="px-1 rounded bg-muted">capa</code>.
              </span>
            </li>
            <li className="flex gap-2">
              <Wand2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">3. Espiral por folhas</strong> —
                clique no botão <em>Espiral por folhas</em> para criar um item com
                12 faixas pré-definidas. Depois clique no badge{" "}
                <em>variante · N faixas</em> e mapeie cada faixa ao suprimento
                certo (ex.: 1–25 fls → Espiral 7mm).
              </span>
            </li>
            <li className="flex gap-2">
              <MoreHorizontal className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground">4. Ajustes finos</strong> —
                o botão <em>⋯</em> em cada linha abre fórmulas (× N por unidade /
                por folha), grupo de alternativos, pré-seleção padrão e notas.
              </span>
            </li>
          </ol>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
