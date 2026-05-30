// =============================================================================
// Hook: composição do preço de uma folha de etiquetas
// =============================================================================
// Soma o preço de Impressão (printing_price_items) + Acabamento
// (finishings_price_items, ex.: Recorte plotter). Tudo filtrado pelo `size`
// da folha selecionada na calculadora (SRA3 / A4 / A3 / 33x48).
//
// Persistência da escolha por tamanho: localStorage["labelCalc:priceChoice:v1"]
//   { [size: string]: { printingId: string|null, finishingId: string|null } }
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveFinishingPricePerSheet,
  type FinishingTier,
} from "./finishing-pricing";

const CHOICE_KEY = "labelCalc:priceChoice:v1";

export interface PrintingOption {
  id: string;
  paper_type: string;
  grammage: string | null;
  size: string;
  side: string;
  equipment_mode: string;
  paper_cost: number;
  printing_cost: number;
  total: number; // paper + printing
  label: string; // "Adesivo Brilho · 210g · A3 · F · color"
}

export interface FinishingOption {
  id: string | null; // null = "Sem acabamento"
  name: string;
  category: string;
  size: string;
  /** Preço/folha BASE (fallback). */
  price_per_sheet: number;
  /** Faixas de quantidade. Vazio = sem volume pricing, usa price_per_sheet. */
  tiers: FinishingTier[];
  label: string;
}

const NO_FINISHING: FinishingOption = {
  id: null,
  name: "Sem acabamento",
  category: "none",
  size: "*",
  price_per_sheet: 0,
  tiers: [],
  label: "Sem acabamento (R$ 0,00)",
};

// ---------- Helpers de label ------------------------------------------------

const sideLabel = (s: string) => (s === "F/V" ? "F/V" : s === "F" ? "F" : s);
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const buildPrintingLabel = (i: Omit<PrintingOption, "label" | "total">) => {
  const parts = [i.paper_type];
  if (i.grammage) parts.push(`${i.grammage}g`);
  parts.push(i.size, sideLabel(i.side), i.equipment_mode);
  return parts.join(" · ");
};

// ---------- Persistência da escolha -----------------------------------------

export type PaperKind = "adesivo" | "papel";

interface SizeChoice {
  printingId: string | null;
  finishingId: string | null;
  /** Escolhas manuais de acabamento por papel (printingId). */
  finishingByPrinting?: Record<string, string | null>;
  /** Último printingId selecionado por tipo de papel. */
  printingByKind?: Partial<Record<PaperKind, string>>;
  /** Último tipo de papel selecionado. */
  paperKind?: PaperKind;
}

export const paperKindOf = (p: Pick<PrintingOption, "paper_type">): PaperKind =>
  /adesiv/i.test(p.paper_type) ? "adesivo" : "papel";
interface ChoiceMap {
  [size: string]: SizeChoice;
}

const loadChoices = (): ChoiceMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHOICE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const saveChoice = (size: string, printingId: string | null, finishingId: string | null) => {
  if (typeof window === "undefined") return;
  try {
    const all = loadChoices();
    const prev = all[size] ?? {};
    all[size] = { ...prev, printingId, finishingId };
    window.localStorage.setItem(CHOICE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
};

const saveManualFinishingForPrinting = (
  size: string,
  printingId: string | null,
  finishingId: string | null,
) => {
  if (typeof window === "undefined" || !printingId) return;
  try {
    const all = loadChoices();
    const prev = all[size] ?? { printingId: null, finishingId: null };
    const map = { ...(prev.finishingByPrinting ?? {}) };
    map[printingId] = finishingId;
    all[size] = { ...prev, finishingByPrinting: map };
    window.localStorage.setItem(CHOICE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
};

/**
 * Heurística: dado um item de impressão, escolhe o acabamento de recorte
 * correspondente. Casamento por palavra-chave no nome do papel vs. nome do
 * acabamento (já cadastrado no mesmo `size`).
 */
export function pickDefaultFinishing(
  printing: PrintingOption | null,
  finishingOptions: FinishingOption[],
): string | null {
  if (!printing) return null;
  const paper = printing.paper_type.toLowerCase();
  const real = finishingOptions.filter((f) => f.id !== null);
  if (real.length === 0) return null;
  const find = (re: RegExp) => real.find((f) => re.test(f.name.toLowerCase()))?.id ?? null;
  if (/adesiv/.test(paper)) {
    return find(/adesiv/) ?? find(/especia/) ?? real[0].id;
  }
  // qualquer outro papel → "papéis especiais"
  return find(/especia/) ?? find(/adesiv/) ?? real[0].id;
}

// ---------- Hook principal --------------------------------------------------

export interface UseFolhaPricingResult {
  /** Lista filtrada pelo `paperKind` atual. */
  printingOptions: PrintingOption[];
  /** Lista completa (todos os tipos), útil para diagnóstico. */
  allPrintingOptions: PrintingOption[];
  finishingOptions: FinishingOption[];
  selectedPrinting: PrintingOption | null;
  selectedFinishing: FinishingOption;
  setPrintingId: (id: string) => void;
  setFinishingId: (id: string | "__none__") => void;
  paperKind: PaperKind;
  setPaperKind: (k: PaperKind) => void;
  /** Quais tipos têm pelo menos um item cadastrado (controla habilitação do toggle). */
  availableKinds: PaperKind[];
  total: number;
  finishingPricePerSheet: number;
  /** Resolve o preço/folha (impressão + acabamento) para uma qtde de folhas específica — usado pela escada de ancoragem. */
  totalForSheets: (sheets: number) => number;
  isLoading: boolean;
  /** true quando o acabamento atual veio da heurística automática (não foi escolhido manualmente). */
  finishingIsAuto: boolean;
  missing: "missing-printing" | null;
}

export function useFolhaPricing(
  size: string,
  sheetsQty?: number,
  finishingSize?: string,
  skipInitialLoad?: boolean,
): UseFolhaPricingResult {
  const finishingSizeKey = finishingSize ?? size;
  // Para papel adesivo, A3 e SRA3 são intercambiáveis (mesma folha física no plotter).
  // Buscamos os dois e filtramos por tipo abaixo.
  const sizesToFetch = useMemo<string[]>(
    () => (size === "SRA3" || size === "A3" ? ["SRA3", "A3"] : [size]),
    [size],
  );
  const printingQ = useQuery({
    queryKey: ["printing_price_items", sizesToFetch.join("|")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("printing_price_items")
        .select("id, paper_type, grammage, size, side, equipment_mode, paper_cost, printing_cost, is_active")
        .eq("is_active", true)
        .in("size", sizesToFetch)
        .order("paper_type");
      if (error) throw error;
      return (data ?? []).map<PrintingOption>((d) => {
        const total = Number(d.paper_cost) + Number(d.printing_cost);
        const base = {
          id: d.id,
          paper_type: d.paper_type,
          grammage: d.grammage,
          size: d.size,
          side: d.side,
          equipment_mode: d.equipment_mode,
          paper_cost: Number(d.paper_cost),
          printing_cost: Number(d.printing_cost),
        };
        return { ...base, total, label: `${buildPrintingLabel(base)} · ${fmtBRL(total)}/folha` };
      });
    },
  });

  const finishingQ = useQuery({
    queryKey: ["finishings_price_items_with_tiers", finishingSizeKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("finishings_price_items")
        .select(
          "id, name, category, size, price_per_sheet, is_active, finishing_price_tiers(id, finishing_id, label, min_qty, max_qty, price_per_sheet, sort_order)",
        )
        .eq("is_active", true)
        .eq("size", finishingSizeKey)
        .order("sort_order");
      if (error) throw error;
      const items: FinishingOption[] = (data ?? []).map((d: any) => {
        const tiers: FinishingTier[] = (d.finishing_price_tiers ?? []).map((t: any) => ({
          id: t.id,
          finishing_id: t.finishing_id,
          label: t.label,
          min_qty: Number(t.min_qty),
          max_qty: t.max_qty == null ? null : Number(t.max_qty),
          price_per_sheet: Number(t.price_per_sheet),
          sort_order: Number(t.sort_order ?? 0),
        }));
        return {
          id: d.id,
          name: d.name,
          category: d.category,
          size: d.size,
          price_per_sheet: Number(d.price_per_sheet),
          tiers,
          label: `${d.name} · ${fmtBRL(Number(d.price_per_sheet))}/folha`,
        };
      });
      return [NO_FINISHING, ...items];
    },
  });

  const allPrintingOptions = printingQ.data ?? [];
  const finishingOptions = finishingQ.data ?? [NO_FINISHING];

  // Itens elegíveis: adesivo e papel aceitam A3↔SRA3; outros tamanhos exigem o tamanho exato.
  const eligiblePrintingOptions = useMemo(() => {
    const isA3Variant = (s: string) => s === "A3" || s === "SRA3";
    return allPrintingOptions.filter((p) => {
      if (p.size === size) return true;
      if (isA3Variant(p.size) && isA3Variant(size)) return true;
      return false;
    });
  }, [allPrintingOptions, size]);

  const availableKinds: PaperKind[] = useMemo(() => {
    const set = new Set<PaperKind>();
    eligiblePrintingOptions.forEach((p) => set.add(paperKindOf(p)));
    return Array.from(set);
  }, [eligiblePrintingOptions]);

  const [paperKind, setPaperKindState] = useState<PaperKind>(() => {
    return loadChoices()[size]?.paperKind ?? "adesivo";
  });
  const [printingId, setPrintingIdState] = useState<string | null>(() => {
    if (skipInitialLoad) return null;
    return loadChoices()[size]?.printingId ?? null;
  });
  const [finishingId, setFinishingIdState] = useState<string | null>(() => {
    if (skipInitialLoad) return null;
    return loadChoices()[size]?.finishingId ?? null;
  });
  const [finishingIsAuto, setFinishingIsAuto] = useState(false);

  // Quando troca o `size`, recarrega escolha salva (ou reseta se skipInitialLoad for true)
  useEffect(() => {
    const c = loadChoices()[size];
    setPrintingIdState(skipInitialLoad ? null : (c?.printingId ?? null));
    setFinishingIdState(skipInitialLoad ? null : (c?.finishingId ?? null));
    setPaperKindState(c?.paperKind ?? "adesivo");
    setFinishingIsAuto(false);
  }, [size, skipInitialLoad]);

  // Garante que paperKind seja um disponível
  useEffect(() => {
    if (availableKinds.length === 0) return;
    if (!availableKinds.includes(paperKind)) {
      setPaperKindState(availableKinds[0]);
    }
  }, [availableKinds, paperKind]);

  const printingOptions = useMemo(
    () => eligiblePrintingOptions.filter((p) => paperKindOf(p) === paperKind),
    [eligiblePrintingOptions, paperKind],
  );
  useEffect(() => {
    if (printingOptions.length === 0 || skipInitialLoad) return;
    if (!printingId || !printingOptions.some((p) => p.id === printingId)) {
      const choices = loadChoices();
      const lastForKind = choices[size]?.printingByKind?.[paperKind];
      const fallback = lastForKind && printingOptions.some((p) => p.id === lastForKind)
        ? lastForKind
        : printingOptions[0].id;
      setPrintingIdState(fallback);
    }
  }, [printingOptions, printingId, paperKind, size, skipInitialLoad]);

  useEffect(() => {
    if (finishingOptions.length === 0) return;
    if (finishingId !== null && !finishingOptions.some((f) => f.id === finishingId)) {
      setFinishingIdState(null);
    }
  }, [finishingOptions, finishingId]);

  const selectedPrinting = useMemo(
    () => allPrintingOptions.find((p) => p.id === printingId) ?? null,
    [allPrintingOptions, printingId],
  );
  const selectedFinishing = useMemo(
    () => finishingOptions.find((f) => f.id === finishingId) ?? NO_FINISHING,
    [finishingOptions, finishingId],
  );

  // Auto-vinculação: ao mudar o papel, aplica escolha manual prévia OU heurística.
  useEffect(() => {
    if (!selectedPrinting || skipInitialLoad) return;
    if (finishingOptions.length <= 1) return; // só "Sem acabamento" disponível
    const choices = loadChoices();
    const manualMap = choices[size]?.finishingByPrinting ?? {};
    if (Object.prototype.hasOwnProperty.call(manualMap, selectedPrinting.id)) {
      const saved = manualMap[selectedPrinting.id];
      setFinishingIdState(saved);
      setFinishingIsAuto(false);
      saveChoice(size, selectedPrinting.id, saved);
      return;
    }
    const auto = pickDefaultFinishing(selectedPrinting, finishingOptions);
    setFinishingIdState(auto);
    setFinishingIsAuto(true);
    saveChoice(size, selectedPrinting.id, auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPrinting?.id, finishingOptions.length, size, skipInitialLoad]);

  const persistKindAndPrinting = (kind: PaperKind, pid: string | null) => {
    if (typeof window === "undefined") return;
    try {
      const all = loadChoices();
      const prev = all[size] ?? { printingId: null, finishingId: null };
      const map = { ...(prev.printingByKind ?? {}) };
      if (pid) map[kind] = pid;
      all[size] = { ...prev, paperKind: kind, printingByKind: map };
      window.localStorage.setItem(CHOICE_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  };

  const setPaperKind = (kind: PaperKind) => {
    setPaperKindState(kind);
    const choices = loadChoices();
    const lastForKind = choices[size]?.printingByKind?.[kind];
    const candidates = allPrintingOptions.filter((p) => paperKindOf(p) === kind);
    const next = lastForKind && candidates.some((p) => p.id === lastForKind)
      ? lastForKind
      : candidates[0]?.id ?? null;
    setPrintingIdState(next);
    persistKindAndPrinting(kind, next);
  };

  const setPrintingId = (id: string) => {
    setPrintingIdState(id);
    const found = allPrintingOptions.find((p) => p.id === id);
    if (found) persistKindAndPrinting(paperKindOf(found), id);
    // finishing será recalculado pelo effect acima
  };
  const setFinishingId = (id: string | "__none__") => {
    const next = id === "__none__" ? null : id;
    setFinishingIdState(next);
    setFinishingIsAuto(false);
    saveChoice(size, printingId, next);
    saveManualFinishingForPrinting(size, printingId, next);
  };

  const finishingPricePerSheet = useMemo(() => {
    if (!selectedFinishing.id) return 0;
    if (!selectedFinishing.tiers.length || sheetsQty == null || sheetsQty <= 0) {
      return selectedFinishing.price_per_sheet;
    }
    return resolveFinishingPricePerSheet(
      selectedFinishing.price_per_sheet,
      selectedFinishing.tiers,
      sheetsQty,
    );
  }, [selectedFinishing, sheetsQty]);

  const total = (selectedPrinting?.total ?? 0) + finishingPricePerSheet;
  const isLoading = printingQ.isLoading || finishingQ.isLoading;

  const totalForSheets = useMemo(() => {
    return (sheets: number) => {
      const printing = selectedPrinting?.total ?? 0;
      if (!selectedFinishing.id) return printing;
      const finish = selectedFinishing.tiers.length && sheets > 0
        ? resolveFinishingPricePerSheet(selectedFinishing.price_per_sheet, selectedFinishing.tiers, sheets)
        : selectedFinishing.price_per_sheet;
      return printing + finish;
    };
  }, [selectedPrinting, selectedFinishing]);

  return {
    printingOptions,
    allPrintingOptions,
    finishingOptions,
    selectedPrinting,
    selectedFinishing,
    setPrintingId,
    setFinishingId,
    paperKind,
    setPaperKind,
    availableKinds,
    total,
    finishingPricePerSheet,
    totalForSheets,
    isLoading,
    finishingIsAuto,
    missing: !selectedPrinting && !isLoading ? "missing-printing" : null,
  };
}
