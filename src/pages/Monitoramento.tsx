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
import { TrendingUp, TrendingDown, RefreshCw, Plus, Trash2, ExternalLink, Trophy, AlertTriangle, Wifi, WifiOff, Layers, Target, Flame, ShoppingCart, Sparkles } from "lucide-react";
import NovoSiteDialog from "@/components/monitoramento/NovoSiteDialog";
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export default function Monitoramento() {
  const [sites, setSites] = useState<Site[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [historicos, setHistoricos] = useState<Record<string, HistoricoPonto[]>>({});
  const [historicoTiers, setHistoricoTiers] = useState<HistoricoTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [qtdAlvo, setQtdAlvo] = useState<number>(100);

  const fetchAll = async () => {
    const [sitesRes, tiersRes, alertasRes, histRes, histTiersRes] = await Promise.all([
      supabase.from("sites_monitorados").select("*").order("created_at", { ascending: false }),
      supabase.from("site_precos_tiers").select("*").order("quantidade", { ascending: true }),
      supabase.from("alertas_precos").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("historico_precos").select("*").order("criado_em", { ascending: true }).limit(2000),
      supabase.from("historico_precos_tiers").select("*").order("criado_em", { ascending: false }).limit(3000),
    ]);
    if (sitesRes.data) setSites(sitesRes.data as Site[]);
    if (tiersRes.data) setTiers(tiersRes.data as Tier[]);
    if (alertasRes.data) setAlertas(alertasRes.data as Alerta[]);
    if (histTiersRes.data) setHistoricoTiers(histTiersRes.data as HistoricoTier[]);
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

  const sitesFiltrados = useMemo(
    () => (filterCategoria === "all" ? sites : sites.filter((s) => s.categoria === filterCategoria)),
    [sites, filterCategoria]
  );

  const grupos = useMemo(() => {
    const map = new Map<string, Site[]>();
    sitesFiltrados.forEach((s) => {
      const arr = map.get(s.categoria) || [];
      arr.push(s);
      map.set(s.categoria, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sitesFiltrados]);

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

  // Score de oportunidade por site (top 5).
  const oportunidades = useMemo(() => {
    type Opp = {
      site: Site;
      tier: Tier;
      score: number;
      quedaPct: number;
      sweetPct: number;
      vantagemPct: number;
      isMinHist: boolean;
    };
    const opps: Opp[] = [];
    for (const s of sites) {
      const siteTiers = tiersBySite[s.id] || [];
      if (!siteTiers.length) continue;
      const sweet = findSweetSpot(siteTiers);
      const targetTier = sweet?.tier || getTierForQty(siteTiers, qtdAlvo);
      if (!targetTier) continue;

      // Queda vs último histórico do tier
      const prev = prevHistByTier[targetTier.id];
      const quedaPct = prev && prev > 0 && Number(targetTier.preco_total) < prev
        ? ((prev - Number(targetTier.preco_total)) / prev) * 100
        : 0;

      const sweetPct = sweet?.dropPct || 0;

      // Vantagem vs concorrência: média da categoria para a mesma quantidade
      const sameCatSites = sites.filter((x) => x.categoria === s.categoria && x.id !== s.id);
      const concorrentesUnit: number[] = [];
      for (const c of sameCatSites) {
        const ct = getTierForQty(tiersBySite[c.id] || [], targetTier.quantidade);
        if (ct) concorrentesUnit.push(Number(ct.preco_unitario));
      }
      const mediaConc = concorrentesUnit.length
        ? concorrentesUnit.reduce((a, b) => a + b, 0) / concorrentesUnit.length
        : 0;
      const vantagemPct = mediaConc > 0 && Number(targetTier.preco_unitario) < mediaConc
        ? ((mediaConc - Number(targetTier.preco_unitario)) / mediaConc) * 100
        : 0;

      const isMinHist = minHistByTier[targetTier.id] != null
        && Number(targetTier.preco_total) <= minHistByTier[targetTier.id];

      const score = quedaPct * 0.5 + sweetPct * 0.3 + vantagemPct * 0.2;
      if (score > 0 || isMinHist) {
        opps.push({ site: s, tier: targetTier, score, quedaPct, sweetPct, vantagemPct, isMinHist });
      }
    }
    return opps.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [sites, tiersBySite, prevHistByTier, minHistByTier, qtdAlvo]);

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
    toast.success("Site removido");
  };

  const handleToggle = async (s: Site) => {
    await supabase.from("sites_monitorados").update({ ativo: !s.ativo }).eq("id", s.id);
  };

  const handleSyncOne = async (siteId: string) => {
    setSyncingId(siteId);
    try {
      const { error } = await supabase.functions.invoke("scheduled-sync-firecrawl", {
        body: { site_id: siteId },
      });
      if (error) throw error;
      toast.success("Sincronização concluída");
    } catch (e: any) {
      toast.error(e.message || "Falha ao sincronizar");
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("scheduled-sync-firecrawl", { body: {} });
      if (error) throw error;
      toast.success(`Sincronização: ${data?.processed ?? 0} sites processados`);
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

          <Button onClick={() => setOpenDialog(true)}>
            <Plus className="h-4 w-4" />
            Novo Site
          </Button>
          <NovoSiteDialog open={openDialog} onOpenChange={setOpenDialog} onCreated={fetchAll} />
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
          <Label>Comparar para:</Label>
          <Select value={String(qtdAlvo)} onValueChange={(v) => setQtdAlvo(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QTD_OPTIONS.map((q) => (
                <SelectItem key={q} value={String(q)}>{q.toLocaleString("pt-BR")} un</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        {/* === OPORTUNIDADES === */}
        <TabsContent value="oportunidades" className="space-y-3">
          {oportunidades.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground space-y-2">
              <p>Nenhuma oportunidade no momento.</p>
              <p className="text-xs">
                Clique em <strong>Atualizar todos</strong> para coletar preços. As oportunidades aparecem após 2+ atualizações
                (precisamos de histórico para detectar quedas).
              </p>
            </CardContent></Card>
          )}
          {oportunidades.map((opp, idx) => (
            <Card key={opp.site.id + opp.tier.id} className="border-l-4" style={{ borderLeftColor: "hsl(var(--primary))" }}>
              <CardContent className="py-4 flex flex-wrap items-center gap-4 justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{opp.site.nome_produto}</div>
                    <div className="text-xs text-muted-foreground">
                      {opp.site.fornecedor_nome || "—"} · <span className="font-mono">{opp.tier.quantidade} un</span> ·{" "}
                      <span className="font-semibold text-foreground">{formatBRL(Number(opp.tier.preco_total))}</span>{" "}
                      ({formatBRL(Number(opp.tier.preco_unitario))}/un)
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {opp.quedaPct > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          <TrendingDown className="h-3 w-3 mr-0.5" /> Caiu {opp.quedaPct.toFixed(1)}%
                        </Badge>
                      )}
                      {opp.sweetPct > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Target className="h-3 w-3 mr-0.5" /> Sweet spot {opp.sweetPct.toFixed(1)}%
                        </Badge>
                      )}
                      {opp.vantagemPct > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Trophy className="h-3 w-3 mr-0.5" /> {opp.vantagemPct.toFixed(1)}% abaixo da média
                        </Badge>
                      )}
                      {opp.isMinHist && (
                        <Badge style={{ backgroundColor: "hsl(var(--success))", color: "hsl(var(--success-foreground))" }} className="text-[10px]">
                          <Flame className="h-3 w-3 mr-0.5" /> Mínimo histórico
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {opp.site.url_completa && (
                  <Button asChild>
                    <a href={opp.site.url_completa} target="_blank" rel="noreferrer">
                      <ShoppingCart className="h-4 w-4" /> Comprar agora
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* === COMPARATIVO === */}
        <TabsContent value="comparativo" className="space-y-6">
          {grupos.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              {loading ? "Carregando..." : "Nenhum site monitorado ainda."}
            </CardContent></Card>
          )}
          {grupos.map(([cat, items]) => {
            const minPrecoUnit = minUnitPriceByCategory[cat];
            return (
              <div key={cat} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold capitalize">{cat}</h3>
                  <span className="text-xs text-muted-foreground">
                    Comparando para <strong>{qtdAlvo.toLocaleString("pt-BR")} un</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((s) => {
                    const siteTiers = tiersBySite[s.id] || [];
                    const hist = historicos[s.id] || [];
                    const hasTiers = siteTiers.length > 0;
                    const tierAlvo = getTierForQty(siteTiers, qtdAlvo);
                    const sweet = findSweetSpot(siteTiers);
                    const isMin = hasTiers && tierAlvo != null && minPrecoUnit != null
                      && Number(tierAlvo.preco_unitario) === minPrecoUnit && items.length > 1;
                    const trend = !hasTiers && s.preco_anterior != null && s.preco_atual != null
                      ? s.preco_atual - s.preco_anterior : 0;

                    return (
                      <Card key={s.id} className={isMin ? "border-2" : ""} style={isMin ? { borderColor: "hsl(var(--success))" } : undefined}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="text-base truncate">{s.nome_produto}</CardTitle>
                              <CardDescription className="flex items-center gap-1.5 flex-wrap">
                                <span>{s.fornecedor_nome || "—"}</span>
                                {s.metodo_coleta === "firecrawl" && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1"><Layers className="h-2.5 w-2.5 mr-0.5" />auto</Badge>
                                )}
                              </CardDescription>
                            </div>
                            {isMin && (
                              <Badge style={{ backgroundColor: "hsl(var(--success))", color: "hsl(var(--success-foreground))" }}>
                                <Trophy className="h-3 w-3" /> Melhor p/ {qtdAlvo}un
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {hasTiers ? (
                            <>
                              {tierAlvo && (
                                <div className="rounded bg-muted/50 px-2 py-1.5 text-xs flex items-center justify-between">
                                  <span className="text-muted-foreground">Para {qtdAlvo}un usa faixa <strong className="text-foreground">{tierAlvo.quantidade}un</strong>:</span>
                                  <span className="font-semibold">{formatBRL(Number(tierAlvo.preco_unitario))}/un</span>
                                </div>
                              )}
                              <div className="rounded border divide-y">
                                {siteTiers.map((t) => {
                                  const tTrend = t.preco_anterior != null ? t.preco_total - Number(t.preco_anterior) : 0;
                                  const isSweet = sweet?.tier.id === t.id;
                                  const isMinHist = minHistByTier[t.id] != null && Number(t.preco_total) <= minHistByTier[t.id];
                                  const isTargetTier = tierAlvo?.id === t.id;
                                  return (
                                    <div key={t.id} className={`flex items-center justify-between text-xs px-2 py-1.5 ${isTargetTier ? "bg-primary/5" : ""}`}>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-muted-foreground">{t.quantidade}un</span>
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
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold">{formatBRL(s.preco_atual)}</span>
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
                            {s.url_completa ? (
                              <a href={s.url_completa} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline truncate">
                                <ExternalLink className="h-3 w-3 shrink-0" /> Ver site
                              </a>
                            ) : <span />}
                            <div className="flex items-center gap-2 shrink-0">
                              <span>
                                {s.timestamp_check
                                  ? formatDistanceToNow(new Date(s.timestamp_check), { addSuffix: true, locale: ptBR })
                                  : "Nunca"}
                              </span>
                              {s.metodo_coleta === "firecrawl" && (
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSyncOne(s.id)} disabled={syncingId === s.id}>
                                  <RefreshCw className={`h-3 w-3 ${syncingId === s.id ? "animate-spin" : ""}`} />
                                </Button>
                              )}
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
                      <TableCell><Badge variant="secondary" className="text-xs">{s.metodo_coleta || "url_simples"}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(s.preco_atual)}</TableCell>
                      <TableCell className="text-right font-mono">{(tiersBySite[s.id] || []).length || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {s.timestamp_check ? new Date(s.timestamp_check).toLocaleString("pt-BR") : "—"}
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
