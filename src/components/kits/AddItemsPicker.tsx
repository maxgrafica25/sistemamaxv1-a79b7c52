import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Package, Cog, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useV3Supplies } from "@/components/orcamentos-v3/shared/useV3Supplies";

export interface PickedSupply {
  kind: "supply";
  id: string;
  label: string;
}
export interface PickedProcess {
  kind: "process";
  id: string;
  label: string;
}
export type PickedItem = PickedSupply | PickedProcess;

interface ProcessOption {
  id: string;
  description: string;
}

export default function AddItemsPicker({
  open,
  onOpenChange,
  processes,
  onConfirm,
  onAddSpiralShortcut,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  processes: ProcessOption[];
  onConfirm: (items: PickedItem[]) => void;
  onAddSpiralShortcut?: () => void;
}) {
  const { supplies, loaded } = useV3Supplies();
  const [tab, setTab] = useState<"supplies" | "processes">("supplies");
  const [q, setQ] = useState("");
  const [selSup, setSelSup] = useState<Set<string>>(new Set());
  const [selProc, setSelProc] = useState<Set<string>>(new Set());

  const reset = () => {
    setQ("");
    setSelSup(new Set());
    setSelProc(new Set());
    setTab("supplies");
  };

  const filteredSup = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return supplies;
    return supplies.filter(
      (s) =>
        s.produto.toLowerCase().includes(term) ||
        (s.fornecedor ?? "").toLowerCase().includes(term),
    );
  }, [supplies, q]);

  const filteredProc = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return processes;
    return processes.filter((p) => p.description.toLowerCase().includes(term));
  }, [processes, q]);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const total = selSup.size + selProc.size;

  const confirm = () => {
    const items: PickedItem[] = [
      ...Array.from(selSup).map((id) => {
        const s = supplies.find((x) => x.id === id)!;
        return { kind: "supply" as const, id, label: s?.produto ?? "" };
      }),
      ...Array.from(selProc).map((id) => {
        const p = processes.find((x) => x.id === id)!;
        return { kind: "process" as const, id, label: p?.description ?? "" };
      }),
    ];
    onConfirm(items);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Adicionar itens ao kit</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
            autoFocus
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="supplies" className="flex-1 gap-1.5">
              <Package className="h-3.5 w-3.5" /> Suprimentos
              {selSup.size > 0 && (
                <Badge variant="secondary" className="ml-1">{selSup.size}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processes" className="flex-1 gap-1.5">
              <Cog className="h-3.5 w-3.5" /> Processos
              {selProc.size > 0 && (
                <Badge variant="secondary" className="ml-1">{selProc.size}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="supplies" className="flex-1 min-h-0 mt-2">
            {!loaded ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[50vh] rounded-md border">
                <div className="divide-y">
                  {onAddSpiralShortcut && (
                    <button
                      type="button"
                      onClick={onAddSpiralShortcut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left bg-primary/5 hover:bg-primary/10 transition-colors border-l-2 border-l-primary"
                    >
                      <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Encadernação espiral automática</p>
                        <p className="text-[11px] text-muted-foreground">
                          Adiciona linha com 12 faixas (nº de folhas → diâmetro). Você escolhe o suprimento de cada faixa depois.
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-primary shrink-0">Adicionar</span>
                    </button>
                  )}
                  {filteredSup.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground italic">Nada encontrado.</p>
                  )}
                  {filteredSup.map((s) => {
                    const checked = selSup.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(selSup, s.id, setSelSup)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{s.produto}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {s.fornecedor ?? "—"} · R$ {s.valor_unitario.toFixed(2)}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="processes" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-[50vh] rounded-md border">
              <div className="divide-y">
                {filteredProc.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground italic">Nada encontrado.</p>
                )}
                {filteredProc.map((p) => {
                  const checked = selProc.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(selProc, p.id, setSelProc)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{p.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={total === 0}>
            Adicionar {total > 0 ? `${total} ${total === 1 ? "item" : "itens"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
