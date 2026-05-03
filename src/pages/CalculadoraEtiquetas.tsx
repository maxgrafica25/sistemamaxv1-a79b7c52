import { Ruler } from "lucide-react";
import { LabelLayoutCalculator } from "@/components/labels/LabelLayoutCalculator";

export default function CalculadoraEtiquetas() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Ruler className="h-6 w-6 text-primary" />
          Calculadora de Etiquetas
        </h1>
        <p className="text-sm text-muted-foreground">
          Descubra quantas etiquetas cabem por folha, calcule o orçamento por preço
          fixo e veja sugestões de venda em quantidades maiores.
        </p>
      </header>
      <LabelLayoutCalculator />
    </div>
  );
}
