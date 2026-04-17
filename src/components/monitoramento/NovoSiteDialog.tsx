import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sparkles, FileSpreadsheet, Code, Loader2, CheckCircle2, XCircle, FlaskConical, HelpCircle, Upload, Layers,
} from "lucide-react";
import { toast } from "sonner";
import { findOrCreateCatalogo } from "@/lib/produtoCatalogo";
import ProductPicker from "./ProductPicker";

const formatBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Extrai um nome amigável a partir do domínio da URL (fallback quando o Firecrawl não retorna fornecedor).
const extractDomainName = (url: string): string => {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return core.charAt(0).toUpperCase() + core.slice(1);
  } catch {
    return "";
  }
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
};

// Verifica se já existe um site cadastrado com a MESMA URL.
// Não bloqueia por fornecedor+produto canônico, pois o mesmo fornecedor pode
// ter URLs diferentes para o mesmo produto (ex: faixas de quantidade distintas).
const checkDuplicate = async (params: {
  url?: string | null;
}): Promise<string | null> => {
  const url = params.url?.trim();
  if (!url) return null;
  const { data } = await supabase
    .from("sites_monitorados")
    .select("id, nome_produto, fornecedor_nome")
    .eq("url_completa", url)
    .limit(1);
  if (data && data.length > 0) {
    return `Esta URL já está cadastrada como "${data[0].nome_produto}"${data[0].fornecedor_nome ? ` (${data[0].fornecedor_nome})` : ""}.`;
  }
  return null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
};

type ParseResult = {
  success: true;
  parser: string;
  fileName: string;
  header: string[];
  rows: string[][];
  totalRows: number;
} | { success: false; error: string };

export default function NovoSiteDialog({ open, onOpenChange, onCreated }: Props) {
  // Comum
  const [categoria, setCategoria] = useState("geral");
  const [fornecedor, setFornecedor] = useState("");

  // ===== MODO 1: URL automática =====
  const [autoUrl, setAutoUrl] = useState("");
  const [autoNome, setAutoNome] = useState("");
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoResult, setAutoResult] = useState<{ ok: boolean; price?: number; source?: string; title?: string; error?: string } | null>(null);
  const [autoCatalogoId, setAutoCatalogoId] = useState<string | null>(null);

  // ===== MODO 2: URL com seletor (avançado) =====
  const [advUrl, setAdvUrl] = useState("");
  const [advNome, setAdvNome] = useState("");
  const [advSeletor, setAdvSeletor] = useState("");
  const [advBusy, setAdvBusy] = useState(false);
  const [advResult, setAdvResult] = useState<any>(null);

  // ===== MODO 3: Import planilha =====
  const [file, setFile] = useState<File | null>(null);
  const [parseBusy, setParseBusy] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [colNome, setColNome] = useState<string>("");
  const [colPreco, setColPreco] = useState<string>("");
  const [colCodigo, setColCodigo] = useState<string>("__none__");
  const [importing, setImporting] = useState(false);

  // ===== MODO 4: Tabela de preços (tiers via Firecrawl) =====
  const [tiersUrl, setTiersUrl] = useState("");
  const [tiersNome, setTiersNome] = useState("");
  const [tiersBusy, setTiersBusy] = useState(false);
  const [tiersResult, setTiersResult] = useState<{
    ok: boolean;
    produto?: string;
    fornecedor?: string;
    tiers?: { quantidade: number; preco_total: number; preco_unitario: number }[];
    error?: string;
  } | null>(null);
  const [savingTiers, setSavingTiers] = useState(false);
  const [tiersCatalogoId, setTiersCatalogoId] = useState<string | null>(null);

  const reset = () => {
    setAutoUrl(""); setAutoNome(""); setAutoResult(null); setAutoCatalogoId(null);
    setAdvUrl(""); setAdvNome(""); setAdvSeletor(""); setAdvResult(null);
    setFile(null); setParsed(null); setColNome(""); setColPreco(""); setColCodigo("__none__");
    setTiersUrl(""); setTiersNome(""); setTiersResult(null); setTiersCatalogoId(null);
  };

  // ---- TIERS handlers ----
  const handleDetectTiers = async () => {
    if (!tiersUrl) return toast.error("Cole a URL do produto");
    setTiersBusy(true); setTiersResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("detect-price-tiers", {
        body: { url: tiersUrl.trim() },
      });
      if (error) throw error;
      if (data?.success && Array.isArray(data.tiers) && data.tiers.length) {
        const detectedSupplier = data.fornecedor && String(data.fornecedor).trim()
          ? String(data.fornecedor).trim()
          : extractDomainName(tiersUrl);
        setTiersResult({ ok: true, produto: data.produto, fornecedor: detectedSupplier, tiers: data.tiers });
        if (!tiersNome && data.produto) setTiersNome(String(data.produto).slice(0, 120));
        if (detectedSupplier) setFornecedor(detectedSupplier);
        if (data.descartados > 0) {
          toast.warning(`${data.descartados} faixa(s) descartada(s) por não baterem com o texto da página`);
        }
      } else if (data?.success && data?.descartados > 0) {
        setTiersResult({ ok: false, error: `Nenhuma faixa validada. ${data.descartados} valor(es) foram descartado(s) por não existirem no texto real da página (provável alucinação do extrator). Use a aba Planilha para importar manualmente.` });
      } else {
        setTiersResult({ ok: false, error: data?.error || "Não foi possível detectar tiers reais nesta URL — verifique se a página tem tabela de preços visível ou use a aba Planilha." });
      }
    } catch (e: any) {
      setTiersResult({ ok: false, error: e.message });
    } finally {
      setTiersBusy(false);
    }
  };

  const doSaveTiers = async (catalogoIdOverride: string | null, nomeOverride?: string) => {
    if (!tiersResult?.ok || !tiersResult.tiers?.length) return;
    const nomeFinal = (nomeOverride ?? tiersNome).trim();
    if (!nomeFinal) return toast.error("Confirme o nome do produto");
    setSavingTiers(true);
    try {
      const minTier = [...tiersResult.tiers].sort((a, b) => a.quantidade - b.quantidade)[0];
      const catalogoId = catalogoIdOverride ?? await findOrCreateCatalogo(nomeFinal, categoria);
      const dup = await checkDuplicate({
        url: tiersUrl.trim(),
        fornecedor: fornecedor.trim() || null,
        produtoCatalogoId: catalogoId,
      });
      if (dup) {
        toast.error(dup);
        setSavingTiers(false);
        return;
      }
      const { data: site, error } = await supabase.from("sites_monitorados").insert({
        nome_produto: nomeFinal,
        categoria: categoria.trim().toLowerCase() || "geral",
        url_completa: tiersUrl.trim(),
        seletor_css: null,
        tipo_fonte: "url_tiers",
        fornecedor_nome: fornecedor.trim() || null,
        produto_catalogo_id: catalogoId,
        preco_atual: minTier.preco_total,
        metodo_coleta: "firecrawl",
        intervalo_check_horas: 24,
        timestamp_check: new Date().toISOString(),
      }).select().single();
      if (error) throw error;

      const rows = tiersResult.tiers.map((t) => ({
        site_id: site.id,
        quantidade: t.quantidade,
        preco_total: t.preco_total,
        preco_unitario: t.preco_unitario,
      }));
      const { error: tErr } = await supabase.from("site_precos_tiers").insert(rows);
      if (tErr) throw tErr;

      toast.success(`Produto adicionado com ${rows.length} faixas de preço`);
      reset(); onCreated(); onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSavingTiers(false);
    }
  };

  const handleSaveTiers = async () => {
    if (!tiersResult?.ok || !tiersResult.tiers?.length) return;
    if (!tiersNome) return toast.error("Confirme o nome do produto");
    await doSaveTiers(tiersCatalogoId);
  };

  // ---- handlers ----
  const handleAutoDetect = async () => {
    if (!autoUrl) return toast.error("Cole a URL do produto");
    setAutoBusy(true); setAutoResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("auto-detect-price", { body: { url: autoUrl.trim() } });
      if (error) throw error;
      if (data?.success) {
        setAutoResult({ ok: true, price: data.price, source: data.source, title: data.title });
        if (!autoNome && data.title) setAutoNome(String(data.title).slice(0, 100));
      } else {
        setAutoResult({ ok: false, error: data?.error || "Não detectado" });
      }
    } catch (e: any) {
      setAutoResult({ ok: false, error: e.message });
    } finally {
      setAutoBusy(false);
    }
  };

  const doSaveAuto = async (catalogoIdOverride: string | null, nomeOverride?: string) => {
    const nomeFinal = (nomeOverride ?? autoNome).trim();
    if (!autoUrl || !nomeFinal) return toast.error("Detecte o preço e confirme o nome");
    const catalogoId = catalogoIdOverride ?? await findOrCreateCatalogo(nomeFinal, categoria);
    const dup = await checkDuplicate({
      url: autoUrl.trim(),
      fornecedor: fornecedor.trim() || null,
      produtoCatalogoId: catalogoId,
    });
    if (dup) return toast.error(dup);
    const { error } = await supabase.from("sites_monitorados").insert({
      nome_produto: nomeFinal,
      categoria: categoria.trim().toLowerCase() || "geral",
      url_completa: autoUrl.trim(),
      seletor_css: null,
      tipo_fonte: "url_auto",
      fornecedor_nome: fornecedor.trim() || null,
      produto_catalogo_id: catalogoId,
      preco_atual: autoResult?.ok ? autoResult.price : null,
    });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Site adicionado");
    reset(); onCreated(); onOpenChange(false);
  };

  const handleSaveAuto = async () => {
    if (!autoUrl || !autoNome) return toast.error("Detecte o preço e confirme o nome");
    await doSaveAuto(autoCatalogoId);
  };

  const handleTestSelector = async () => {
    if (!advUrl || !advSeletor) return toast.error("Preencha URL e seletor");
    setAdvBusy(true); setAdvResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-css-selector", {
        body: { url: advUrl.trim(), selector: advSeletor.trim() },
      });
      if (error) throw error;
      setAdvResult(data?.success ? { ok: true, ...data } : { ok: false, error: data?.error });
    } catch (e: any) {
      setAdvResult({ ok: false, error: e.message });
    } finally {
      setAdvBusy(false);
    }
  };

  const handleSaveAdvanced = async () => {
    if (!advNome || !advUrl || !advSeletor) return toast.error("Preencha todos os campos");
    const catalogoId = await findOrCreateCatalogo(advNome.trim(), categoria);
    const dup = await checkDuplicate({
      url: advUrl.trim(),
      fornecedor: fornecedor.trim() || null,
      produtoCatalogoId: catalogoId,
    });
    if (dup) return toast.error(dup);
    const { error } = await supabase.from("sites_monitorados").insert({
      nome_produto: advNome.trim(),
      categoria: categoria.trim().toLowerCase() || "geral",
      url_completa: advUrl.trim(),
      seletor_css: advSeletor.trim(),
      tipo_fonte: "url_seletor",
      fornecedor_nome: fornecedor.trim() || null,
      produto_catalogo_id: catalogoId,
      preco_atual: advResult?.ok ? advResult.parsedPrice : null,
    });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Site adicionado");
    reset(); onCreated(); onOpenChange(false);
  };

  const handleParse = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    setParseBusy(true); setParsed(null); setColNome(""); setColPreco(""); setColCodigo("__none__");
    try {
      const buf = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const { data, error } = await supabase.functions.invoke("parse-price-table", {
        body: { fileBase64: b64, fileName: file.name },
      });
      if (error) throw error;
      setParsed(data);
      // Auto-sugestão de colunas
      if (data?.success && data.header) {
        const findIdx = (re: RegExp) => data.header.findIndex((h: string) => re.test(h));
        const iNome = findIdx(/produto|descri[çc][aã]o|item|nome/i);
        const iPreco = findIdx(/pre[çc]o|valor|R\$/i);
        const iCod = findIdx(/c[oó]digo|sku|ref/i);
        if (iNome >= 0) setColNome(String(iNome));
        if (iPreco >= 0) setColPreco(String(iPreco));
        if (iCod >= 0) setColCodigo(String(iCod));
      }
    } catch (e: any) {
      setParsed({ success: false, error: e.message });
    } finally {
      setParseBusy(false);
    }
  };

  const parseBRL = (raw: any): number | null => {
    if (raw == null) return null;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    const cleaned = String(raw).replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const handleImport = async () => {
    if (!parsed?.success) return;
    if (!colNome || !colPreco) return toast.error("Selecione as colunas Produto e Preço");
    if (!fornecedor) return toast.error("Informe o fornecedor para a importação");
    const iN = Number(colNome), iP = Number(colPreco), iC = colCodigo === "__none__" ? -1 : Number(colCodigo);
    setImporting(true);
    try {
      // Busca existentes desse fornecedor
      const { data: existing } = await supabase
        .from("sites_monitorados")
        .select("id, nome_produto, codigo_externo")
        .eq("fornecedor_nome", fornecedor.trim());
      const existingMap = new Map<string, string>();
      (existing || []).forEach((s: any) => {
        const key = (s.codigo_externo || s.nome_produto || "").toLowerCase().trim();
        if (key) existingMap.set(key, s.id);
      });

      let created = 0, updated = 0, skipped = 0;
      const skippedDetails: string[] = [];
      for (const row of parsed.rows) {
        const nome = String(row[iN] ?? "").trim();
        const preco = parseBRL(row[iP]);
        const codigo = iC >= 0 ? String(row[iC] ?? "").trim() : "";
        if (!nome || preco == null || preco <= 0) {
          skipped++;
          if (skippedDetails.length < 5 && nome) skippedDetails.push(`"${nome.slice(0, 40)}" → preço inválido: "${row[iP] ?? ""}"`);
          continue;
        }
        const key = (codigo || nome).toLowerCase();
        const existingId = existingMap.get(key);
        if (existingId) {
          await supabase.from("sites_monitorados").update({
            nome_produto: nome, preco_atual: preco, codigo_externo: codigo || null,
            tipo_fonte: "excel", timestamp_check: new Date().toISOString(),
          }).eq("id", existingId);
          updated++;
        } else {
          const catalogoId = await findOrCreateCatalogo(nome, categoria);
          await supabase.from("sites_monitorados").insert({
            nome_produto: nome, categoria: categoria.trim().toLowerCase() || "geral",
            url_completa: null, seletor_css: null, tipo_fonte: "excel",
            fornecedor_nome: fornecedor.trim(), preco_atual: preco,
            produto_catalogo_id: catalogoId,
            codigo_externo: codigo || null, timestamp_check: new Date().toISOString(),
          });
          created++;
        }
      }

      await supabase.from("tabelas_importadas").insert({
        fornecedor_nome: fornecedor.trim(), file_name: parsed.fileName || file?.name || "arquivo",
        file_type: parsed.parser, total_linhas: parsed.rows.length,
        itens_criados: created, itens_atualizados: updated,
        observacoes: skipped ? `${skipped} linhas ignoradas (sem nome ou preço)` : null,
      });

      if (skipped > 0 && created === 0 && updated === 0) {
        toast.error(`Nenhum item importado. ${skipped} linhas ignoradas. Verifique se a coluna de preço está correta.`);
        if (skippedDetails.length) console.warn("[Importação] Exemplos ignorados:", skippedDetails);
      } else {
        toast.success(`Importação concluída: ${created} novos, ${updated} atualizados, ${skipped} ignorados`);
        reset(); onCreated(); onOpenChange(false);
      }
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Monitoramento</DialogTitle>
        </DialogHeader>

        {/* Campos comuns */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Categoria</Label>
            <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="papel, banner, tinta..." />
          </div>
          <div>
            <Label>Fornecedor</Label>
            <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
          </div>
        </div>

        <Tabs defaultValue="tiers" className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="tiers"><Layers className="h-4 w-4 mr-1" />Tabela auto</TabsTrigger>
            <TabsTrigger value="auto"><Sparkles className="h-4 w-4 mr-1" />URL simples</TabsTrigger>
            <TabsTrigger value="excel"><FileSpreadsheet className="h-4 w-4 mr-1" />Planilha</TabsTrigger>
            <TabsTrigger value="adv"><Code className="h-4 w-4 mr-1" />Avançado</TabsTrigger>
          </TabsList>

          {/* === TIERS (Firecrawl) === */}
          <TabsContent value="tiers" className="space-y-3 pt-3">
            <Alert>
              <AlertDescription className="text-xs">
                Para sites com <strong>tabela de preços por quantidade</strong> (ex: 1un, 10un, 20un...). Funciona em sites que dependem de JavaScript e detecta todas as faixas automaticamente. Ideal para gráficas online (ANS, Future, Printi).
              </AlertDescription>
            </Alert>
            <div>
              <Label>URL do produto *</Label>
              <div className="flex gap-2">
                <Input value={tiersUrl} onChange={(e) => setTiersUrl(e.target.value)} placeholder="https://www.ans.com.br/banner-em-lona-brilho-80x120cm/" />
                <Button onClick={handleDetectTiers} disabled={tiersBusy || !tiersUrl}>
                  {tiersBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                  Detectar tabela
                </Button>
              </div>
            </div>
            {tiersResult && !tiersResult.ok && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs flex items-start gap-2">
                  <XCircle className="h-4 w-4 mt-0.5" /><span>{tiersResult.error}</span>
                </AlertDescription>
              </Alert>
            )}
            {tiersResult?.ok && tiersResult.tiers && (
              <>
                <Alert>
                  <AlertDescription className="text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" style={{ color: "hsl(var(--success))" }} />
                    <span>✓ <strong>{tiersResult.tiers.length}</strong> faixas validadas contra o texto da página{tiersResult.fornecedor ? ` em ${tiersResult.fornecedor}` : ""}</span>
                  </AlertDescription>
                </Alert>
                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quantidade</TableHead>
                        <TableHead className="text-right">Preço total</TableHead>
                        <TableHead className="text-right">Preço/un</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tiersResult.tiers.map((t, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">{t.quantidade} un</TableCell>
                          <TableCell className="text-right font-mono">{formatBRL(t.preco_total)}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">{formatBRL(t.preco_unitario)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ProductPicker
                  selectedId={tiersCatalogoId}
                  selectedName={tiersNome}
                  onChange={({ id, name }) => { setTiersCatalogoId(id); setTiersNome(name); }}
                />

              </>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSaveTiers} disabled={savingTiers || !tiersResult?.ok || !tiersNome}>
                {savingTiers && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar produto + {tiersResult?.tiers?.length || 0} faixas
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* === AUTO === */}
          <TabsContent value="auto" className="space-y-3 pt-3">
            <Alert>
              <AlertDescription className="text-xs">
                Cole a URL do produto e clique em <strong>Detectar preço</strong>. O sistema tenta achar o preço sozinho (funciona na maioria dos sites de e-commerce). Sem precisar de código.
              </AlertDescription>
            </Alert>
            <div>
              <Label>URL do produto *</Label>
              <div className="flex gap-2">
                <Input value={autoUrl} onChange={(e) => setAutoUrl(e.target.value)} placeholder="https://..." />
                <Button onClick={handleAutoDetect} disabled={autoBusy || !autoUrl}>
                  {autoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Detectar preço
                </Button>
              </div>
            </div>
            {autoResult && (
              <Alert variant={autoResult.ok ? "default" : "destructive"}>
                <AlertDescription className="text-xs space-y-1">
                  {autoResult.ok ? (
                    <>
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" style={{ color: "hsl(var(--success))" }} />
                        <span>Preço encontrado: <strong>{formatBRL(autoResult.price)}</strong> ({autoResult.source})</span></div>
                      {autoResult.title && <div className="text-muted-foreground">Título: {autoResult.title}</div>}
                    </>
                  ) : (
                    <div className="flex items-start gap-2"><XCircle className="h-4 w-4 mt-0.5" /><span>{autoResult.error} — tente o modo Avançado.</span></div>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <ProductPicker
              selectedId={autoCatalogoId}
              selectedName={autoNome}
              onChange={({ id, name }) => { setAutoCatalogoId(id); setAutoNome(name); }}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSaveAuto} disabled={!autoUrl || !autoNome}>Adicionar</Button>
            </DialogFooter>
          </TabsContent>

          {/* === EXCEL === */}
          <TabsContent value="excel" className="space-y-3 pt-3">
            <Alert>
              <AlertDescription className="text-xs">
                Faça upload da tabela de preços do fornecedor (.xls, .xlsx, .csv). O sistema lê as colunas e você diz qual é o produto e qual é o preço. Itens existentes desse fornecedor serão <strong>atualizados</strong>.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Arquivo da tabela *</Label>
              <div className="flex gap-2">
                <Input type="file" accept=".xls,.xlsx,.csv,.htm,.html" onChange={(e) => { setFile(e.target.files?.[0] || null); setParsed(null); }} />
                <Button onClick={handleParse} disabled={!file || parseBusy}>
                  {parseBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Ler arquivo
                </Button>
              </div>
            </div>
            {parsed && parsed.success === false && (
              <Alert variant="destructive"><AlertDescription className="text-xs">{parsed.error}</AlertDescription></Alert>
            )}
            {parsed?.success && (
              <>
                <Alert><AlertDescription className="text-xs">
                  Encontrei <strong>{parsed.totalRows} linhas</strong> e <strong>{parsed.header.length} colunas</strong>. Selecione abaixo qual é qual.
                </AlertDescription></Alert>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Coluna do Produto *</Label>
                    <Select value={colNome} onValueChange={setColNome}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{parsed.header.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Coluna do Preço *</Label>
                    <Select value={colPreco} onValueChange={setColPreco}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{parsed.header.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Código (opcional)</Label>
                    <Select value={colCodigo} onValueChange={setColCodigo}>
                      <SelectTrigger><SelectValue placeholder="(nenhuma)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">(nenhuma)</SelectItem>
                        {parsed.header.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border rounded max-h-60 overflow-auto">
                  <Table>
                    <TableHeader><TableRow>{parsed.header.map((h, i) => <TableHead key={i} className="text-xs whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>
                      {parsed.rows.slice(0, 8).map((r, ri) => (
                        <TableRow key={ri}>
                          {parsed.header.map((_h, ci) => <TableCell key={ci} className="text-xs whitespace-nowrap">{String(r[ci] ?? "")}</TableCell>)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsed.rows.length > 8 && <div className="text-xs text-muted-foreground p-2">... e mais {parsed.rows.length - 8} linhas</div>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button onClick={handleImport} disabled={importing || !colNome || !colPreco || !fornecedor}>
                    {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                    Importar {parsed.rows.length} linhas
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>

          {/* === AVANÇADO === */}
          <TabsContent value="adv" className="space-y-3 pt-3">
            <Alert>
              <AlertDescription className="text-xs">
                Use só se a detecção automática falhar. Você precisa pegar o seletor CSS do preço pelo F12 do navegador.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Nome do produto *</Label>
              <Input value={advNome} onChange={(e) => setAdvNome(e.target.value)} />
            </div>
            <div>
              <Label>URL completa *</Label>
              <Input value={advUrl} onChange={(e) => setAdvUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Label>Seletor CSS *</Label>
                <TooltipProvider><Tooltip><TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground"><HelpCircle className="h-4 w-4" /></button>
                </TooltipTrigger><TooltipContent className="max-w-xs"><div className="text-xs space-y-1">
                  <p className="font-semibold">Como obter:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Abra a página do produto</li><li>F12 → seta no canto superior esquerdo</li>
                    <li>Clique no preço</li><li>Clique direito no HTML → Copy → Copy selector</li>
                  </ol>
                </div></TooltipContent></Tooltip></TooltipProvider>
              </div>
              <div className="flex gap-2">
                <Input value={advSeletor} onChange={(e) => setAdvSeletor(e.target.value)} placeholder=".price-now" className="font-mono text-sm" />
                <Button variant="outline" onClick={handleTestSelector} disabled={advBusy || !advUrl || !advSeletor}>
                  {advBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                  Testar
                </Button>
              </div>
            </div>
            {advResult && (
              <Alert variant={advResult.ok ? "default" : "destructive"}>
                <AlertDescription className="text-xs">
                  {advResult.ok ? (
                    <span>Encontrado: <code>{advResult.rawText}</code> {advResult.parsedPrice != null && <>→ <strong>{formatBRL(advResult.parsedPrice)}</strong></>}</span>
                  ) : advResult.error}
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSaveAdvanced} disabled={!advNome || !advUrl || !advSeletor}>Adicionar</Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
