import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Layers, Sparkles } from "lucide-react";
import MateriasPrimas from "./MateriasPrimas";
import GruposMateriais from "./GruposMateriais";
import KitsProduto from "./KitsProduto";

type Tab = "materiais" | "grupos" | "kits";

const TABS: { key: Tab; label: string; icon: typeof Package; hint: string }[] = [
  { key: "materiais", label: "Materiais", icon: Package, hint: "Papéis e suprimentos" },
  { key: "grupos", label: "Grupos", icon: Layers, hint: "Agrupamentos por finalidade" },
  { key: "kits", label: "Kits de Produto", icon: Sparkles, hint: "Receitas prontas para orçar" },
];

export default function Insumos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (searchParams.get("tab") as Tab) || "materiais";
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.key === initial) ? initial : "materiais",
  );

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (tab === "materiais") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div>
      {/* Sub-nav (tabs) */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-3 sm:px-4 lg:px-6 xl:px-8 max-w-[1400px] mx-auto">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-[3px] -mb-px shrink-0 ${
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  title={t.hint}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {tab === "materiais" && <MateriasPrimas />}
      {tab === "grupos" && <GruposMateriais />}
      {tab === "kits" && <KitsProduto />}
    </div>
  );
}
