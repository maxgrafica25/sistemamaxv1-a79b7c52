import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { Megaphone } from "lucide-react";
import CalculadoraTab from "@/components/cv-calc/CalculadoraTab";
import MidiasTab from "@/components/cv-calc/MidiasTab";
import ImpressoesTab from "@/components/cv-calc/ImpressoesTab";
import AcabamentosTab from "@/components/cv-calc/AcabamentosTab";
import SuprimentosCVTab from "@/components/cv-calc/SuprimentosCVTab";
import ConfiguracaoTab from "@/components/cv-calc/ConfiguracaoTab";
import ChecklistTab from "@/components/cv-calc/ChecklistTab";

import { DotTabs } from "@/components/ui/dot-tabs";

type Tab = "calculadora" | "midias" | "impressoes" | "acabamentos" | "suprimentos" | "checklist" | "config";

const TABS = [
  { key: "calculadora" as Tab, label: "Calculadora" },
  { key: "midias" as Tab, label: "Mídias" },
  { key: "impressoes" as Tab, label: "Impressões" },
  { key: "acabamentos" as Tab, label: "Acabamentos" },
  { key: "suprimentos" as Tab, label: "Suprimentos CV" },
  { key: "checklist" as Tab, label: "Checklist" },
  { key: "config" as Tab, label: "Configuração" },
];

export default function CadastrosCV() {
  const [tab, setTab] = useState<Tab>("calculadora");

  return (
    <div className="p-3 sm:p-4 lg:p-6 xl:p-8 space-y-4 lg:space-y-6 max-w-[1400px] mx-auto">
      <PageHeader icon={Megaphone} title="Comunicação Visual" description="Mídias, impressões, acabamentos e configurações para grande formato" />

      <DotTabs tabs={TABS} value={tab} onChange={(k) => setTab(k as Tab)} />

      {tab === "calculadora" && <CalculadoraTab />}
      {tab === "midias" && <MidiasTab />}
      {tab === "impressoes" && <ImpressoesTab />}
      {tab === "acabamentos" && <AcabamentosTab />}
      {tab === "suprimentos" && <SuprimentosCVTab />}
      {tab === "checklist" && <ChecklistTab />}
      {tab === "config" && <ConfiguracaoTab />}
    </div>
  );
}
