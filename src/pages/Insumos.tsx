import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminOnly } from "@/components/AdminOnly";
import { DotTabs } from "@/components/ui/dot-tabs";
import MateriasPrimas from "./MateriasPrimas";
import GruposMateriais from "./GruposMateriais";
import KitsProduto, { type KitsProdutoHandle } from "./KitsProduto";

type Tab = "materiais" | "grupos" | "kits";

const TABS = [
  { key: "materiais" as const, label: "Materiais" },
  { key: "grupos" as const, label: "Grupos" },
  { key: "kits" as const, label: "Kits de Produto" },
];

export default function Insumos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (searchParams.get("tab") as Tab) || "materiais";
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.key === initial) ? initial : "materiais",
  );
  const kitsRef = useRef<KitsProdutoHandle>(null);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (tab === "materiais") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div>
      {tab === "kits" && (
        <div className="px-3 sm:px-4 lg:px-6 xl:px-8 pt-6 max-w-[1400px] mx-auto">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Kits de Produto
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Materiais e processos sugeridos automaticamente por tipo de produto no orçamento.
              </p>
            </div>
            <AdminOnly>
              <Button onClick={() => kitsRef.current?.openNew()} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Kit
              </Button>
            </AdminOnly>
          </div>
        </div>
      )}

      <div
        className={
          tab === "kits"
            ? "border-b border-border"
            : "sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border"
        }
      >
        <div className="px-3 sm:px-4 lg:px-6 xl:px-8 max-w-[1400px] mx-auto">
          <DotTabs tabs={TABS} value={tab} onChange={(k) => setTab(k as Tab)} />
        </div>
      </div>

      {tab === "materiais" && <MateriasPrimas />}
      {tab === "grupos" && <GruposMateriais />}
      {tab === "kits" && <KitsProduto ref={kitsRef} hideHeader />}
    </div>
  );
}
