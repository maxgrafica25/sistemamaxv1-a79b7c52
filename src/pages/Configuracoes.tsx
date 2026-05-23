import { useState, useEffect, useCallback } from "react";
import GoogleCalendarCard from "@/components/configuracoes/GoogleCalendarCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
        supabase.from("global_settings").select("id, invoice_pct, collection_pct, waste_pct, default_margin_pct, tax_pct, collection_fee_pct, credit_card_pct, checklist_before_save").limit(1).single(),
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Cog className="h-6 w-6 text-primary" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure os valores padrão e gerencie o backup do sistema</p>
      </div>

      <Tabs value={configTab} onValueChange={setConfigTab} className="max-w-3xl">
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

        <TabsContent value="empresa">
          <CompanyTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="geral" className="space-y-6 mt-4">
          <Card className="shadow-card">
            <CardHeader><CardTitle>Custos Operacionais</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Valor da Hora de Trabalho (R$)</Label>
                <div className="flex items-center gap-3">
                  <Input type="text" value={hourlyRate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} disabled className="bg-muted font-semibold" />
                  <Link to="/despesas-fixas"><Button variant="outline" size="sm" className="gap-1 whitespace-nowrap"><Info className="h-4 w-4" /> Editar Despesas</Button></Link>
                </div>
                <p className="text-sm text-muted-foreground">Calculado automaticamente a partir do módulo de Despesas Fixas</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Composição do Preço de Venda</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Alíquotas padrão sugeridas ao criar novas faixas de preço. Cada faixa pode sobrescrever estes valores.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <p className="text-muted-foreground">
                  Estes valores são aplicados apenas a <span className="font-medium text-foreground">novas faixas de preço</span>. Faixas e produtos já cadastrados não são afetados por alterações aqui.
                </p>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Custos Indiretos</h3>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">C. Fixo (%)</Label>
                    <Input type="number" step="0.01" value={invoicePercentage} onChange={(e) => setInvoicePercentage(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Depreciação, aluguel</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Imposto (%)</Label>
                    <Input type="number" step="0.01" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Sobre nota fiscal</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Taxa de Cobrança (%)</Label>
                    <Input type="number" step="0.01" value={collectionFeePct} onChange={(e) => setCollectionFeePct(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Boleto, PIX, cartão</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Perda (%)</Label>
                    <Input type="number" step="0.01" value={wastePercentage} onChange={(e) => setWastePercentage(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Perda de material</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Margem</h3>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Margem de Lucro (%)</Label>
                    <Input type="number" step="0.01" value={defaultProfitMargin} onChange={(e) => setDefaultProfitMargin(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Lucro líquido desejado</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="rounded-md bg-muted/40 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">C. Variável (Imposto + Cobrança + Perda):</span><span className="font-medium">{composedVariable.toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Custos Indiretos (C. Fixo + C. Variável):</span><span className="font-medium">{totalIndiretos.toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Margem de Lucro:</span><span className="font-medium text-accent">+{(parseFloat(defaultProfitMargin) || 0).toFixed(2)}%</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between"><span className="text-muted-foreground">Soma total:</span><span className="font-semibold">{(totalIndiretos + (parseFloat(defaultProfitMargin) || 0)).toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Divisor (1 − soma%):</span><span className="font-semibold text-primary">{(1 - (totalIndiretos + (parseFloat(defaultProfitMargin) || 0)) / 100).toFixed(4)}</span></div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={saving} className="gap-2 bg-accent hover:bg-accent-hover">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="integracoes" className="space-y-6 mt-4">
          <GoogleCalendarCard />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="conhecimento" className="mt-4 max-w-5xl">
            <BaseConhecimentoTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="backup" className="space-y-6 mt-4">
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
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="vps" className="space-y-6 mt-4">
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
