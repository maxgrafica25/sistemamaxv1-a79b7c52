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
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Comunicação Visual
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mídias, impressões, acabamentos e configurações para grande formato
        </p>
      </div>

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
