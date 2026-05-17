import { useState } from "react";
import { Megaphone, Layers, Printer as PrinterIcon, Scissors, Calculator, Settings, Package } from "lucide-react";
import CalculadoraTab from "@/components/cv-calc/CalculadoraTab";
import MidiasTab from "@/components/cv-calc/MidiasTab";
import ImpressoesTab from "@/components/cv-calc/ImpressoesTab";
import AcabamentosTab from "@/components/cv-calc/AcabamentosTab";
import SuprimentosCVTab from "@/components/cv-calc/SuprimentosCVTab";
import ConfiguracaoTab from "@/components/cv-calc/ConfiguracaoTab";

type Tab = "calculadora" | "midias" | "impressoes" | "acabamentos" | "suprimentos" | "config";

const TABS: { key: Tab; label: string; icon: typeof Layers }[] = [
  { key: "calculadora", label: "Calculadora", icon: Calculator },
  { key: "midias", label: "Mídias", icon: Layers },
  { key: "impressoes", label: "Impressões", icon: PrinterIcon },
  { key: "acabamentos", label: "Acabamentos", icon: Scissors },
  { key: "suprimentos", label: "Suprimentos CV", icon: Package },
  { key: "config", label: "Configuração", icon: Settings },
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

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-[3px] -mb-px shrink-0 ${
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "calculadora" && <CalculadoraTab />}
      {tab === "midias" && <MidiasTab />}
      {tab === "impressoes" && <ImpressoesTab />}
      {tab === "acabamentos" && <AcabamentosTab />}
      {tab === "suprimentos" && <SuprimentosCVTab />}
      {tab === "config" && <ConfiguracaoTab />}
    </div>
  );
}
