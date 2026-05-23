import type { ArtStatus, V3Item, V3ThirdItem } from "../types";
import { genId } from "../types";

export const ART_LABEL: Record<ArtStatus, string> = {
  ready: "Cliente envia pronta",
  ajuste: "Ajuste (até 5min)",
  facil: "Fácil (5–10min)",
  moderada: "Moderada (10–20min)",
  elaborada: "Elaborada (20–30min)",
  terceirizada: "Terceirizada (>30min)",
};

export const ART_SHORT: Record<ArtStatus, string> = {
  ready: "Pronta",
  ajuste: "Ajuste 5min",
  facil: "Fácil 10min",
  moderada: "Moderada 20min",
  elaborada: "Elaborada 30min",
  terceirizada: "Terceirizada",
};

/** Itens que exigem resposta de arte. */
export function requiresArt(it: V3Item): boolean {
  return it.kind === "print" || it.kind === "cv" || it.kind === "booklet" || it.kind === "label";
}

/** Carimba art_status nos itens print-like / cv. Outros itens passam intactos. */
export function stampArt<T extends V3Item>(items: T[], art: ArtStatus | null): T[] {
  if (!art) return items;
  return items.map((it) =>
    requiresArt(it) ? ({ ...it, art_status: art } as T) : it,
  );
}

/** Cria um V3ThirdItem para arte terceirizada associado ao bundle do item. */
export function makeArtThirdParty(value: number, bundleId: string | null): V3ThirdItem | null {
  const v = Number(value) || 0;
  if (v <= 0) return null;
  return {
    id: genId(),
    kind: "third",
    descricao: "Arte terceirizada",
    fornecedor: "Arte (terceiro)",
    custo: v,
    margem_pct: 0,
    quantidade: 1,
    art_status: "terceirizada",
    ...(bundleId ? { bundle_id: bundleId } : {}),
  };
}
