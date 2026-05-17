import type { Acabamento, TipoMidia } from "./engine";

export interface MediaOrderRow {
  acabamento_id: string;
  tipo_midia: TipoMidia;
  sort_order: number;
  visivel: boolean;
}

/**
 * Anexa o mapa de override (sort_order/visivel) por tipo de mídia em cada acabamento.
 * Mantém compatibilidade: acabamentos sem override usam o sort_order global e ficam visíveis.
 */
export function attachMediaOrder(acabs: Acabamento[], orders: MediaOrderRow[]): Acabamento[] {
  if (!orders.length) return acabs;
  const byId = new Map<string, NonNullable<Acabamento["mediaOrder"]>>();
  for (const o of orders) {
    const m = byId.get(o.acabamento_id) ?? {};
    m[o.tipo_midia] = { sort_order: Number(o.sort_order) || 0, visivel: !!o.visivel };
    byId.set(o.acabamento_id, m);
  }
  return acabs.map((a) => {
    const m = byId.get(a.id);
    return m ? { ...a, mediaOrder: m } : a;
  });
}

/**
 * Filtra e ordena acabamentos para uma mídia específica.
 * - Aplica compatibilidade `tipos_midia_compativeis`.
 * - Aplica visibilidade por mídia (default visível).
 * - Ordena pela ordem por mídia (com fallback no sort_order global).
 */
export function filterAndSortForMidia(acabs: Acabamento[], tipo: TipoMidia | null): Acabamento[] {
  if (!tipo) return acabs;
  return acabs
    .filter((a) => a.tipos_midia_compativeis.includes(tipo))
    .map((a) => {
      const ovr = a.mediaOrder?.[tipo];
      return {
        a,
        order: ovr?.sort_order ?? a.sort_order ?? 0,
        visible: ovr?.visivel ?? true,
      };
    })
    .filter((x) => x.visible)
    .sort((x, y) => x.order - y.order)
    .map((x) => x.a);
}
