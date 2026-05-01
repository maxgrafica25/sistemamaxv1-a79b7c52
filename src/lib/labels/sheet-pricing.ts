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
  price_per_sheet: number;
  label: string;
}

const NO_FINISHING: FinishingOption = {
  id: null,
  name: "Sem acabamento",
  category: "none",
  size: "*",
  price_per_sheet: 0,
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

interface ChoiceMap {
  [size: string]: { printingId: string | null; finishingId: string | null };
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
    all[size] = { printingId, finishingId };
    window.localStorage.setItem(CHOICE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
};

// ---------- Hook principal --------------------------------------------------

export interface UseFolhaPricingResult {
  printingOptions: PrintingOption[];
  finishingOptions: FinishingOption[];
  selectedPrinting: PrintingOption | null;
  selectedFinishing: FinishingOption;
  setPrintingId: (id: string) => void;
  setFinishingId: (id: string | "__none__") => void;
  total: number; // R$ por folha
  isLoading: boolean;
  /** "missing-printing" | "missing-finishing" | null */
  missing: "missing-printing" | null;
}

export function useFolhaPricing(size: string): UseFolhaPricingResult {
  const printingQ = useQuery({
    queryKey: ["printing_price_items", size],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("printing_price_items")
        .select("id, paper_type, grammage, size, side, equipment_mode, paper_cost, printing_cost, is_active")
        .eq("is_active", true)
        .eq("size", size)
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
    queryKey: ["finishings_price_items", size],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("finishings_price_items")
        .select("id, name, category, size, price_per_sheet, is_active")
        .eq("is_active", true)
        .eq("size", size)
        .order("sort_order");
      if (error) throw error;
      const items: FinishingOption[] = (data ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        size: d.size,
        price_per_sheet: Number(d.price_per_sheet),
        label: `${d.name} · ${fmtBRL(Number(d.price_per_sheet))}/folha`,
      }));
      return [NO_FINISHING, ...items];
    },
  });

  const printingOptions = printingQ.data ?? [];
  const finishingOptions = finishingQ.data ?? [NO_FINISHING];

  // Estado local (id selecionado por size). Inicializa do localStorage; se a
  // opção salva não existe mais, cai na primeira disponível.
  const [printingId, setPrintingIdState] = useState<string | null>(() => {
    return loadChoices()[size]?.printingId ?? null;
  });
  const [finishingId, setFinishingIdState] = useState<string | null>(() => {
    return loadChoices()[size]?.finishingId ?? null;
  });

  // Quando troca o `size`, recarrega escolha salva
  useEffect(() => {
    const c = loadChoices()[size];
    setPrintingIdState(c?.printingId ?? null);
    setFinishingIdState(c?.finishingId ?? null);
  }, [size]);

  // Se a opção salva não existir nas opções carregadas, cai na primeira
  useEffect(() => {
    if (printingOptions.length === 0) return;
    if (!printingId || !printingOptions.some((p) => p.id === printingId)) {
      setPrintingIdState(printingOptions[0].id);
    }
  }, [printingOptions, printingId]);

  useEffect(() => {
    if (finishingOptions.length === 0) return;
    // null = "Sem acabamento" sempre é válido
    if (finishingId !== null && !finishingOptions.some((f) => f.id === finishingId)) {
      setFinishingIdState(null);
    }
  }, [finishingOptions, finishingId]);

  const selectedPrinting = useMemo(
    () => printingOptions.find((p) => p.id === printingId) ?? null,
    [printingOptions, printingId],
  );
  const selectedFinishing = useMemo(
    () => finishingOptions.find((f) => f.id === finishingId) ?? NO_FINISHING,
    [finishingOptions, finishingId],
  );

  const setPrintingId = (id: string) => {
    setPrintingIdState(id);
    saveChoice(size, id, finishingId);
  };
  const setFinishingId = (id: string | "__none__") => {
    const next = id === "__none__" ? null : id;
    setFinishingIdState(next);
    saveChoice(size, printingId, next);
  };

  const total = (selectedPrinting?.total ?? 0) + selectedFinishing.price_per_sheet;
  const isLoading = printingQ.isLoading || finishingQ.isLoading;

  return {
    printingOptions,
    finishingOptions,
    selectedPrinting,
    selectedFinishing,
    setPrintingId,
    setFinishingId,
    total,
    isLoading,
    missing: !selectedPrinting && !isLoading ? "missing-printing" : null,
  };
}
