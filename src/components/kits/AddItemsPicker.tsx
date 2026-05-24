import { useEffect, useMemo, useRef, useState } from "react";
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
import { Search, Package, Scissors, Loader2, Sparkles } from "lucide-react";
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
  production_step_id?: string | null;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const singularize = (t: string) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t);

function matchesKitName(candidate: string, kitName: string): boolean {
  const k = normalize(kitName);
  const c = normalize(candidate);
  if (k.length < 3 || !c) return false;
  if (c.includes(k) || k.includes(c)) return true;
  const kTokens = new Set(k.split(" ").map(singularize).filter((t) => t.length > 3));
  const cTokens = c.split(" ").map(singularize).filter((t) => t.length > 3);
  return cTokens.some((t) => kTokens.has(t));
}

export default function AddItemsPicker({
  open,
  onOpenChange,
  processes,
  onConfirm,
  onAddSpiralShortcut,
  kitName = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  processes: ProcessOption[];
  onConfirm: (items: PickedItem[]) => void;
  onAddSpiralShortcut?: () => void;
  kitName?: string;
}) {
  const { supplies, loaded } = useV3Supplies();
  const [tab, setTab] = useState<"supplies" | "processes">("processes");
  const [q, setQ] = useState("");
  const [selSup, setSelSup] = useState<Set<string>>(new Set());
  const [selProc, setSelProc] = useState<Set<string>>(new Set());
  const autoMarkedFor = useRef<string | null>(null);

  const reset = () => {
    setQ("");
    setSelSup(new Set());
    setSelProc(new Set());
    setTab("processes");
    autoMarkedFor.current = null;
  };

  const suggestedSupplies = useMemo(() => {
    if (!kitName.trim() || q.trim()) return [] as typeof supplies;
    return supplies.filter((s) => matchesKitName(s.produto, kitName));
  }, [supplies, kitName, q]);

  const suggestedProcesses = useMemo(() => {
    if (!kitName.trim() || q.trim()) return [] as ProcessOption[];
    return processes.filter((p) => matchesKitName(p.description, kitName));
  }, [processes, kitName, q]);

  // Pré-marca sugestões na 1ª abertura para cada nome de kit.
  useEffect(() => {
    if (!open || !loaded) return;
    const key = normalize(kitName);
    if (!key || key.length < 3) return;
    if (autoMarkedFor.current === key) return;
    autoMarkedFor.current = key;
    if (suggestedSupplies.length > 0) {
      setSelSup((prev) => {
        const next = new Set(prev);
        suggestedSupplies.forEach((s) => next.add(s.id));
        return next;
      });
    }
    if (suggestedProcesses.length > 0) {
      setSelProc((prev) => {
        const next = new Set(prev);
        suggestedProcesses.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }, [open, loaded, kitName, suggestedSupplies, suggestedProcesses]);

  const suggestedSupIds = useMemo(
    () => new Set(suggestedSupplies.map((s) => s.id)),
    [suggestedSupplies],
  );
  const suggestedProcIds = useMemo(
    () => new Set(suggestedProcesses.map((p) => p.id)),
    [suggestedProcesses],
  );

  const filteredSup = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? supplies.filter(
          (s) =>
            s.produto.toLowerCase().includes(term) ||
            (s.fornecedor ?? "").toLowerCase().includes(term),
        )
      : supplies;
    if (suggestedSupIds.size === 0) return base;
    return base.filter((s) => !suggestedSupIds.has(s.id));
  }, [supplies, q, suggestedSupIds]);

  const filteredProc = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? processes.filter((p) => p.description.toLowerCase().includes(term))
      : processes;
    if (suggestedProcIds.size === 0) return base;
    return base.filter((p) => !suggestedProcIds.has(p.id));
  }, [processes, q, suggestedProcIds]);

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

  const SuggestionHeader = ({
    count,
    onMarkAll,
    onClear,
  }: {
    count: number;
    onMarkAll: () => void;
    onClear: () => void;
  }) => (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-primary/10 border-l-2 border-l-primary">
      <span className="text-[11px] font-medium text-primary flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        Sugestões para "{kitName}" ({count})
      </span>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          onClick={onMarkAll}
        >
          Marcar todos
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          onClick={onClear}
        >
          Limpar
        </Button>
      </div>
    </div>
  );

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
            <TabsTrigger value="processes" className="flex-1 gap-1.5">
              <Scissors className="h-3.5 w-3.5" /> Acabamentos
              {selProc.size > 0 && (
                <Badge variant="secondary" className="ml-1">{selProc.size}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="supplies" className="flex-1 gap-1.5">
              <Package className="h-3.5 w-3.5" /> Suprimentos
              {selSup.size > 0 && (
                <Badge variant="secondary" className="ml-1">{selSup.size}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="processes" className="flex-1 min-h-0 mt-2">
            <ScrollArea className="h-[50vh] rounded-md border">
              <div className="divide-y">
                {suggestedProcesses.length > 0 && (
                  <>
                    <SuggestionHeader
                      count={suggestedProcesses.length}
                      onMarkAll={() =>
                        setSelProc((prev) => {
                          const next = new Set(prev);
                          suggestedProcesses.forEach((p) => next.add(p.id));
                          return next;
                        })
                      }
                      onClear={() =>
                        setSelProc((prev) => {
                          const next = new Set(prev);
                          suggestedProcesses.forEach((p) => next.delete(p.id));
                          return next;
                        })
                      }
                    />
                    {suggestedProcesses.map((p) => {
                      const checked = selProc.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary/5 bg-primary/[0.03]"
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
                  </>
                )}
                {filteredProc.length === 0 && suggestedProcesses.length === 0 && (
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
                  {suggestedSupplies.length > 0 && (
                    <>
                      <SuggestionHeader
                        count={suggestedSupplies.length}
                        onMarkAll={() =>
                          setSelSup((prev) => {
                            const next = new Set(prev);
                            suggestedSupplies.forEach((s) => next.add(s.id));
                            return next;
                          })
                        }
                        onClear={() =>
                          setSelSup((prev) => {
                            const next = new Set(prev);
                            suggestedSupplies.forEach((s) => next.delete(s.id));
                            return next;
                          })
                        }
                      />
                      {suggestedSupplies.map((s) => {
                        const checked = selSup.has(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary/5 bg-primary/[0.03]"
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
                    </>
                  )}
                  {filteredSup.length === 0 && suggestedSupplies.length === 0 && (
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
