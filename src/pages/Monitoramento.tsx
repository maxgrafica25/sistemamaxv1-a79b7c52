import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, RefreshCw, Plus, Trash2, ExternalLink, Trophy, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
};

type HistoricoPonto = { criado_em: string; valor: number };

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

export default function Monitoramento() {
  const [sites, setSites] = useState<Site[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [historicos, setHistoricos] = useState<Record<string, HistoricoPonto[]>>({});
  const [loading, setLoading] = useState(true);
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState({
    nome_produto: "",
    categoria: "",
    url_completa: "",
    seletor_css: "",
    fornecedor_nome: "",
    preco_atual: "",
  });

  const fetchAll = async () => {
    const [sitesRes, alertasRes, histRes] = await Promise.all([
      supabase.from("sites_monitorados").select("*").order("created_at", { ascending: false }),
      supabase.from("alertas_precos").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("historico_precos").select("*").order("criado_em", { ascending: true }).limit(2000),
    ]);
    if (sitesRes.data) setSites(sitesRes.data as Site[]);
    if (alertasRes.data) setAlertas(alertasRes.data as Alerta[]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_precos" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "historico_precos" }, fetchAll)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Status do worker = data de sync mais recente entre todos os sites
  const lastSync = useMemo(() => {
    const dates = sites.map((s) => s.timestamp_check).filter(Boolean) as string[];
    if (!dates.length) return null;
    return dates.sort().reverse()[0];
  }, [sites]);

  const workerOnline = useMemo(() => {
    if (!lastSync) return false;
    return Date.now() - new Date(lastSync).getTime() < 1000 * 60 * 60; // 1h
  }, [lastSync]);

  const handleAdd = async () => {
    if (!form.nome_produto || !form.url_completa || !form.seletor_css || !form.categoria) {
      toast.error("Preencha nome, categoria, URL e seletor CSS");
      return;
    }
    const preco = form.preco_atual ? Number(form.preco_atual) : null;
    const { error } = await supabase.from("sites_monitorados").insert({
      nome_produto: form.nome_produto.trim(),
      categoria: form.categoria.trim().toLowerCase(),
      url_completa: form.url_completa.trim(),
      seletor_css: form.seletor_css.trim(),
      fornecedor_nome: form.fornecedor_nome.trim() || null,
      preco_atual: preco,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Site adicionado ao monitoramento");
    setForm({ nome_produto: "", categoria: "", url_completa: "", seletor_css: "", fornecedor_nome: "", preco_atual: "" });
    setOpenDialog(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("sites_monitorados").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
  };

  const handleToggle = async (s: Site) => {
    await supabase.from("sites_monitorados").update({ ativo: !s.ativo }).eq("id", s.id);
  };

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("trigger-vps-sync", { body: {} });
      if (error) throw error;
      if ((data as any)?.stub) {
        toast.info((data as any).message || "Webhook da VPS ainda não configurado");
      } else {
        toast.success("Sincronização disparada");
      }
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
      {/* Header */}
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
                ? `Worker: ${formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: ptBR })}`
                : "Worker: aguardando primeira sincronização"}
            </span>
          </div>

          <Button variant="outline" onClick={handleForceSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Forçar Update
          </Button>

          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Novo Site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Site Monitorado</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome do produto *</Label>
                  <Input
                    value={form.nome_produto}
                    onChange={(e) => setForm({ ...form, nome_produto: e.target.value })}
                    placeholder="Papel Couché 150g A4"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Categoria *</Label>
                    <Input
                      value={form.categoria}
                      onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                      placeholder="papel-couche-150"
                    />
                  </div>
                  <div>
                    <Label>Fornecedor</Label>
                    <Input
                      value={form.fornecedor_nome}
                      onChange={(e) => setForm({ ...form, fornecedor_nome: e.target.value })}
                      placeholder="Fornecedor X"
                    />
                  </div>
                </div>
                <div>
                  <Label>URL completa *</Label>
                  <Input
                    value={form.url_completa}
                    onChange={(e) => setForm({ ...form, url_completa: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>Seletor CSS do preço *</Label>
                  <Input
                    value={form.seletor_css}
                    onChange={(e) => setForm({ ...form, seletor_css: e.target.value })}
                    placeholder=".price-now, #preco, span.valor"
                  />
                </div>
                <div>
                  <Label>Preço atual (opcional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.preco_atual}
                    onChange={(e) => setForm({ ...form, preco_atual: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
                <Button onClick={handleAdd}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
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
          <CardHeader className="pb-2"><CardDescription>Status do Worker</CardDescription></CardHeader>
          <CardContent>
            <Badge variant={workerOnline ? "default" : "secondary"}>
              {workerOnline ? "Online" : "Offline"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <Label>Categoria:</Label>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="comparativo">
        <TabsList>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          <TabsTrigger value="tabela">Tabela completa</TabsTrigger>
          <TabsTrigger value="alertas">Alertas {alertasNaoLidos > 0 && `(${alertasNaoLidos})`}</TabsTrigger>
        </TabsList>

        {/* Dashboard comparativo */}
        <TabsContent value="comparativo" className="space-y-6">
          {grupos.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              {loading ? "Carregando..." : "Nenhum site monitorado ainda."}
            </CardContent></Card>
          )}
          {grupos.map(([cat, items]) => {
            const minPreco = Math.min(...items.filter((i) => i.preco_atual != null).map((i) => i.preco_atual as number));
            return (
              <div key={cat} className="space-y-3">
                <h3 className="text-lg font-semibold capitalize">{cat}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((s) => {
                    const isMin = s.preco_atual != null && s.preco_atual === minPreco && items.length > 1;
                    const trend =
                      s.preco_anterior != null && s.preco_atual != null
                        ? s.preco_atual - s.preco_anterior
                        : 0;
                    const hist = historicos[s.id] || [];
                    return (
                      <Card key={s.id} className={isMin ? "border-2" : ""} style={isMin ? { borderColor: "hsl(var(--success))" } : undefined}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base">{s.nome_produto}</CardTitle>
                              <CardDescription>{s.fornecedor_nome || "—"}</CardDescription>
                            </div>
                            {isMin && <Badge style={{ backgroundColor: "hsl(var(--success))", color: "hsl(var(--success-foreground))" }}><Trophy className="h-3 w-3" /> Melhor</Badge>}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold">{formatBRL(s.preco_atual)}</span>
                            {trend !== 0 && (
                              <span className="text-xs flex items-center" style={{ color: trend < 0 ? "hsl(var(--success))" : "hsl(var(--destructive))" }}>
                                {trend < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                {formatBRL(Math.abs(trend))}
                              </span>
                            )}
                          </div>
                          {hist.length > 1 && (
                            <div className="h-20">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={hist}>
                                  <XAxis dataKey="criado_em" hide />
                                  <YAxis hide domain={["dataMin", "dataMax"]} />
                                  <Tooltip
                                    formatter={(v: number) => formatBRL(v)}
                                    labelFormatter={(l) => new Date(l).toLocaleDateString("pt-BR")}
                                  />
                                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <a href={s.url_completa} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                              <ExternalLink className="h-3 w-3" /> Ver site
                            </a>
                            <span>
                              {s.timestamp_check
                                ? formatDistanceToNow(new Date(s.timestamp_check), { addSuffix: true, locale: ptBR })
                                : "Nunca sincronizado"}
                            </span>
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

        {/* Tabela */}
        <TabsContent value="tabela">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Atual</TableHead>
                    <TableHead className="text-right">Anterior</TableHead>
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
                      <TableCell className="text-right font-mono">{formatBRL(s.preco_atual)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{formatBRL(s.preco_anterior)}</TableCell>
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
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sitesFiltrados.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum site monitorado.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alertas */}
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
