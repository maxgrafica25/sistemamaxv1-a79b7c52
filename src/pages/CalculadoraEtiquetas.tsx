import { PageHeader } from "@/components/PageHeader";
import { Ruler } from "lucide-react";
import { LabelLayoutCalculator } from "@/components/labels/LabelLayoutCalculator";

export default function CalculadoraEtiquetas() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader icon={Ruler} title="Calculadora de Etiquetas" description="Descubra quantas etiquetas cabem por folha, calcule o orçamento por preço fixo e veja sugestões de venda em quantidades maiores." />
      <LabelLayoutCalculator />
    </div>
  );
}
