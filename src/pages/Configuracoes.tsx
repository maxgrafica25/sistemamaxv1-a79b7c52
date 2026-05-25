import { PageHeader } from "@/components/PageHeader";
import { useState, useEffect, useCallback } from "react";
import GoogleCalendarCard from "@/components/configuracoes/GoogleCalendarCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { DotTabs } from "@/components/ui/dot-tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Info, Loader2, Cog, Download, FileJson, FileCode, RefreshCw, AlertTriangle, Database, FolderArchive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import BaseConhecimentoTab from "@/components/assistente/BaseConhecimentoTab";
import CompanyTab from "@/components/configuracoes/CompanyTab";
import VpsPackageCard from "@/components/configuracoes/VpsPackageCard";
import PageLoader from "@/components/PageLoader";

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

interface BackupRun {
  id: string;
  created_at: string;
  created_by: string | null;
  format: string;
  size_bytes: number;
  status: string;
  error_message: string | null;
  profiles?: { display_name: string } | null;
}

export default function Configuracoes() {
  const { profile, session } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [configTab, setConfigTab] = useState("empresa");

  const [hourlyRate, setHourlyRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [invoicePercentage, setInvoicePercentage] = useState("10");
  const [wastePercentage, setWastePercentage] = useState("5");
  const [collectionCostPercentage, setCollectionCostPercentage] = useState("7");
  const [defaultProfitMargin, setDefaultProfitMargin] = useState("33");
  const [taxPct, setTaxPct] = useState("10");
  const [collectionFeePct, setCollectionFeePct] = useState("7");
  const [checklistBeforeSave, setChecklistBeforeSave] = useState(true);
  const [pricingRegime, setPricingRegime] = useState<"por_fora" | "por_dentro">("por_fora");

  // Backup state
  const [backupRuns, setBackupRuns] = useState<BackupRun[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [generating, setGenerating] = useState<"sql" | "json" | "storage" | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (generating === null) { setElapsed(0); return; }
    setElapsed(0);
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [generating]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [expRes, salRes, eqRes, capRes, settingsRes] = await Promise.all([
        supabase.from("monthly_expenses").select("value"),
        supabase.from("salaries").select("salary, is_production"),
        supabase.from("equipment_depreciation").select("purchase_value, useful_life_months, residual_value"),
        supabase.from("productive_capacity").select("id, hours_per_month, production_employees").limit(1).single(),
        supabase.from("global_settings").select("id, invoice_pct, collection_pct, waste_pct, default_margin_pct, tax_pct, collection_fee_pct, credit_card_pct, checklist_before_save, pricing_regime").limit(1).single(),
      ]);
      const totalExp = (expRes.data || []).reduce((s: number, e: any) => s + e.value, 0);
      const totalSal = (salRes.data || []).reduce((s: number, e: any) => s + e.salary, 0) * 1.45;
      const totalDep = (eqRes.data || []).reduce((s: number, e: any) => s + (e.useful_life_months > 0 ? (e.purchase_value - e.residual_value) / e.useful_life_months : 0), 0);
      const cap = capRes.data;
      const prodCount = (salRes.data || []).filter((s: any) => s.is_production).length;
      const hours = cap ? prodCount * cap.hours_per_month : 0;
      setHourlyRate(hours > 0 ? (totalExp + totalSal + totalDep) / hours : 0);

      if (settingsRes.data) {
        setSettingsId(settingsRes.data.id);
        setInvoicePercentage(String(settingsRes.data.invoice_pct));
        setCollectionCostPercentage(String(settingsRes.data.collection_pct));
        setWastePercentage(String(settingsRes.data.waste_pct));
        setDefaultProfitMargin(String(settingsRes.data.default_margin_pct));
        if ((settingsRes.data as any).tax_pct !== undefined) setTaxPct(String((settingsRes.data as any).tax_pct));
        if ((settingsRes.data as any).collection_fee_pct !== undefined) setCollectionFeePct(String((settingsRes.data as any).collection_fee_pct));
        if ((settingsRes.data as any).checklist_before_save !== undefined) setChecklistBeforeSave(!!(settingsRes.data as any).checklist_before_save);
        if ((settingsRes.data as any).pricing_regime) setPricingRegime((settingsRes.data as any).pricing_regime as "por_fora" | "por_dentro");
      }
      setLoading(false);
    };
    load();
  }, []);

  const composedVariable = (parseFloat(taxPct) || 0) + (parseFloat(collectionFeePct) || 0) + (parseFloat(wastePercentage) || 0);

  const handleSave = async () => {
    setSaving(true);
    const cardFee = parseFloat(collectionFeePct) || 0;
    const data: any = {
      invoice_pct: parseFloat(invoicePercentage) || 0,
      collection_pct: cardFee,
      waste_pct: parseFloat(wastePercentage) || 0,
      default_margin_pct: parseFloat(defaultProfitMargin) || 0,
      tax_pct: parseFloat(taxPct) || 0,
      collection_fee_pct: cardFee,
      checklist_before_save: checklistBeforeSave,
      pricing_regime: pricingRegime,
    };
    if (settingsId) {
      await supabase.from("global_settings").update(data).eq("id", settingsId);
    } else {
      const { data: newRow } = await supabase.from("global_settings").insert(data).select("id").single();
      if (newRow) setSettingsId(newRow.id);
    }
    setCollectionCostPercentage(String(cardFee));
    setSaving(false);
    toast.success("Configurações salvas com sucesso!");
  };

  const loadBackups = useCallback(async () => {
    setLoadingBackups(true);
    const { data } = await supabase
      .from("backup_runs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    const runs = (data as unknown as BackupRun[]) || [];
    // Hidratar display_name dos criadores
    const userIds = Array.from(new Set(runs.map((r) => r.created_by).filter(Boolean))) as string[];
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p.display_name]));
      runs.forEach((r) => { if (r.created_by) r.profiles = { display_name: map.get(r.created_by) || "—" }; });
    }
    setBackupRuns(runs);
    setLoadingBackups(false);
  }, []);

  useEffect(() => { if (isAdmin) loadBackups(); }, [isAdmin, loadBackups]);

  const handleGenerateBackup = async (kind: "sql" | "json" | "storage") => {
    if (!session?.access_token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    setGenerating(kind);
    const labelMap = { sql: "SQL", json: "JSON", storage: "Storage" } as const;
    const toastId = toast.loading(`Gerando backup ${labelMap[kind]}...`);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url =
        kind === "storage"
          ? `https://${projectId}.supabase.co/functions/v1/backup-storage`
          : `https://${projectId}.supabase.co/functions/v1/backup-database?format=${kind}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
      const filename =
        kind === "storage" ? `storage-manifest-${stamp}.json` : `backup-${stamp}.${kind}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`Backup ${labelMap[kind]} gerado (${formatBytes(blob.size)})`, { id: toastId });
      loadBackups();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Falha ao gerar backup: ${msg}`, { id: toastId });
    } finally {
      setGenerating(null);
    }
  };

  if (loading) { return <PageLoader />; }

  const totalIndiretos = (parseFloat(invoicePercentage) || 0) + composedVariable;

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <PageHeader icon={Cog} title="Configurações" description="Configure os valores padrão e gerencie o backup do sistema" className="mb-4" />

      <Tabs value={configTab} onValueChange={setConfigTab} className="flex-1 min-h-0 flex flex-col w-full max-w-none">

        <DotTabs
          tabs={[
            { key: "empresa", label: "Empresa" },
            { key: "geral", label: "Geral" },
            { key: "integracoes", label: "Integrações" },
            ...(isAdmin ? [{ key: "conhecimento", label: "Base de Conhecimento" }] : []),
            ...(isAdmin ? [{ key: "backup", label: "Backup & Exportação" }] : []),
            ...(isAdmin ? [{ key: "vps", label: "Migração / VPS" }] : []),
          ]}
          value={configTab}
          onChange={setConfigTab}
          className="mb-4"
        />

        <TabsContent value="empresa" className="flex-1 min-h-0 overflow-y-auto pr-1 mt-0">
          <CompanyTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="geral" className="flex-1 min-h-0 overflow-y-auto pr-1 mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Card className="shadow-card">
              <CardHeader className="pb-3"><CardTitle className="text-base">Custos Operacionais</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Valor da Hora de Trabalho (R$)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="text" value={hourlyRate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} disabled className="bg-muted font-semibold" />
                    <Link to="/despesas-fixas"><Button variant="outline" size="sm" className="gap-1 whitespace-nowrap"><Info className="h-4 w-4" /> Editar</Button></Link>
                  </div>
                  <p className="text-xs text-muted-foreground">Calculado automaticamente a partir de Despesas Fixas</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card xl:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Composição do Preço de Venda</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Alíquotas padrão aplicadas apenas a novas faixas de preço.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Custos Indiretos</h3>
                  <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs">C. Fixo (%)</Label>
                      <Input type="number" step="0.01" value={invoicePercentage} onChange={(e) => setInvoicePercentage(e.target.value)} />
                      <p className="text-[10px] text-muted-foreground">Depreciação, aluguel</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Imposto (%)</Label>
                      <Input type="number" step="0.01" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
                      <p className="text-[10px] text-muted-foreground">Sobre nota fiscal</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Taxa Cobrança (%)</Label>
                      <Input type="number" step="0.01" value={collectionFeePct} onChange={(e) => setCollectionFeePct(e.target.value)} />
                      <p className="text-[10px] text-muted-foreground">Boleto, PIX, cartão</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Perda (%)</Label>
                      <Input type="number" step="0.01" value={wastePercentage} onChange={(e) => setWastePercentage(e.target.value)} />
                      <p className="text-[10px] text-muted-foreground">Perda de material</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Margem</h3>
                  <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Margem de Lucro (%)</Label>
                      <Input type="number" step="0.01" value={defaultProfitMargin} onChange={(e) => setDefaultProfitMargin(e.target.value)} />
                      <p className="text-[10px] text-muted-foreground">Lucro líquido desejado</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-md bg-muted/40 p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">C. Variável:</span><span className="font-medium">{composedVariable.toFixed(2)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Indiretos:</span><span className="font-medium">{totalIndiretos.toFixed(2)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Margem:</span><span className="font-medium text-accent">+{(parseFloat(defaultProfitMargin) || 0).toFixed(2)}%</span></div>
                  <Separator className="my-1" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Soma total:</span><span className="font-semibold">{(totalIndiretos + (parseFloat(defaultProfitMargin) || 0)).toFixed(2)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Divisor (1 − soma%):</span><span className="font-semibold text-primary">{(1 - (totalIndiretos + (parseFloat(defaultProfitMargin) || 0)) / 100).toFixed(4)}</span></div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card lg:col-span-2 xl:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Regime de cálculo de preço</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Define como impostos, taxas e margem são aplicados em <strong>Orçamentos V3</strong>, <strong>Comunicação Visual</strong> e <strong>Etiquetas</strong>. Não afeta orçamentos já salvos.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPricingRegime("por_fora")}
                    className={`text-left rounded-md border p-3 transition ${
                      pricingRegime === "por_fora"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">Por fora <span className="text-xs font-normal text-muted-foreground">(padrão atual)</span></span>
                      {pricingRegime === "por_fora" && <span className="text-[10px] font-medium text-primary uppercase">Ativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Margem aplicada sobre o custo: <code className="rounded bg-muted px-1">preço = custo × (1 + margem%)</code>. Impostos e taxas saem da margem.
                    </p>
                    <p className="text-[11px] text-amber-600 mt-1">Margem real fica abaixo da nominal.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingRegime("por_dentro")}
                    className={`text-left rounded-md border p-3 transition ${
                      pricingRegime === "por_dentro"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">Por dentro <span className="text-xs font-normal text-muted-foreground">(contábil)</span></span>
                      {pricingRegime === "por_dentro" && <span className="text-[10px] font-medium text-primary uppercase">Ativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Divisor: <code className="rounded bg-muted px-1">preço = custo ÷ (1 − (imp + tx + margem)%)</code>. Impostos, taxas e margem embutidos no preço final.
                    </p>
                    <p className="text-[11px] text-emerald-600 mt-1">Margem real = margem configurada. Preços maiores.</p>
                  </button>
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    A troca afeta apenas <strong>novos cálculos</strong>. Orçamentos já salvos mantêm os preços registrados. Recomendado validar o impacto comercial antes de migrar para "Por dentro".
                  </AlertDescription>
                </Alert>
                <div className="rounded-md border border-border bg-muted/40 p-3 flex gap-2">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <strong className="text-foreground">Preço de Impressão</strong> sempre calcula <strong>por dentro</strong>, via faixas de markup definidas em cada categoria de impressora (<code className="rounded bg-background px-1">preço = custo ÷ (1 − (custo fixo% + custo variável% + margem%) / 100)</code>).
                    </p>
                    <p>
                      Esse módulo <strong>não é afetado</strong> por este toggle — a configuração acima vale apenas para Orçamentos V3, Comunicação Visual e Etiquetas.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card lg:col-span-2 xl:col-span-3">
              <CardHeader className="pb-3"><CardTitle className="text-base">Fluxo de orçamentos</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-muted/20 p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="checklist-before-save" className="text-sm font-medium cursor-pointer">
                      Confirmar checklist antes de salvar orçamento
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Quando ativo, ao clicar em Salvar abre um popup com todas as perguntas pendentes para revisão.
                    </p>
                  </div>
                  <Switch
                    id="checklist-before-save"
                    checked={checklistBeforeSave}
                    onCheckedChange={setChecklistBeforeSave}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent hover:bg-accent-hover">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>


        <TabsContent value="integracoes" className="flex-1 min-h-0 overflow-y-auto pr-1 mt-0 space-y-4">
          <GoogleCalendarCard />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="conhecimento" className="flex-1 min-h-0 overflow-y-auto pr-1 mt-0">
            <BaseConhecimentoTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="backup" className="flex-1 min-h-0 overflow-y-auto pr-1 mt-0">
            <div className="grid gap-4 xl:grid-cols-2">

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" /> Gerar backup completo</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Exporta esquema, dados, RLS, funções, triggers e usuários (sem senhas) para restauração em qualquer Postgres.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    O backup <strong>não inclui hashes de senha</strong> (limitação técnica da Auth API). Usuários migrados precisarão resetar a senha no destino. Storage e cron jobs também não são exportados.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => handleGenerateBackup("sql")} disabled={generating !== null} className="gap-2">
                    {generating === "sql" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
                    Gerar backup SQL
                  </Button>
                  <Button variant="outline" onClick={() => handleGenerateBackup("json")} disabled={generating !== null} className="gap-2">
                    {generating === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
                    Backup JSON
                  </Button>
                  <Button variant="outline" onClick={() => handleGenerateBackup("storage")} disabled={generating !== null} className="gap-2">
                    {generating === "storage" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderArchive className="h-4 w-4" />}
                    Exportar lista de arquivos (Storage)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use <code className="rounded bg-muted px-1">psql destino &lt; backup.sql</code> para restaurar o arquivo SQL em outro Postgres.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Storage:</strong> URLs assinadas válidas por 24h. Baixe os arquivos imediatamente após gerar (ex: <code className="rounded bg-muted px-1">wget -i urls.txt</code>).
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Histórico de Backups</CardTitle>
                <Button variant="ghost" size="sm" onClick={loadBackups} disabled={loadingBackups} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${loadingBackups ? "animate-spin" : ""}`} /> Atualizar
                </Button>
              </CardHeader>
              <CardContent>
                {backupRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum backup gerado ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Por</TableHead>
                        <TableHead>Formato</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backupRuns.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-sm">{r.profiles?.display_name || "—"}</TableCell>
                          <TableCell className="text-sm uppercase font-mono">{r.format === "storage-json" ? "Storage" : r.format}</TableCell>
                          <TableCell className="text-sm">{formatBytes(r.size_bytes)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "success" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>
                              {r.status === "success" ? "Sucesso" : "Falha"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            </div>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="vps" className="flex-1 min-h-0 overflow-y-auto pr-1 mt-0 space-y-4">
            <VpsPackageCard sessionToken={session?.access_token ?? null} />
          </TabsContent>
        )}
      </Tabs>


      <Dialog open={generating !== null}>
        <DialogContent
          className="sm:max-w-md [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <Database className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <Loader2 className="h-20 w-20 text-primary/30 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Gerando backup, aguarde...</h3>
              <p className="text-sm text-muted-foreground">
                Formato: <span className="font-mono uppercase">{generating ?? ""}</span>
              </p>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Tempo decorrido: {elapsed}s
              </p>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-3 w-full">
              Não feche esta janela. O download iniciará automaticamente ao concluir.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
