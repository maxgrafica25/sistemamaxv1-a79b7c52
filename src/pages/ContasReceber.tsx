import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Loader2, CheckCircle2, ShieldAlert, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsFinanceiro } from "@/hooks/useIsFinanceiro";
import { useNavigate } from "react-router-dom";
import { formatBRL, methodLabel, PAYMENT_METHOD_OPTIONS } from "@/lib/erp/payment-terms";
import { installmentVisualStatus, INSTALLMENT_STATUS_META, type ReceivableStatus } from "@/lib/erp/status";
import { cn } from "@/lib/utils";

interface Installment {
  id: string;
  account_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  notes: string | null;
}

interface Account {
  id: string;
  client_name: string;
  description: string;
  total_value: number;
  status: ReceivableStatus;
  category: string;
  installments: Installment[];
}

export default function ContasReceber() {
  const isFinanceiro = useIsFinanceiro();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState<Installment | null>(null);
  const [paidDate, setPaidDate] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidMethod, setPaidMethod] = useState("pix");
  const [paidNotes, setPaidNotes] = useState("");
  const [savingPay, setSavingPay] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: accs } = await supabase
      .from("accounts_receivable")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: inst } = await supabase
      .from("accounts_receivable_installments")
      .select("*")
      .order("installment_number");

    const grouped: Account[] = (accs ?? []).map((a: any) => ({
      ...a,
      total_value: Number(a.total_value),
      installments: (inst ?? [])
        .filter((i: any) => i.account_id === a.id)
        .map((i: any) => ({ ...i, amount: Number(i.amount), paid_amount: i.paid_amount != null ? Number(i.paid_amount) : null })),
    }));
    setAccounts(grouped);
    setLoading(false);
  }, []);

  useEffect(() => { if (isFinanceiro) fetchData(); else setLoading(false); }, [fetchData, isFinanceiro]);

  useEffect(() => {
    if (!isFinanceiro) return;
    const ch = supabase
      .channel("accounts_receivable_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts_receivable" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts_receivable_installments" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData, isFinanceiro]);

  // KPIs
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const allInst = accounts.flatMap((a) => a.installments.map((i) => ({ ...i, accountStatus: a.status })));
  const kpis = {
    today: allInst.filter((i) => !i.paid_at && i.due_date === today.toISOString().slice(0, 10)).reduce((s, i) => s + i.amount, 0),
    week: allInst.filter((i) => !i.paid_at && i.due_date >= today.toISOString().slice(0, 10) && i.due_date <= weekEnd.toISOString().slice(0, 10)).reduce((s, i) => s + i.amount, 0),
    overdue: allInst.filter((i) => !i.paid_at && i.due_date < today.toISOString().slice(0, 10) && i.accountStatus !== "cancelado").reduce((s, i) => s + i.amount, 0),
    receivedMonth: allInst.filter((i) => i.paid_at && new Date(i.paid_at) >= monthStart).reduce((s, i) => s + (i.paid_amount ?? i.amount), 0),
  };

  const filtered = accounts.filter((a) =>
    !search || a.client_name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase()),
  );

  const openPay = (inst: Installment) => {
    setPaying(inst);
    setPaidDate(new Date().toISOString().slice(0, 10));
    setPaidAmount(inst.amount);
    setPaidMethod(inst.payment_method ?? "pix");
    setPaidNotes("");
    setPayOpen(true);
  };

  const confirmPay = async () => {
    if (!paying) return;
    setSavingPay(true);
    const { error } = await supabase
      .from("accounts_receivable_installments")
      .update({
        paid_at: new Date(paidDate + "T12:00:00").toISOString(),
        paid_amount: paidAmount,
        payment_method: paidMethod,
        notes: paidNotes || null,
      })
      .eq("id", paying.id);
    setSavingPay(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Baixa registrada.");
    setPayOpen(false);
  };

  if (!isFinanceiro) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h2 className="text-lg font-semibold">Acesso restrito</h2>
              <p className="text-sm text-muted-foreground mt-1">Apenas o Financeiro pode acessar esta área.</p>
            </div>
            <Button onClick={() => navigate("/")} variant="outline">Voltar ao Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          Contas a Receber
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhamento de recebimentos por parcela.</p>
      </div>

      {/* Mini-dashboard */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {[
          { label: "A receber hoje", value: kpis.today, color: "text-amber-600" },
          { label: "A receber 7 dias", value: kpis.week, color: "text-blue-600" },
          { label: "Vencidos", value: kpis.overdue, color: "text-rose-600" },
          { label: "Recebido no mês", value: kpis.receivedMonth, color: "text-emerald-600" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={cn("text-2xl font-bold mt-1", k.color)}>{formatBRL(k.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente ou descrição…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Nenhuma conta a receber.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-0">
                <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-semibold">{a.client_name}</div>
                    <div className="text-xs text-muted-foreground">{a.description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={a.status === "pago" ? "default" : "secondary"}>
                      {a.status === "pago" ? "Pago" : a.status === "parcial" ? "Parcial" : a.status === "cancelado" ? "Cancelado" : "Aberto"}
                    </Badge>
                    <span className="font-semibold">{formatBRL(a.total_value)}</span>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {a.installments.map((i) => {
                    const vs = installmentVisualStatus(i.paid_at, i.due_date, a.status);
                    const meta = INSTALLMENT_STATUS_META[vs];
                    return (
                      <div key={i.id} className={cn("flex items-center justify-between gap-3 px-4 py-2.5 text-sm", meta.rowClass)}>
                        <div className="flex items-center gap-3">
                          <span className={cn("h-2 w-2 rounded-full", meta.dotClass)} />
                          <span className="font-mono text-xs text-muted-foreground">#{i.installment_number}</span>
                          <span>{new Date(i.due_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                          <span className="text-muted-foreground hidden sm:inline">· {methodLabel(i.payment_method)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{formatBRL(i.amount)}</span>
                          {i.paid_at ? (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                              Pago {new Date(i.paid_at).toLocaleDateString("pt-BR")}
                            </Badge>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => openPay(i)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Dar baixa
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de baixa */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="mb-1.5 block">Data do pagamento</Label>
              <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Valor recebido</Label>
              <Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Forma</Label>
              <Select value={paidMethod} onValueChange={setPaidMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Observação</Label>
              <Input value={paidNotes} onChange={(e) => setPaidNotes(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={savingPay}>Cancelar</Button>
            <Button onClick={confirmPay} disabled={savingPay}>
              {savingPay && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
