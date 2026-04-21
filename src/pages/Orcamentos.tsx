import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, FileText, CheckCircle2, XCircle, ArrowLeft, Loader2, FileDown, Copy, ClipboardList, Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import NewQuoteForm from "@/components/orcamentos/NewQuoteForm";
import QuoteReminderButton from "@/components/orcamentos/QuoteReminderButton";

export interface QuoteLaborStep {
  id: string;
  description: string;
  timeMinutes: number;
}

export interface QuoteMaterialItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteThirdPartyService {
  id: string;
  description: string;
  supplier: string;
  cost: number;
}

export interface Quote {
  id: string;
  quote_number: string;
  client: string;
  product: string;
  value: number;
  status: string;
  date: string;
  rejectionReason?: string;
  validity?: string;
  profitMargin?: string;
  laborSteps?: QuoteLaborStep[];
  materials?: QuoteMaterialItem[];
  thirdParty?: QuoteThirdPartyService[];
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "approved": return <Badge className="bg-green-500 hover:bg-green-600">Aprovado</Badge>;
    case "pending": return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pendente</Badge>;
    case "rejected": return <Badge className="bg-red-500 hover:bg-red-600">Recusado</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export default function Orcamentos() {
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    const { data: quotesData } = await supabase
      .from("quotes")
      .select("id, quote_number, client, product, value, status, date, rejection_reason, validity, profit_margin")
      .order("created_at", { ascending: false });
    if (quotesData) {
      const mapped: Quote[] = quotesData.map(q => ({
        id: q.id,
        quote_number: q.quote_number,
        client: q.client,
        product: q.product,
        value: q.value,
        status: q.status,
        date: q.date,
        rejectionReason: q.rejection_reason || undefined,
        validity: q.validity || undefined,
        profitMargin: q.profit_margin || undefined,
      }));
      setQuotes(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const loadQuoteDetails = async (quote: Quote) => {
    const [laborRes, matRes, tpRes] = await Promise.all([
      supabase.from("quote_labor_steps").select("id, description, time_minutes, sort_order").eq("quote_id", quote.id).order("sort_order"),
      supabase.from("quote_materials").select("id, description, quantity, unit_price, sort_order").eq("quote_id", quote.id).order("sort_order"),
      supabase.from("quote_third_party").select("id, description, supplier, cost, sort_order").eq("quote_id", quote.id).order("sort_order"),
    ]);
    return {
      ...quote,
      laborSteps: (laborRes.data || []).map(s => ({ id: s.id, description: s.description, timeMinutes: s.time_minutes })),
      materials: (matRes.data || []).map(m => ({ id: m.id, description: m.description, quantity: m.quantity, unitPrice: m.unit_price })),
      thirdParty: (tpRes.data || []).map(t => ({ id: t.id, description: t.description, supplier: t.supplier, cost: t.cost })),
    };
  };

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      quote.quote_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.product.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || quote.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleApprove = async (id: string) => {
    await supabase.from("quotes").update({ status: "approved" }).eq("id", id);
    toast.success("Orçamento aprovado!");
    fetchQuotes();
  };

  const handleReject = (quote: Quote) => {
    setSelectedQuote(quote);
    setShowDialog(true);
  };

  const confirmReject = async () => {
    if (selectedQuote && rejectionReason.trim()) {
      await supabase.from("quotes").update({ status: "rejected", rejection_reason: rejectionReason }).eq("id", selectedQuote.id);
      toast.success("Orçamento recusado");
      setShowDialog(false);
      setRejectionReason("");
      setSelectedQuote(null);
      fetchQuotes();
    } else {
      toast.error("Por favor, informe o motivo da recusa");
    }
  };

  const handleQuoteSaved = () => {
    setEditingQuote(null);
    setView("list");
    fetchQuotes();
  };

  const handleEditQuote = async (quote: Quote) => {
    const detailed = await loadQuoteDetails(quote);
    setEditingQuote(detailed);
    setView("edit");
  };

  const getNextQuoteNumber = () => {
    const year = new Date().getFullYear();
    const count = quotes.filter(q => q.quote_number.startsWith(String(year))).length;
    return `${year}-${String(count + 1).padStart(3, "0")}`;
  };

  const stats = {
    total: quotes.length,
    pending: quotes.filter(q => q.status === "pending").length,
    approved: quotes.filter(q => q.status === "approved").length,
    rejected: quotes.filter(q => q.status === "rejected").length,
    totalValue: quotes.filter(q => q.status === "approved").reduce((sum, q) => sum + q.value, 0),
  };

  if (view === "new" || view === "edit") {
    return (
      <div>
        <div className="p-6 pb-0">
          <Button variant="ghost" onClick={() => { setView("list"); setEditingQuote(null); }} className="gap-2 mb-2">
            <ArrowLeft className="h-4 w-4" /> Voltar para Orçamentos
          </Button>
        </div>
        <NewQuoteForm
          onSave={handleQuoteSaved}
          onCancel={() => { setView("list"); setEditingQuote(null); }}
          nextId={getNextQuoteNumber()}
          editingQuote={editingQuote}
          initialStep={view === "edit" ? 4 : undefined}
        />
      </div>
    );
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const handleGeneratePDFFromList = (quote: Quote) => {
    const pdfContent = `
      <html><head><title>Orçamento ${quote.quote_number}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#333}h1{color:#1a1a1a;border-bottom:2px solid #e5e5e5;padding-bottom:10px}.info{margin:20px 0}.info p{margin:4px 0}.total{font-size:24px;font-weight:bold;text-align:right;margin-top:30px}</style></head>
      <body><h1>Orçamento Nº ${quote.quote_number}</h1>
      <div class="info"><p><strong>Cliente:</strong> ${quote.client}</p><p><strong>Produto/Serviço:</strong> ${quote.product}</p><p><strong>Data:</strong> ${new Date(quote.date).toLocaleDateString("pt-BR")}</p>${quote.validity ? `<p><strong>Validade:</strong> ${quote.validity} dias</p>` : ""}</div>
      <div class="total">VALOR TOTAL: R$ ${quote.value.toFixed(2)}</div></body></html>`;
    const printWindow = window.open("", "_blank");
    if (printWindow) { printWindow.document.write(pdfContent); printWindow.document.close(); printWindow.print(); }
  };

  const handleCopyWhatsAppFromList = (quote: Quote) => {
    const message = `*Orçamento Gráfico*\n\n*Proposta Nº:* ${quote.quote_number}\n*Cliente:* ${quote.client}\n*Serviço:* ${quote.product}\n*Valor Total:* R$ ${quote.value.toFixed(2)}${quote.validity ? `\n*Validade:* ${quote.validity} dias` : ""}`;
    navigator.clipboard.writeText(message);
    toast.success("Resumo copiado para WhatsApp!");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Orçamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie e crie novos orçamentos</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setView("new")}>
          <Plus className="h-4 w-4" /> Novo Orçamento
        </Button>
      </div>

      {/* Summary line */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground px-1">
        <span><strong className="text-foreground">{stats.total}</strong> orçamentos</span>
        <span><strong className="text-yellow-500">{stats.pending}</strong> pendentes</span>
        <span><strong className="text-green-500">{stats.approved}</strong> aprovados</span>
        <span><strong className="text-red-500">{stats.rejected}</strong> recusados</span>
        <span>Valor aprovado: <strong className="text-foreground">R$ {stats.totalValue.toFixed(2)}</strong></span>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por número, cliente ou produto..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle>Lista de Orçamentos</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm font-medium text-muted-foreground">
                  <th className="pb-3 pl-4">Nº Orçamento</th><th className="pb-3">Cliente</th><th className="pb-3">Produto/Serviço</th>
                  <th className="pb-3">Valor</th><th className="pb-3">Status</th><th className="pb-3">Data</th><th className="pb-3 pr-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/50 cursor-pointer" onClick={() => handleEditQuote(quote)}>
                    <td className="py-4 pl-4 text-sm font-medium text-primary">{quote.quote_number}</td>
                    <td className="py-4 text-sm text-foreground">{quote.client}</td>
                    <td className="py-4 text-sm text-foreground">{quote.product}</td>
                    <td className="py-4 text-sm font-medium text-foreground">R$ {quote.value.toFixed(2)}</td>
                    <td className="py-4">{getStatusBadge(quote.status)}</td>
                    <td className="py-4 text-sm text-muted-foreground">{new Date(quote.date).toLocaleDateString("pt-BR")}</td>
                    <td className="py-4 pr-4">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Copiar p/ WhatsApp" onClick={() => handleCopyWhatsAppFromList(quote)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Gerar PDF" onClick={() => handleGeneratePDFFromList(quote)}>
                          <FileDown className="h-3.5 w-3.5" />
                        </Button>
                        {quote.status === "pending" && (
                          <QuoteReminderButton quoteId={quote.id} quoteNumber={quote.quote_number} clientName={quote.client} />
                        )}
                        {quote.status === "pending" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" title="Aprovar" onClick={() => handleApprove(quote.id)}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" title="Recusar" onClick={() => handleReject(quote)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredQuotes.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Nenhum orçamento encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar Orçamento</DialogTitle>
            <DialogDescription>Informe o motivo da recusa do orçamento {selectedQuote?.quote_number}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo da Recusa</Label>
              <Textarea id="reason" placeholder="Ex: Cliente não aceitou o prazo de entrega..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={confirmReject} className="bg-red-500 hover:bg-red-600">Confirmar Recusa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
