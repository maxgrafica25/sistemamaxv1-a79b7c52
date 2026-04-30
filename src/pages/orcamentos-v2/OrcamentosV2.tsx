import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, ClipboardList, Loader2, FileDown, CheckCircle2, XCircle,
  Bookmark, Link2, BookmarkCheck, ChevronDown, FileText,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeRadar } from "@/components/orcamentos-v2/RealtimeRadar";
import { CloneQuoteButton } from "@/components/orcamentos-v2/CloneQuoteButton";
import { CreateVersionButton } from "@/components/orcamentos-v2/CreateVersionButton";
import { GenerateOPButton } from "@/components/orcamentos-v2/GenerateOPButton";
import { EngagementPopover } from "@/components/orcamentos-v2/EngagementPopover";
import { UseTemplateDialog } from "@/components/orcamentos-v2/UseTemplateDialog";
import { BulkActionBar } from "@/components/orcamentos-v2/BulkActionBar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles } from "lucide-react";
import { Lock } from "lucide-react";
import { parseOptions } from "@/lib/quotes-v2/options";
import { buildStatsMap, computeTemperature, type EngagementStats, type Temperature } from "@/lib/quotes-v2/temperature";
import type { EngagementEventType } from "@/lib/quotes-v2/tracking";

interface QuoteRow {
  id: string;
  quote_number: string;
  client: string;
  client_phone: string | null;
  product: string;
  value: number;
  status: string;
  date: string;
  view_count: number | null;
  last_viewed_at: string | null;
  is_template: boolean | null;
  options: unknown;
  version: number | null;
  is_locked: boolean | null;
  parent_quote_id: string | null;
}

const statusBadge = (status: string) => {
  if (status === "approved") return <Badge className="bg-green-500 hover:bg-green-600">Aprovado</Badge>;
  if (status === "partial") return <Badge className="bg-blue-500 hover:bg-blue-600">Parcial</Badge>;
  if (status === "rejected") return <Badge className="bg-red-500 hover:bg-red-600">Recusado</Badge>;
  if (status === "pending") return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pendente</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OrcamentosV2() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, EngagementStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [tempFilter, setTempFilter] = useState<string>("all");
  const [useTemplateOpen, setUseTemplateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    const [quotesRes, eventsRes] = await Promise.all([
      supabase
        .from("quotes")
        .select("id, quote_number, client, client_phone, product, value, status, date, view_count, last_viewed_at, is_template, options, version, is_locked, parent_quote_id")
        .order("created_at", { ascending: false }),
      supabase
        .from("quote_engagement_events")
        .select("quote_id, event_type, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    setQuotes((quotesRes.data as QuoteRow[]) || []);
    const map = buildStatsMap(
      (eventsRes.data ?? []).map((r) => ({
        quote_id: r.quote_id,
        event_type: r.event_type as EngagementEventType,
        metadata: (r.metadata as Record<string, unknown>) ?? {},
        created_at: r.created_at,
      })),
    );
    setStatsMap(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const handleApprove = async (id: string) => {
    await supabase.from("quotes").update({ status: "approved" }).eq("id", id);
    toast.success("Orçamento aprovado!");
    fetchQuotes();
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Motivo da recusa:");
    if (!reason) return;
    await supabase
      .from("quotes")
      .update({ status: "rejected", rejection_reason: reason })
      .eq("id", id);
    toast.success("Orçamento recusado");
    fetchQuotes();
  };

  const handleToggleTemplate = async (q: QuoteRow) => {
    const newVal = !q.is_template;
    await supabase.from("quotes").update({ is_template: newVal }).eq("id", q.id);
    toast.success(newVal ? "Salvo como modelo pronto" : "Removido dos modelos prontos");
    fetchQuotes();
  };

  const handleCopyPublicLink = (quoteNumber: string) => {
    const url = `${window.location.origin}/p/${quoteNumber}`;
    navigator.clipboard.writeText(url);
    toast.success("Link público copiado!");
  };

  const handleGeneratePDF = (q: QuoteRow) => {
    const html = `<html><head><title>Orçamento ${q.quote_number}</title>
      <style>body{font-family:Arial;padding:40px;color:#333}h1{border-bottom:2px solid #ddd;padding-bottom:10px}.total{font-size:24px;font-weight:bold;text-align:right;margin-top:30px}</style></head>
      <body><h1>Orçamento Nº ${q.quote_number}</h1>
      <p><strong>Cliente:</strong> ${q.client}</p>
      <p><strong>Produto:</strong> ${q.product}</p>
      <p><strong>Data:</strong> ${new Date(q.date).toLocaleDateString("pt-BR")}</p>
      <div class="total">VALOR: ${formatBRL(q.value)}</div></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      const matchSearch =
        q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
        q.client.toLowerCase().includes(search.toLowerCase()) ||
        q.product.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === "all" ||
        (filter === "templates" && q.is_template) ||
        filter === q.status;
      let matchTemp = true;
      if (tempFilter !== "all") {
        const t: Temperature = computeTemperature(statsMap.get(q.id));
        if (tempFilter === "hot_or_live") matchTemp = t === "hot" || t === "live";
        else matchTemp = t === tempFilter;
      }
      return matchSearch && matchFilter && matchTemp;
    });
  }, [quotes, search, filter, tempFilter, statsMap]);

  const stats = {
    total: quotes.length,
    pending: quotes.filter((q) => q.status === "pending").length,
    approved: quotes.filter((q) => q.status === "approved").length,
    viewed: quotes.filter((q) => (q.view_count ?? 0) > 0).length,
    templates: quotes.filter((q) => q.is_template).length,
  };

  const selectableFiltered = filtered.filter((q) => !q.is_locked);
  const allFilteredSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((q) => selectedIds.has(q.id));
  const someFilteredSelected =
    selectableFiltered.some((q) => selectedIds.has(q.id)) && !allFilteredSelected;

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) selectableFiltered.forEach((q) => next.add(q.id));
      else selectableFiltered.forEach((q) => next.delete(q.id));
      return next;
    });
  };

  const selectedQuotes = quotes.filter((q) => selectedIds.has(q.id));
  const selectedTotal = selectedQuotes.reduce((s, q) => s + (q.value || 0), 0);

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { data, error } = await supabase.rpc("delete_quotes_bulk", { p_ids: ids });
      if (error) throw error;
      const result = data as { deleted_count: number; skipped: Array<{ number?: string; reason: string }> };
      if (result.deleted_count > 0) {
        toast.success(`${result.deleted_count} orçamento(s) excluído(s)`);
      }
      if (result.skipped && result.skipped.length > 0) {
        toast.warning(
          `${result.skipped.length} não foram excluídos: ${result.skipped
            .map((s) => `${s.number ?? ""} (${s.reason})`)
            .join(", ")}`,
        );
      }
      setSelectedIds(new Set());
      setConfirmDeleteOpen(false);
      fetchQuotes();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir orçamentos");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <RealtimeRadar />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Orçamentos V2
            <Badge variant="outline" className="ml-2 text-xs">Sandbox</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Versão experimental com viewer público, ancoragem e radar realtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Incluir Orçamento
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => navigate("/orcamentos-v2/novo")} className="gap-2 py-2.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Orçamento em branco</span>
                  <span className="text-[11px] text-muted-foreground">Começar do zero</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-normal">
                A partir de modelo
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setUseTemplateOpen(true)} className="gap-2 py-2.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Escolher modelo pronto…</span>
                  <span className="text-[11px] text-muted-foreground">Reutilizar um orçamento salvo</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground px-1">
        <span><strong className="text-foreground">{stats.total}</strong> orçamentos</span>
        <span><strong className="text-yellow-500">{stats.pending}</strong> pendentes</span>
        <span><strong className="text-green-500">{stats.approved}</strong> aprovados</span>
        <span><strong className="text-primary">{stats.viewed}</strong> visualizados</span>
        <span><strong className="text-foreground">{stats.templates}</strong> modelos prontos</span>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
            <SelectItem value="templates">Modelos Prontos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tempFilter} onValueChange={setTempFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas temperaturas</SelectItem>
            <SelectItem value="live">🟠 Online agora</SelectItem>
            <SelectItem value="hot_or_live">🔥 Quentes</SelectItem>
            <SelectItem value="warm">🔵 Interesse</SelectItem>
            <SelectItem value="cold">⚪ Frios</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Lista V2</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm font-medium text-muted-foreground">
                  <th className="pb-3 pl-4">Nº</th>
                  <th className="pb-3">Cliente</th>
                  <th className="pb-3">Produto/Serviço</th>
                  <th className="pb-3">Valor</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Engajamento</th>
                  <th className="pb-3 pr-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => {
                  const opts = parseOptions(q.options);
                  const qStats = statsMap.get(q.id);
                  return (
                    <tr
                      key={q.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/orcamentos-v2/${q.id}`)}
                    >
                      <td className="py-4 pl-4 text-sm font-medium text-primary">
                        <div className="flex items-center gap-2 flex-wrap">
                          {q.quote_number}
                          {(q.version ?? 1) > 1 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                              v{q.version}
                            </Badge>
                          )}
                          {q.is_locked && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5 text-muted-foreground">
                              <Lock className="h-2.5 w-2.5" />
                              Travado
                            </Badge>
                          )}
                          {q.is_template && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5">
                              <BookmarkCheck className="h-2.5 w-2.5" />
                              Modelo
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-sm">{q.client}</td>
                      <td className="py-4 text-sm">
                        {q.product}
                        {opts.length >= 2 && (
                          <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1">
                            {opts.length} opções
                          </Badge>
                        )}
                      </td>
                      <td className="py-4 text-sm font-medium">{formatBRL(q.value)}</td>
                      <td className="py-4">{statusBadge(q.status)}</td>
                      <td className="py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        <EngagementPopover
                          quoteId={q.id}
                          quoteNumber={q.quote_number}
                          clientName={q.client}
                          clientPhone={q.client_phone}
                          stats={qStats}
                        />
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title="Copiar link público"
                            onClick={() => handleCopyPublicLink(q.quote_number)}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title={q.is_template ? "Remover dos modelos prontos" : "Salvar como modelo pronto"}
                            onClick={() => handleToggleTemplate(q)}
                          >
                            <Bookmark className={`h-3.5 w-3.5 ${q.is_template ? "fill-primary text-primary" : ""}`} />
                          </Button>
                          <CloneQuoteButton
                            quoteId={q.id}
                            quoteNumber={q.quote_number}
                            onCloned={fetchQuotes}
                          />
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title="Gerar PDF"
                            onClick={() => handleGeneratePDF(q)}
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                          {q.status === "approved" && (
                            <GenerateOPButton
                              quoteId={q.id}
                              quoteNumber={q.quote_number}
                              client={q.client}
                            />
                          )}
                          {(q.status === "partial" || q.status === "approved") && !q.is_locked && (
                            <CreateVersionButton
                              quoteId={q.id}
                              quoteNumber={q.quote_number}
                              variant="ghost"
                              size="icon"
                              iconOnly
                            />
                          )}
                          {q.status === "pending" && !q.is_locked && (
                            <>
                              <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Aprovar" onClick={() => handleApprove(q.id)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Recusar" onClick={() => handleReject(q.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      Nenhum orçamento encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <UseTemplateDialog open={useTemplateOpen} onOpenChange={setUseTemplateOpen} />
    </div>
  );
}
