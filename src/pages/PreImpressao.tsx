// Central de Pré-impressão: ferramentas para preparar arquivos antes de imprimir.
// Para acrescentar uma ferramenta nova: crie o componente em src/components/preimpressao/
// e adicione uma entrada em FERRAMENTAS (aparece como nova aba, com ?tab=<key> na URL).
// Regra: processamento só no navegador, sem servidor e sem custo (ver CLAUDE.md).

import type { ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { Hash, Printer, Scissors, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import { DotTabs } from "@/components/ui/dot-tabs";
import MargemAcabamento from "@/components/preimpressao/MargemAcabamento";
import NumeracaoTaloes from "@/components/preimpressao/NumeracaoTaloes";

interface Ferramenta {
  key: string;
  label: string;
  icon: LucideIcon;
  Componente: ComponentType;
}

const FERRAMENTAS: Ferramenta[] = [
  {
    key: "margem-acabamento",
    label: "Margem de acabamento",
    icon: Scissors,
    Componente: MargemAcabamento,
  },
  {
    key: "numeracao",
    label: "Numeração de talões",
    icon: Hash,
    Componente: NumeracaoTaloes,
  },
];

export default function PreImpressao() {
  const [params, setParams] = useSearchParams();
  const atual = FERRAMENTAS.find((f) => f.key === params.get("tab")) ?? FERRAMENTAS[0];
  const { Componente } = atual;

  return (
    <PageContainer>
      <PageHeader
        icon={Printer}
        title="Pré-impressão"
        description="Ferramentas para preparar os arquivos antes de imprimir. Tudo roda no seu navegador: os arquivos não são enviados para lugar nenhum."
      />
      <DotTabs
        tabs={FERRAMENTAS.map(({ key, label, icon }) => ({ key, label, icon }))}
        value={atual.key}
        onChange={(key) => setParams({ tab: key }, { replace: true })}
      />
      <Componente />
    </PageContainer>
  );
}
