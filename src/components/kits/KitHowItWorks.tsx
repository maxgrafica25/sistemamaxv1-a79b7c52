import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  PlusCircle,
  Tags,
  Wand2,
  MoreHorizontal,
} from "lucide-react";

export default function KitHowItWorks() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
        >
          <HelpCircle className="h-3.5 w-3.5 mr-1" />
          Como funciona
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[420px] max-w-[92vw] p-3 text-xs"
      >
        <p className="text-sm font-medium text-primary mb-2 flex items-center gap-1.5">
          <HelpCircle className="h-4 w-4" />
          Como funciona este kit
        </p>
        <ol className="space-y-2 text-muted-foreground">
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
              em cada linha escolha: <strong>Obrigatório</strong> (sempre entra),{" "}
              <strong>Opcional</strong> (cliente decide) ou{" "}
              <strong>Alternativo</strong> (agrupado por nome, cliente escolhe 1).
              Ex.: capa LINE × CAMURCA = ambas <em>Alternativo</em> no grupo{" "}
              <code className="px-1 rounded bg-muted">capa</code>.
            </span>
          </li>
          <li className="flex gap-2">
            <Wand2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>
              <strong className="text-foreground">3. Encadernação espiral</strong> —
              clique em <em>+ Encadernação espiral</em>. As 12 faixas já vêm
              prontas; basta escolher o suprimento de cada uma (ou clicar em{" "}
              <em>Copiar de outro kit</em>). O sistema usa a espiral certa para
              cada nº de folhas no orçamento.
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
      </PopoverContent>
    </Popover>
  );
}
