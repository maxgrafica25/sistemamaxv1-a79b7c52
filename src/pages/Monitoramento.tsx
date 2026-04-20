import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, RefreshCw, Plus, Trash2, ExternalLink, Trophy, AlertTriangle, Wifi, WifiOff, Layers, Target, Flame, ShoppingCart, Sparkles, BookOpen } from "lucide-react";
import NovoSiteDialog from "@/components/monitoramento/NovoSiteDialog";
import CatalogoProdutosDialog from "@/components/monitoramento/CatalogoProdutosDialog";
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ProdutoCatalogo } from "@/lib/produtoCatalogo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Site = {
  id: string;
  nome_produto: string;
  categoria: string;
  url_completa: string;
  seletor_css: string;
  preco_atual: number | null;
  preco_anterior: number | null;
  fornecedor_nome: string | null;
  ativo: boolean;
  timestamp_check: string | null;
  updated_at: string;
  metodo_coleta?: string;
  tipo_fonte?: string;
  produto_catalogo_id?: string | null;
  scrape_status?: string | null;
  scrape_error?: string | null;
  scrape_source?: string | null;
};

type Tier = {
  id: string;
  site_id: string;
  quantidade: number;
  preco_total: number;
  preco_unitario: number;
  preco_anterior: number | null;
  atualizado_em: string;
};

type HistoricoPonto = { criado_em: string; valor: number };
type HistoricoTier = { tier_id: string; site_id: string; quantidade: number; valor_total: number; valor_unitario: number; criado_em: string };

type Alerta = {
  id: string;
  site_id: string;
  mensagem: string;
  prioridade: string;
  preco_novo: number | null;
  preco_antigo: number | null;
  lida: boolean;
  created_at: string;
  variacao_pct?: number | null;
  quantidade?: number | null;
  fornecedor_nome?: string | null;
  produto_nome?: string | null;
};

const formatBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const QTD_OPTIONS = [1, 10, 50, 100, 500, 1000, 2000, 5000];

// Para uma quantidade-alvo, retorna o tier aplicável (maior quantidade <= alvo).
// Se nada bate, retorna o menor tier disponível.
const getTierForQty = (siteTiers: Tier[], qty: number): Tier | null => {
  if (!siteTiers.length) return null;
  const sorted = [...siteTiers].sort((a, b) => a.quantidade - b.quantidade);
  const eligible = sorted.filter((t) => t.quantidade <= qty);
  return eligible.length ? eligible[eligible.length - 1] : sorted[0];
};

// Normaliza nome de produto para agrupar produtos equivalentes entre fornecedores.
// Regras:
//  - lowercase, sem acentos, sem pontuação
//  - gramaturas próximas (diferença <= 15g/m²) viram a mesma "faixa" (ex: 80/90 → "g80-90")
//  - dimensões próximas (diferença <= 1cm em cada lado) viram a mesma faixa
//    (ex: 10x14 e 10x15 → "10x14-15")
//  - palavras genéricas removidas
const STOPWORDS = new Set([
  "panfleto", "panfletos", "flyer", "flyers", "folder", "folders",
  "cartao", "cartoes", "visita", "impressao", "impressoes",
  "couche", "couché", "papel", "frente", "verso", "fv", "4x4", "4x0", "1x0", "1x1",
  "colorido", "preto", "branco", "pb", "fosco", "brilho", "brilhante",
  "com", "sem", "de", "do", "da", "em", "para", "the", "a", "o",
  "un", "und", "unidade", "unidades", "mil", "milheiro",
]);

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const productKey = (rawName: string): string => {
  const name = stripAccents((rawName || "").toLowerCase());

  // Captura gramatura (ex: 90g, 90 g/m2, 90gsm)
  const gMatch = name.match(/(\d{2,3})\s*g(?:sm|\/m2|\/m²)?/);
  let gramKey = "";
  if (gMatch) {
    const g = parseInt(gMatch[1], 10);
    // Bucket de 15g/m² (75-89 → "g80", 90-104 → "g95", etc.)
    // Mas para couché 80 e 90 ficarem juntos: usar bucket que cobre faixa próxima.
    // Solução: agrupar em janelas de 20g centradas em múltiplos de 10.
    const bucket = Math.round(g / 20) * 20; // 80,90 → 80 ou 100. 80→80, 90→100. ruim.
    // Melhor: round((g+5)/15)*15 mantém 80→90, 90→90, 115→120 etc.
    const bucket2 = Math.round((g + 5) / 15) * 15;
    gramKey = `g${bucket2}`;
    void bucket;
  }

  // Captura dimensões (ex: 10x14, 10x15cm, 14x21)
  const dimMatch = name.match(/(\d{1,3})\s*x\s*(\d{1,3})\s*(?:cm|mm)?/);
  let dimKey = "";
  if (dimMatch) {
    const a = parseInt(dimMatch[1], 10);
    const b = parseInt(dimMatch[2], 10);
    // Bucket de 2cm: 14 e 15 → 14, 10 → 10
    const ba = Math.floor(a / 2) * 2;
    const bb = Math.floor(b / 2) * 2;
    dimKey = `d${Math.min(ba, bb)}x${Math.max(ba, bb)}`;
  }

  // Tokens restantes (sem stopwords, sem números puros)
  const tokens = name
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t) && !/^\d+(g|cm|mm)?$/.test(t) && !/^\d+x\d+$/.test(t))
    .sort();

  return [...tokens, dimKey, gramKey].filter(Boolean).join("|");
};

// Para cada tier (a partir do 2º), calcula o % de queda no preço unitário vs faixa anterior.
// Retorna o índice/tier com o maior salto (sweet spot).
const findSweetSpot = (siteTiers: Tier[]): { tier: Tier; dropPct: number } | null => {
  if (siteTiers.length < 2) return null;
  const sorted = [...siteTiers].sort((a, b) => a.quantidade - b.quantidade);
  let best: { tier: Tier; dropPct: number } | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const prev = Number(sorted[i - 1].preco_unitario);
    const curr = Number(sorted[i].preco_unitario);
    if (prev > 0 && curr < prev) {
      const drop = ((prev - curr) / prev) * 100;
      if (!best || drop > best.dropPct) best = { tier: sorted[i], dropPct: drop };
    }
  }
  return best;
};

// Paleta determinística por fornecedor (cores HSL fixas para boa distinção visual).
const SUPPLIER_PALETTE = [
  { bg: "hsl(217 91% 60% / 0.12)", border: "hsl(217 91% 50%)", text: "hsl(217 91% 35%)", solid: "hsl(217 91% 50%)" }, // azul
  { bg: "hsl(270 70% 60% / 0.12)", border: "hsl(270 70% 50%)", text: "hsl(270 70% 35%)", solid: "hsl(270 70% 50%)" }, // roxo
  { bg: "hsl(142 70% 45% / 0.12)", border: "hsl(142 70% 38%)", text: "hsl(142 70% 25%)", solid: "hsl(142 70% 38%)" }, // verde
  { bg: "hsl(25 95% 53% / 0.14)", border: "hsl(25 95% 50%)", text: "hsl(25 95% 32%)", solid: "hsl(25 95% 50%)" },     // laranja
  { bg: "hsl(340 82% 55% / 0.12)", border: "hsl(340 82% 48%)", text: "hsl(340 82% 33%)", solid: "hsl(340 82% 48%)" }, // rosa/magenta
  { bg: "hsl(190 85% 42% / 0.14)", border: "hsl(190 85% 36%)", text: "hsl(190 85% 22%)", solid: "hsl(190 85% 36%)" }, // ciano
  { bg: "hsl(48 95% 50% / 0.18)", border: "hsl(40 90% 45%)", text: "hsl(38 90% 28%)", solid: "hsl(40 90% 45%)" },     // amarelo
  { bg: "hsl(0 70% 55% / 0.12)", border: "hsl(0 70% 48%)", text: "hsl(0 70% 35%)", solid: "hsl(0 70% 48%)" },         // vermelho
];

const supplierHash = (name: string | null | undefined): number => {
  const key = (name || "—").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash;
};

const getSupplierColor = (name: string | null | undefined) =>
  SUPPLIER_PALETTE[supplierHash(name) % SUPPLIER_PALETTE.length];

/**
 * Atribui cores únicas a uma lista de fornecedores, evitando colisões de hash.
 * Se dois nomes caem no mesmo slot, o segundo desliza para o próximo livre.
 * Quando há mais fornecedores do que cores na paleta, volta a permitir repetição.
 */
const assignUniqueSupplierColors = (
  names: Array<string | null | undefined>,
): Map<string, typeof SUPPLIER_PALETTE[number]> => {
  const result = new Map<string, typeof SUPPLIER_PALETTE[number]>();
  const used = new Set<number>();
  const ordered = Array.from(new Set(names.map((n) => (n || "—").trim().toLowerCase())));
  for (const key of ordered) {
    let idx = supplierHash(key) % SUPPLIER_PALETTE.length;
    if (used.size < SUPPLIER_PALETTE.length) {
      let tries = 0;
      while (used.has(idx) && tries < SUPPLIER_PALETTE.length) {
        idx = (idx + 1) % SUPPLIER_PALETTE.length;
        tries++;
      }
    }
    used.add(idx);
    result.set(key, SUPPLIER_PALETTE[idx]);
  }
  return result;
};

const colorFor = (
  map: Map<string, typeof SUPPLIER_PALETTE[number]>,
  name: string | null | undefined,
) => map.get((name || "—").trim().toLowerCase()) || getSupplierColor(name);

export default function Monitoramento() {
  const [sites, setSites] = useState<Site[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [historicos, setHistoricos] = useState<Record<string, HistoricoPonto[]>>({});
  const [historicoTiers, setHistoricoTiers] = useState<HistoricoTier[]>([]);
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [filterProduto, setFilterProduto] = useState<string>("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [openCatalogo, setOpenCatalogo] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [qtdAlvo, setQtdAlvo] = useState<number>(100);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const fetchAll = async () => {
    const [sitesRes, tiersRes, alertasRes, histRes, histTiersRes, catRes] = await Promise.all([
      supabase.from("sites_monitorados").select("*").order("created_at", { ascending: false }),
      supabase.from("site_precos_tiers").select("*").order("quantidade", { ascending: true }),
      supabase.from("alertas_precos").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("historico_precos").select("*").order("criado_em", { ascending: true }).limit(2000),
      supabase.from("historico_precos_tiers").select("*").order("criado_em", { ascending: false }).limit(3000),
      supabase.from("produtos_catalogo").select("*").order("nome_canonico"),
    ]);
    if (sitesRes.data) setSites(sitesRes.data as Site[]);
    if (tiersRes.data) setTiers(tiersRes.data as Tier[]);
    if (alertasRes.data) setAlertas(alertasRes.data as Alerta[]);
    if (histTiersRes.data) setHistoricoTiers(histTiersRes.data as HistoricoTier[]);
    if (catRes.data) setProdutosCatalogo(catRes.data as ProdutoCatalogo[]);
    if (histRes.data) {
      const grouped: Record<string, HistoricoPonto[]> = {};
      for (const h of histRes.data as any[]) {
        (grouped[h.site_id] ||= []).push({ criado_em: h.criado_em, valor: Number(h.valor) });
      }
      setHistoricos(grouped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel("monitoramento")
      .on("postgres_changes", { event: "*", schema: "public", table: "sites_monitorados" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_precos_tiers" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_precos" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "historico_precos" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "historico_precos_tiers" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos_catalogo" }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tiersBySite = useMemo(() => {
    const map: Record<string, Tier[]> = {};
    tiers.forEach((t) => (map[t.site_id] ||= []).push(t));
    return map;
  }, [tiers]);

  // Mínimos históricos por tier_id (menor valor já registrado em historico_precos_tiers).
  const minHistByTier = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of historicoTiers) {
      const cur = map[h.tier_id];
      if (cur == null || Number(h.valor_total) < cur) map[h.tier_id] = Number(h.valor_total);
    }
    return map;
  }, [historicoTiers]);

  // Último histórico anterior (excluindo o registro mais recente que pode ser o atual) por tier_id.
  // Usado para calcular "queda vs último histórico".
  const prevHistByTier = useMemo(() => {
    const grouped: Record<string, HistoricoTier[]> = {};
    for (const h of historicoTiers) (grouped[h.tier_id] ||= []).push(h);
    const map: Record<string, number> = {};
    for (const tid in grouped) {
      const arr = grouped[tid].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
      // arr[0] = mais recente; queremos o anterior se houver mais de 1.
      if (arr.length >= 2) map[tid] = Number(arr[1].valor_total);
    }
    return map;
  }, [historicoTiers]);

  const categorias = useMemo(
    () => Array.from(new Set(sites.map((s) => s.categoria))).sort(),
    [sites]
  );

  const sitesFiltrados = useMemo(() => {
    const search = stripAccents((searchTerm || "").toLowerCase()).trim();
    return sites.filter((s) => {
      if (filterCategoria !== "all" && s.categoria !== filterCategoria) return false;
      if (filterProduto !== "all" && (s.produto_catalogo_id || "") !== filterProduto) return false;
      if (search) {
        const haystack = stripAccents(`${s.nome_produto} ${s.fornecedor_nome || ""}`.toLowerCase());
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [sites, filterCategoria, filterProduto, searchTerm]);

  const grupos = useMemo(() => {
    const map = new Map<string, Site[]>();
    sitesFiltrados.forEach((s) => {
      const arr = map.get(s.categoria) || [];
      arr.push(s);
      map.set(s.categoria, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sitesFiltrados]);

  // Agrupa sites por (produto_catalogo_id || nome_produto) + fornecedor_nome,
  // mesclando tiers de múltiplos sites do MESMO fornecedor para o MESMO produto canônico.
  // Cada "grupo de comparativo" representa um card único.
  type CompTier = Tier & { sourceSiteId: string; sourceUrl: string | null };
  type CompGroup = {
    key: string;
    nome: string;
    fornecedor: string | null;
    categoria: string;
    sites: Site[]; // todos os sites mesclados (para footer/links/sync)
    mergedTiers: CompTier[]; // tiers únicos por quantidade, ordenados crescente
    latestCheck: string | null;
    representative: Site; // site mais "rico" (com mais tiers ou mais recente) p/ exibição
  };
  const gruposComparativoPorCategoria = useMemo(() => {
    const nomeCat: Record<string, string> = {};
    for (const p of produtosCatalogo) nomeCat[p.id] = p.nome_canonico;

    const out = new Map<string, CompGroup[]>(); // categoria → grupos

    for (const [cat, items] of grupos) {
      const groupMap = new Map<string, CompGroup>();
      for (const s of items) {
        const prodKey = s.produto_catalogo_id ? `cat:${s.produto_catalogo_id}` : `name:${s.nome_produto}`;
        const fornKey = (s.fornecedor_nome || "—").trim().toLowerCase();
        const key = `${prodKey}__${fornKey}`;
        const nomeExibicao = (s.produto_catalogo_id && nomeCat[s.produto_catalogo_id]) || s.nome_produto;
        const siteTiers = (tiersBySite[s.id] || []).map<CompTier>((t) => ({
          ...t,
          sourceSiteId: s.id,
          sourceUrl: s.url_completa,
        }));
        const cur = groupMap.get(key);
        if (cur) {
          cur.sites.push(s);
          cur.mergedTiers.push(...siteTiers);
          if (s.timestamp_check && (!cur.latestCheck || s.timestamp_check > cur.latestCheck)) {
            cur.latestCheck = s.timestamp_check;
          }
        } else {
          groupMap.set(key, {
            key,
            nome: nomeExibicao,
            fornecedor: s.fornecedor_nome,
            categoria: cat,
            sites: [s],
            mergedTiers: siteTiers,
            latestCheck: s.timestamp_check,
            representative: s,
          });
        }
      }
      // Dedup tiers por quantidade (menor preço unitário vence) e ordena crescente.
      const finalGroups: CompGroup[] = [];
      for (const g of groupMap.values()) {
        const byQty = new Map<number, CompTier>();
        for (const t of g.mergedTiers) {
          const cur = byQty.get(t.quantidade);
          if (!cur || Number(t.preco_unitario) < Number(cur.preco_unitario)) {
            byQty.set(t.quantidade, t);
          }
        }
        g.mergedTiers = Array.from(byQty.values()).sort((a, b) => a.quantidade - b.quantidade);
        // Escolher representative: o site com mais tiers (ou o primeiro)
        g.representative = g.sites.reduce((best, s) => {
          const lenS = (tiersBySite[s.id] || []).length;
          const lenB = (tiersBySite[best.id] || []).length;
          return lenS > lenB ? s : best;
        }, g.sites[0]);
        finalGroups.push(g);
      }
      out.set(cat, finalGroups);
    }
    return Array.from(out.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [grupos, tiersBySite, produtosCatalogo]);

  // Para a quantidade-alvo, calcula menor preço unitário POR CATEGORIA (entre fornecedores).
  const minUnitPriceByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [cat, items] of grupos) {
      let min: number | null = null;
      for (const s of items) {
        const t = getTierForQty(tiersBySite[s.id] || [], qtdAlvo);
        if (t && (min == null || Number(t.preco_unitario) < min)) min = Number(t.preco_unitario);
      }
      if (min != null) map[cat] = min;
    }
    return map;
  }, [grupos, tiersBySite, qtdAlvo]);

  // Quantidades realmente disponíveis nos tiers dos sites que passam pelos filtros
  // ativos (produto/categoria/busca). Usado para limitar o dropdown "Comparar para"
  // e evitar mostrar quantidades inexistentes para o produto selecionado.
  const qtdOptionsDisponiveis = useMemo(() => {
    const search = stripAccents(searchTerm.toLowerCase().trim());
    const set = new Set<number>();
    for (const s of sites) {
      if (filterProduto !== "all" && (s.produto_catalogo_id || "") !== filterProduto) continue;
      if (filterCategoria !== "all" && s.categoria !== filterCategoria) continue;
      if (search) {
        const haystack = stripAccents(`${s.nome_produto} ${s.fornecedor_nome || ""}`.toLowerCase());
        if (!haystack.includes(search)) continue;
      }
      for (const t of tiersBySite[s.id] || []) set.add(t.quantidade);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [sites, tiersBySite, filterProduto, filterCategoria, searchTerm]);

  // Se a quantidade-alvo atual não existe nas opções disponíveis, ajusta automaticamente
  // para a mais próxima (preferindo a maior <= alvo, ou a menor disponível).
  // qtdAlvo === 0 representa "Todas as unidades" e nunca é ajustado.
  useEffect(() => {
    if (qtdAlvo === 0) return;
    if (!qtdOptionsDisponiveis.length) return;
    if (qtdOptionsDisponiveis.includes(qtdAlvo)) return;
    const menorOuIgual = [...qtdOptionsDisponiveis].filter((q) => q <= qtdAlvo).pop();
    setQtdAlvo(menorOuIgual ?? qtdOptionsDisponiveis[0]);
  }, [qtdOptionsDisponiveis, qtdAlvo]);

  // Agrupa sites por produto normalizado (mesmo produto entre fornecedores).
  // Aplica filtro de busca pelo nome do produto.
  const oportunidades = useMemo(() => {
    type OfertaFornecedor = {
      site: Site;
      tier: Tier;
      precoUnit: number;
      precoTotal: number;
      isMinHist: boolean;
    };
    type GrupoProduto = {
      key: string;
      nomeExibicao: string;
      ofertas: OfertaFornecedor[];
      melhor: OfertaFornecedor;
      economiaPct: number; // melhor vs pior
    };

    const search = stripAccents(searchTerm.toLowerCase().trim());
    const groups = new Map<string, { nome: string; ofertas: OfertaFornecedor[] }>();

    // Mapa rápido: id_catalogo → nome canônico (para exibição)
    const nomeCatalogo: Record<string, string> = {};
    for (const p of produtosCatalogo) nomeCatalogo[p.id] = p.nome_canonico;

    for (const s of sites) {
      // Filtro de produto canônico (dropdown)
      if (filterProduto !== "all") {
        if ((s.produto_catalogo_id || "") !== filterProduto) continue;
      }
      // Filtro de busca: aceita se o termo aparecer no nome (ou no fornecedor)
      if (search) {
        const haystack = stripAccents(`${s.nome_produto} ${s.fornecedor_nome || ""}`.toLowerCase());
        if (!haystack.includes(search)) continue;
      }
      const siteTiers = tiersBySite[s.id] || [];
      // qtdAlvo === 0 → "Todas as unidades": considera todos os tiers do site.
      // Caso contrário, só ofertas com tier EXATO para a quantidade alvo.
      const tiersConsiderados = qtdAlvo === 0
        ? siteTiers
        : siteTiers.filter((t) => Number(t.quantidade) === Number(qtdAlvo));
      if (!tiersConsiderados.length) continue;

      // Chave de agrupamento: usa o produto_catalogo_id quando disponível,
      // cai para a normalização heurística (`productKey`) para registros antigos.
      const key = s.produto_catalogo_id
        ? `cat:${s.produto_catalogo_id}`
        : productKey(s.nome_produto);
      if (!key) continue;

      const nomeExibicao = (s.produto_catalogo_id && nomeCatalogo[s.produto_catalogo_id])
        || s.nome_produto;

      for (const tier of tiersConsiderados) {
        const isMinHist = minHistByTier[tier.id] != null
          && Number(tier.preco_total) <= minHistByTier[tier.id];

        const oferta: OfertaFornecedor = {
          site: s,
          tier,
          precoUnit: Number(tier.preco_unitario),
          precoTotal: Number(tier.preco_total),
          isMinHist,
        };
        const cur = groups.get(key);
        if (cur) cur.ofertas.push(oferta);
        else groups.set(key, { nome: nomeExibicao, ofertas: [oferta] });
      }
    }

    const result: GrupoProduto[] = [];
    for (const [key, g] of groups) {
      // Para cada fornecedor (site), pega só a MELHOR oferta dele neste grupo
      // (caso o mesmo fornecedor apareça mais de uma vez).
      // Em modo "Todas as unidades", agrupa por fornecedor + quantidade do tier
      // para preservar uma linha por faixa de cada fornecedor.
      const porFornecedor = new Map<string, OfertaFornecedor>();
      for (const o of g.ofertas) {
        const fid = qtdAlvo === 0
          ? `${o.site.fornecedor_nome || o.site.id}::${o.tier.quantidade}`
          : (o.site.fornecedor_nome || o.site.id);
        const cur = porFornecedor.get(fid);
        if (!cur || o.precoTotal < cur.precoTotal) porFornecedor.set(fid, o);
      }
      const ofertasUnicas = Array.from(porFornecedor.values())
        .sort((a, b) => a.precoTotal - b.precoTotal);
      if (!ofertasUnicas.length) continue;
      const melhor = ofertasUnicas[0];
      const pior = ofertasUnicas[ofertasUnicas.length - 1];
      const economiaPct = pior.precoUnit > 0 && pior.precoUnit > melhor.precoUnit
        ? ((pior.precoUnit - melhor.precoUnit) / pior.precoUnit) * 100
        : 0;
      result.push({ key, nomeExibicao: g.nome, ofertas: ofertasUnicas, melhor, economiaPct });
    }

    // Ordena: maior economia primeiro (oportunidades reais), depois por nome
    return result.sort((a, b) => {
      if (b.economiaPct !== a.economiaPct) return b.economiaPct - a.economiaPct;
      return a.nomeExibicao.localeCompare(b.nomeExibicao);
    });
  }, [sites, tiersBySite, minHistByTier, qtdAlvo, searchTerm, filterProduto, produtosCatalogo]);



  const lastSync = useMemo(() => {
    const dates = sites.map((s) => s.timestamp_check).filter(Boolean) as string[];
    if (!dates.length) return null;
    return dates.sort().reverse()[0];
  }, [sites]);

  const workerOnline = useMemo(() => {
    if (!lastSync) return false;
    return Date.now() - new Date(lastSync).getTime() < 1000 * 60 * 60 * 26;
  }, [lastSync]);

  const handleDelete = async (s: Site) => {
    if (!confirm(`Excluir "${s.nome_produto}"? Histórico e alertas relacionados também serão removidos.`)) return;
    const { error } = await supabase.from("sites_monitorados").delete().eq("id", s.id);
    if (error) return toast.error(`Falha ao excluir: ${error.message}`);
    setSites((prev) => prev.filter((x) => x.id !== s.id));
    toast.success("Site removido");
  };

  const handleToggle = async (s: Site) => {
    await supabase.from("sites_monitorados").update({ ativo: !s.ativo }).eq("id", s.id);
    setSites((prev) => prev.map((x) => (x.id === s.id ? { ...x, ativo: !s.ativo } : x)));
  };

  // Função pura: sincroniza UM site via edge function scrape-prices.
  // Pronta para ser chamada tanto pelo loop manual quanto por um futuro cron.
  const syncSite = async (siteId: string) => {
    const { data, error } = await supabase.functions.invoke("scrape-prices", {
      body: { site_id: siteId },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Falha ao sincronizar");
    return data;
  };

  const handleSyncOne = async (siteId: string) => {
    setSyncingId(siteId);
    try {
      await syncSite(siteId);
      toast.success("Sincronização concluída");
    } catch (e: any) {
      toast.error(e.message || "Falha ao sincronizar");
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    let ok = 0;
    let fail = 0;
    try {
      const ativos = sites.filter((s) => s.ativo);
      for (const s of ativos) {
        try {
          await syncSite(s.id);
          ok++;
        } catch {
          fail++;
        }
      }
      toast.success(`Sincronização: ${ok} ok · ${fail} falha(s)`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao disparar sincronização");
    } finally {
      setSyncing(false);
    }
  };

  const markAlertasLidos = async () => {
    const ids = alertas.filter((a) => !a.lida).map((a) => a.id);
    if (!ids.length) return;
    await supabase.from("alertas_precos").update({ lida: true }).in("id", ids);
  };

  const alertasNaoLidos = alertas.filter((a) => !a.lida).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            Monitoramento de Preços
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe preços de concorrentes e fornecedores em tempo real
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            {workerOnline ? (
              <Wifi className="h-4 w-4" style={{ color: "hsl(var(--success))" }} />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">
              {lastSync
                ? `Última sync: ${formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: ptBR })}`
                : "Aguardando primeira sincronização"}
            </span>
          </div>

          <Button variant="outline" onClick={handleSyncAll} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Atualizar todos
          </Button>

          <Button variant="outline" onClick={() => setOpenCatalogo(true)}>
            <BookOpen className="h-4 w-4" />
            Catálogo de Produtos
          </Button>

          <Button onClick={() => setOpenDialog(true)}>
            <Plus className="h-4 w-4" />
            Novo Site
          </Button>
          <NovoSiteDialog open={openDialog} onOpenChange={setOpenDialog} onCreated={fetchAll} categoriasExistentes={categorias} />
          <CatalogoProdutosDialog
            open={openCatalogo}
            onOpenChange={setOpenCatalogo}
            onChanged={fetchAll}
            getSupplierColor={getSupplierColor}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Sites monitorados</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{sites.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Categorias</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{categorias.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Alertas não lidos</CardDescription></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {alertasNaoLidos}
              {alertasNaoLidos > 0 && <AlertTriangle className="h-5 w-5" style={{ color: "hsl(var(--warning))" }} />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Oportunidades</CardDescription></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {oportunidades.length}
              {oportunidades.length > 0 && <Sparkles className="h-5 w-5 text-primary" />}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label>Categoria:</Label>
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Produto:</Label>
          <Select value={filterProduto} onValueChange={setFilterProduto}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {produtosCatalogo
                .filter((p) => sites.some((s) => s.produto_catalogo_id === p.id))
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome_canonico}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Comparar para:</Label>
          <Select value={String(qtdAlvo)} onValueChange={(v) => setQtdAlvo(Number(v))}>
            <SelectTrigger className="w-44">
              {/* Renderização manual do label para evitar inconsistência com SelectValue do Radix */}
              <span>{qtdAlvo === 0 ? "Todas as unidades" : `${qtdAlvo.toLocaleString("pt-BR")} un`}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Todas as unidades</SelectItem>
              {(qtdOptionsDisponiveis.length ? qtdOptionsDisponiveis : QTD_OPTIONS).map((q) => (
                <SelectItem key={q} value={String(q)}>{q.toLocaleString("pt-BR")} un</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <Label className="shrink-0">Buscar:</Label>
          <Input
            placeholder="Ex: panfleto, cartão, A4..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="oportunidades">
        <TabsList>
          <TabsTrigger value="oportunidades">
            <Sparkles className="h-4 w-4 mr-1" /> Oportunidades {oportunidades.length > 0 && `(${oportunidades.length})`}
          </TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          <TabsTrigger value="tabela">Tabela completa</TabsTrigger>
          <TabsTrigger value="alertas">Alertas {alertasNaoLidos > 0 && `(${alertasNaoLidos})`}</TabsTrigger>
        </TabsList>

        {/* === OPORTUNIDADES === Comparação produto-a-produto entre fornecedores === */}
        <TabsContent value="oportunidades" className="space-y-3">
          {oportunidades.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground space-y-2">
              <p>Nenhum produto encontrado para comparar.</p>
              <p className="text-xs">
                {searchTerm
                  ? "Tente ajustar a busca ou cadastre o mesmo produto em mais de um fornecedor."
                  : "Cadastre o mesmo produto em fornecedores diferentes para ver a comparação automática."}
              </p>
            </CardContent></Card>
          )}
          {oportunidades.map((grupo) => {
            const temConcorrencia = grupo.ofertas.length > 1;
            const corMap = assignUniqueSupplierColors(grupo.ofertas.map((o) => o.site.fornecedor_nome));
            const melhorCor = colorFor(corMap, grupo.ofertas[0]?.site.fornecedor_nome);
            return (
              <Card key={grupo.key} className="border-l-4" style={{ borderLeftColor: melhorCor.solid }}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{grupo.nomeExibicao}</CardTitle>
                      <CardDescription>
                        {grupo.ofertas.length} {grupo.ofertas.length === 1 ? "fornecedor" : "fornecedores"} · comparando para{" "}
                        <strong>{qtdAlvo === 0 ? "todas as unidades" : `${qtdAlvo.toLocaleString("pt-BR")} un`}</strong>
                      </CardDescription>
                    </div>
                    {temConcorrencia && grupo.economiaPct > 0 && (
                      <Badge style={{ backgroundColor: "hsl(var(--success))", color: "hsl(var(--success-foreground))" }}>
                        <Sparkles className="h-3 w-3 mr-0.5" /> Economia até {grupo.economiaPct.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded border divide-y">
                    {grupo.ofertas.map((oferta, idx) => {
                      const isMelhor = idx === 0;
                      const cor = colorFor(corMap, oferta.site.fornecedor_nome);
                      return (
                        <div
                          key={`${oferta.site.id}::${oferta.tier.id}`}
                          className={`flex flex-wrap items-center gap-3 px-3 py-2 border-l-4 ${isMelhor ? "bg-success/5" : ""}`}
                          style={{ borderLeftColor: cor.solid }}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isMelhor ? (
                              <Trophy className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--success))" }} />
                            ) : (
                              <span className="h-4 w-4 shrink-0 text-center text-xs text-muted-foreground">{idx + 1}</span>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate flex items-center flex-wrap gap-1">
                                <Badge
                                  className="text-[11px] font-semibold border"
                                  style={{ backgroundColor: cor.bg, color: cor.text, borderColor: cor.border }}
                                >
                                  {oferta.site.fornecedor_nome || "—"}
                                </Badge>
                                {isMelhor && temConcorrencia && (
                                  <Badge className="text-[10px]" style={{ backgroundColor: "hsl(var(--success))", color: "hsl(var(--success-foreground))" }}>
                                    Mais barato
                                  </Badge>
                                )}
                                {oferta.isMinHist && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    <Flame className="h-3 w-3 mr-0.5" /> Mín. histórico
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {oferta.site.nome_produto} · faixa {oferta.tier.quantidade}un
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold tabular-nums">{formatBRL(oferta.precoTotal)}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">{formatBRL(oferta.precoUnit)}/un</div>
                          </div>
                          {oferta.site.url_completa && (
                            <Button size="sm" variant={isMelhor ? "default" : "outline"} asChild>
                              <a href={oferta.site.url_completa} target="_blank" rel="noreferrer">
                                <ShoppingCart className="h-4 w-4" /> Comprar
                              </a>
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>


        {/* === COMPARATIVO === */}
        <TabsContent value="comparativo" className="space-y-6">
          {gruposComparativoPorCategoria.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              {loading ? "Carregando..." : "Nenhum site monitorado ainda."}
            </CardContent></Card>
          )}
          {gruposComparativoPorCategoria.map(([cat, compGroups]) => {
            const minPrecoUnit = minUnitPriceByCategory[cat];

            // União de quantidades entre todos os fornecedores do MESMO produto canônico.
            // Mapeia: prodKey -> Set<quantidade>
            const qtdsUniaoPorProduto = new Map<string, number[]>();
            for (const g of compGroups) {
              const prodKey = g.key.split("__")[0]; // remove sufixo do fornecedor
              const set = new Set(qtdsUniaoPorProduto.get(prodKey) || []);
              for (const t of g.mergedTiers) set.add(t.quantidade);
              qtdsUniaoPorProduto.set(prodKey, Array.from(set).sort((a, b) => a - b));
            }

            // Economia potencial: para qtdAlvo, min/max entre fornecedores da categoria.
            let economiaInfo: { min: number; max: number; fornMin: string; fornMax: string; pct: number } | null = null;
            if (qtdAlvo !== 0) {
              const ofertas: { forn: string; total: number }[] = [];
              for (const g of compGroups) {
                const t = getTierForQty(g.mergedTiers, qtdAlvo);
                if (t) ofertas.push({ forn: g.fornecedor || "—", total: Number(t.preco_total) });
              }
              if (ofertas.length >= 2) {
                ofertas.sort((a, b) => a.total - b.total);
                const min = ofertas[0];
                const max = ofertas[ofertas.length - 1];
                if (max.total > min.total) {
                  economiaInfo = {
                    min: min.total,
                    max: max.total,
                    fornMin: min.forn,
                    fornMax: max.forn,
                    pct: ((max.total - min.total) / max.total) * 100,
                  };
                }
              }
            }

            return (
              <div key={cat} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold capitalize">{cat}</h3>
                  <span className="text-xs text-muted-foreground">
                    Comparando para <strong>{qtdAlvo === 0 ? "todas as unidades" : `${qtdAlvo.toLocaleString("pt-BR")} un`}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {compGroups.map((g) => {
                    const mergedTiers = g.mergedTiers;
                    const repr = g.representative;
                    const hist = historicos[repr.id] || [];
                    const hasTiers = mergedTiers.length > 0;
                    const tierAlvo = getTierForQty(mergedTiers, qtdAlvo);
                    const sweet = findSweetSpot(mergedTiers);
                    const isMin = hasTiers && tierAlvo != null && minPrecoUnit != null
                      && Number(tierAlvo.preco_unitario) === minPrecoUnit && compGroups.length > 1;
                    const trend = !hasTiers && repr.preco_anterior != null && repr.preco_atual != null
                      ? repr.preco_atual - repr.preco_anterior : 0;
                    const isMerged = g.sites.length > 1;

                    // Lista união (todas as quantidades existentes para o produto entre fornecedores)
                    const prodKey = g.key.split("__")[0];
                    const qtdsUniao = qtdsUniaoPorProduto.get(prodKey) || [];
                    const tiersByQty = new Map(mergedTiers.map((t) => [t.quantidade, t]));

                    return (
                      <Card key={g.key} className={isMin ? "border-2" : ""} style={isMin ? { borderColor: "hsl(var(--success))" } : undefined}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="text-base truncate">{g.nome}</CardTitle>
                              <CardDescription className="flex items-center gap-1.5 flex-wrap">
                                <span>{g.fornecedor || "—"}</span>
                                <Badge variant="outline" className="text-[10px] h-4 px-1">
                                  <Layers className="h-2.5 w-2.5 mr-0.5" />playwright
                                </Badge>
                                {isMerged && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                                    {g.sites.length} links
                                  </Badge>
                                )}
                              </CardDescription>
                            </div>
                            {isMin && qtdAlvo !== 0 && (
                              <Badge style={{ backgroundColor: "hsl(var(--success))", color: "hsl(var(--success-foreground))" }}>
                                <Trophy className="h-3 w-3" /> Melhor p/ {qtdAlvo}un
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {hasTiers ? (
                            <>
                              {tierAlvo && qtdAlvo !== 0 && (
                                <div className="rounded bg-muted/50 px-2 py-1.5 text-xs flex items-center justify-between">
                                  <span className="text-muted-foreground">Para {qtdAlvo}un usa faixa <strong className="text-foreground">{tierAlvo.quantidade}un</strong>:</span>
                                  <span className="font-semibold">{formatBRL(Number(tierAlvo.preco_unitario))}/un</span>
                                </div>
                              )}
                              <div className="rounded border divide-y">
                                {qtdsUniao.map((qty) => {
                                  const t = tiersByQty.get(qty);
                                  if (!t) {
                                    // Faixa não disponível neste fornecedor
                                    const disponiveis = mergedTiers.map((mt) => mt.quantidade.toLocaleString("pt-BR")).join(", ");
                                    return (
                                      <div
                                        key={`miss-${qty}`}
                                        className="flex items-center justify-between text-xs px-2 py-1.5 opacity-60"
                                        title={`Este fornecedor não oferece esta quantidade. Disponíveis: ${disponiveis}`}
                                      >
                                        <span className="font-mono text-muted-foreground">{qty.toLocaleString("pt-BR")}un</span>
                                        <Badge variant="secondary" className="text-[10px] font-normal">
                                          Faixa não disponível
                                        </Badge>
                                      </div>
                                    );
                                  }
                                  const tTrend = t.preco_anterior != null ? t.preco_total - Number(t.preco_anterior) : 0;
                                  const isSweet = sweet?.tier.id === t.id;
                                  const isMinHist = minHistByTier[t.id] != null && Number(t.preco_total) <= minHistByTier[t.id];
                                  const isTargetTier = tierAlvo?.id === t.id;
                                  return (
                                    <div key={t.id} className={`flex items-center justify-between text-xs px-2 py-1.5 ${isTargetTier ? "bg-primary/5" : ""}`}>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-muted-foreground">{t.quantidade.toLocaleString("pt-BR")}un</span>
                                        {isSweet && <Target className="h-3 w-3" style={{ color: "hsl(var(--primary))" }} />}
                                        {isMinHist && <Flame className="h-3 w-3" style={{ color: "hsl(var(--success))" }} />}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">{formatBRL(Number(t.preco_unitario))}/un</span>
                                        <span className="font-semibold tabular-nums">{formatBRL(Number(t.preco_total))}</span>
                                        {tTrend !== 0 && (
                                          <span className="flex items-center" style={{ color: tTrend < 0 ? "hsl(var(--success))" : "hsl(var(--destructive))" }}>
                                            {tTrend < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                          </span>
                                        )}
                                        {isMerged && t.sourceUrl && (
                                          <a
                                            href={t.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Abrir link específico desta faixa"
                                            className="text-muted-foreground hover:text-primary"
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold">{formatBRL(repr.preco_atual)}</span>
                              {trend !== 0 && (
                                <span className="text-xs flex items-center" style={{ color: trend < 0 ? "hsl(var(--success))" : "hsl(var(--destructive))" }}>
                                  {trend < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                  {formatBRL(Math.abs(trend))}
                                </span>
                              )}
                            </div>
                          )}

                          {!hasTiers && hist.length > 1 && (
                            <div className="h-20">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={hist}>
                                  <XAxis dataKey="criado_em" hide />
                                  <YAxis hide domain={["dataMin", "dataMax"]} />
                                  <RechartsTooltip
                                    formatter={(v: number) => formatBRL(v)}
                                    labelFormatter={(l) => new Date(l).toLocaleDateString("pt-BR")}
                                  />
                                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                            {isMerged ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="flex items-center gap-1 hover:underline truncate">
                                    <ExternalLink className="h-3 w-3 shrink-0" /> Ver sites ({g.sites.length})
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="max-w-sm">
                                  {g.sites.map((sub, i) => (
                                    <DropdownMenuItem key={sub.id} asChild>
                                      <a href={sub.url_completa || "#"} target="_blank" rel="noreferrer" className="cursor-pointer">
                                        <ExternalLink className="h-3 w-3 mr-2 shrink-0" />
                                        <span className="truncate">Link {i + 1} · {sub.nome_produto}</span>
                                      </a>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : repr.url_completa ? (
                              <a href={repr.url_completa} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline truncate">
                                <ExternalLink className="h-3 w-3 shrink-0" /> Ver site
                              </a>
                            ) : <span />}
                            <div className="flex items-center gap-2 shrink-0">
                              <span>
                                {g.latestCheck
                                  ? formatDistanceToNow(new Date(g.latestCheck), { addSuffix: true, locale: ptBR })
                                  : "Nunca"}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => g.sites.forEach((s) => handleSyncOne(s.id))}
                                disabled={g.sites.some((s) => syncingId === s.id)}
                                title={isMerged ? `Sincronizar ${g.sites.length} sites` : "Sincronizar"}
                              >
                                <RefreshCw className={`h-3 w-3 ${g.sites.some((s) => syncingId === s.id) ? "animate-spin" : ""}`} />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="tabela">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Coleta</TableHead>
                    <TableHead className="text-right">Atual</TableHead>
                    <TableHead className="text-right">Tiers</TableHead>
                    <TableHead>Última checagem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sitesFiltrados.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.nome_produto}</TableCell>
                      <TableCell><Badge variant="outline">{s.categoria}</Badge></TableCell>
                      <TableCell>{s.fornecedor_nome || "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">playwright</Badge></TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(s.preco_atual)}</TableCell>
                      <TableCell className="text-right font-mono">{(tiersBySite[s.id] || []).length || "—"}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1">
                          <span>{s.timestamp_check ? new Date(s.timestamp_check).toLocaleString("pt-BR") : "—"}</span>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">
                              playwright
                            </Badge>
                            {s.scrape_status === "error" && s.scrape_error && (
                              <Badge variant="destructive" className="text-[10px] py-0 px-1 h-4" title={s.scrape_error}>
                                erro
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={s.ativo ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => handleToggle(s)}
                        >
                          {s.ativo ? "Ativo" : "Pausado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(s)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sitesFiltrados.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum site monitorado.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas" className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={markAlertasLidos} disabled={!alertasNaoLidos}>
              Marcar todos como lidos
            </Button>
          </div>
          {alertas.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Nenhum alerta registrado ainda.
            </CardContent></Card>
          )}
          {alertas.map((a) => (
            <Card key={a.id} className={a.lida ? "opacity-60" : ""}>
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-5 w-5" style={{ color: a.prioridade === "alta" ? "hsl(var(--destructive))" : "hsl(var(--warning))" }} />
                  <div>
                    <div className="font-medium">{a.mensagem}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBRL(a.preco_antigo)} → {formatBRL(a.preco_novo)} ·{" "}
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                </div>
                <Badge variant={a.prioridade === "alta" ? "destructive" : "secondary"}>
                  {a.prioridade}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
