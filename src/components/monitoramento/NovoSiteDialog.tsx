import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Loader2, Save, AlertTriangle, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import ProductPicker from "./ProductPicker";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  categoriasExistentes?: string[];
  onNavigateToManagement?: () => void;
};

type DuplicadoInfo = {
  url: string;
  nome_produto: string;
  fornecedor_nome: string | null;
  ativo: boolean;
  preco_atual: number | null;
  timestamp_check: string | null;
};

type WorkerPrice = {
  quantity: number;
  unit_price: number;
  unit_price_calculated: boolean;
  total_price: number;
};

type WorkerResult = {
  source_url: string;
  scraped_at: string;
  strategy: "api" | "html" | "html-regex" | "function-atualcard" | "function-imprimarapido";
  prices: WorkerPrice[];
  error: string | null;
};

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 4 });

const KNOWN_SUPPLIERS: Record<string, string> = {
  "atualcard.com.br": "Atual Card",
  "imprimarapido.com.br": "Imprima Rápido",
  "ans.com.br": "ANS",
  "futuraim.com.br": "Futura IM",
  "graficadosite.com.br": "Gráfica do Site",
  "graficaonline.com.br": "Gráfica Online",
  "printi.com.br": "Printi",
  "santograf.com.br": "Santograf",
  "ksgrafica.com.br": "KS Gráfica",
  "graficacentro.com.br": "Gráfica Centro",
};

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

const detectSupplier = (url: string): string => {
  try {
    const host = new URL(url.trim()).hostname.replace(/^www\./, "").toLowerCase();
    if (KNOWN_SUPPLIERS[host]) return KNOWN_SUPPLIERS[host];
    // try matching parent domain (e.g. shop.atualcard.com.br)
    for (const key of Object.keys(KNOWN_SUPPLIERS)) {
      if (host.endsWith("." + key) || host === key) return KNOWN_SUPPLIERS[key];
    }
    return extractDomainName(url);
  } catch {
    return extractDomainName(url);
  }
};

const strategyBadge = (s: WorkerResult["strategy"]) => {
  const map: Record<string, { label: string; cls: string }> = {
    api: { label: "api", cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800" },
    html: { label: "html", cls: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800" },
    "html-regex": { label: "html-regex", cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" },
    "function-atualcard": { label: "function", cls: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800" },
    "function-imprimarapido": { label: "function", cls: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800" },
  };
  return map[s] ?? { label: String(s ?? "unknown"), cls: "bg-muted text-muted-foreground border-border" };
};

export default function NovoSiteDialog({ open, onOpenChange, onCreated, categoriasExistentes = [], onNavigateToManagement }: Props) {
  const [urlsText, setUrlsText] = useState("");
  const [categoria, setCategoria] = useState("");
  const [novaCategoriaMode, setNovaCategoriaMode] = useState(false);
  const [produtoCatalogoId, setProdutoCatalogoId] = useState<string | null>(null);
  const [produtoCatalogoNome, setProdutoCatalogoNome] = useState("");
  const [results, setResults] = useState<WorkerResult[]>([]);
  const [fornecedorOverrides, setFornecedorOverrides] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicados, setDuplicados] = useState<DuplicadoInfo[]>([]);
  const [confirmDupOpen, setConfirmDupOpen] = useState(false);

  const categoriasOrdenadas = useMemo(
    () => Array.from(new Set(categoriasExistentes.map((c) => c.toLowerCase().trim()).filter(Boolean))).sort(),
    [categoriasExistentes],
  );

  const urls = useMemo(
    () =>
      urlsText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s)),
    [urlsText],
  );

  // Prepopulate fornecedor names when results arrive (without overwriting user edits)
  useEffect(() => {
    if (!results.length) return;
    setFornecedorOverrides((prev) => {
      const next = { ...prev };
      for (const r of results) {
        if (!next[r.source_url]) {
          next[r.source_url] = detectSupplier(r.source_url);
        }
      }
      return next;
    });
  }, [results]);

  const reset = () => {
    setUrlsText("");
    setCategoria("");
    setNovaCategoriaMode(false);
    setProdutoCatalogoId(null);
    setProdutoCatalogoNome("");
    setResults([]);
    setFornecedorOverrides({});
    setDuplicados([]);
    setConfirmDupOpen(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleTest = async () => {
    if (!urls.length) {
      toast.error("Cole pelo menos uma URL válida (http/https)");
      return;
    }
    setTesting(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-prices", {
        body: { urls },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha no scraping");
      const got: WorkerResult[] = data.results || [];
      setResults(got);
      const ok = got.filter((r) => r.prices.length).length;
      toast.success(`${ok}/${got.length} URL(s) com tiers encontrados`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao buscar preços");
    } finally {
      setTesting(false);
    }
  };

  const validResults = useMemo(() => results.filter((r) => r.prices.length > 0), [results]);
  const invalidResults = useMemo(() => results.filter((r) => r.prices.length === 0), [results]);

  const performSave = async (skipDuplicateUrls: Set<string>) => {
    setSaving(true);
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const notScraped = invalidResults.length;

    try {
      const catalogoId = produtoCatalogoId;
      if (!catalogoId) {
        toast.error("Selecione uma referência");
        setSaving(false);
        return;
      }

      for (const r of validResults) {
        if (skipDuplicateUrls.has(r.source_url)) {
          skipped++;
          continue;
        }

        const fornecedor =
          (fornecedorOverrides[r.source_url] || detectSupplier(r.source_url)).trim() || null;
        const minUnit = Math.min(...r.prices.map((p) => p.unit_price));

        const { data: inserted, error: insErr } = await supabase
          .from("sites_monitorados")
          .insert({
            nome_produto: produtoCatalogoNome.trim(),
            categoria: categoria.trim().toLowerCase(),
            url_completa: r.source_url,
            fornecedor_nome: fornecedor,
            produto_catalogo_id: catalogoId,
            preco_atual: minUnit,
            ativo: true,
            metodo_coleta: "playwright",
            tipo_fonte: "playwright",
            scrape_status: "ok",
            scrape_source: "playwright",
            timestamp_check: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insErr || !inserted) {
          failed++;
          continue;
        }

        const tierRows = r.prices.map((p) => ({
          site_id: inserted.id,
          quantidade: p.quantity,
          preco_total: p.total_price,
          preco_unitario: p.unit_price,
          ativo: true,
        }));
        const { error: tierErr } = await supabase.from("site_precos_tiers").insert(tierRows);
        if (tierErr) {
          failed++;
        } else {
          created++;
        }
      }

      const parts = [
        created > 0 && `${created} criado(s)`,
        skipped > 0 && `${skipped} já cadastrado(s)`,
        failed > 0 && `${failed} falha(s)`,
        notScraped > 0 && `${notScraped} sem tiers ignorado(s)`,
      ].filter(Boolean) as string[];

      if (created > 0) {
        toast.success(parts.join(" · "));
        onCreated();
        reset();
        onOpenChange(false);
      } else {
        toast.error(
          (parts.join(" · ") || "Nada foi salvo") +
            (skipped > 0 ? " — veja em Gerenciar sites" : ""),
          { duration: 8000 },
        );
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!urls.length) {
      toast.error("Cole pelo menos uma URL válida (http/https)");
      return;
    }
    if (!results.length) {
      toast.error('Clique em "Buscar preços" antes de salvar');
      return;
    }
    if (!validResults.length) {
      toast.error("Nenhuma URL retornou tiers válidos. Verifique as URLs e teste novamente.");
      return;
    }
    if (!categoria.trim()) {
      toast.error("Informe a categoria");
      return;
    }
    if (!produtoCatalogoId) {
      toast.error("Selecione uma referência");
      return;
    }

    // Pré-checagem em lote de duplicatas
    const candidateUrls = validResults.map((r) => r.source_url);
    const { data: existentes, error: dupErr } = await supabase
      .from("sites_monitorados")
      .select("url_completa, nome_produto, fornecedor_nome, ativo, preco_atual, timestamp_check")
      .in("url_completa", candidateUrls);

    if (dupErr) {
      toast.error("Erro ao verificar duplicatas: " + dupErr.message);
      return;
    }

    const dupList: DuplicadoInfo[] = (existentes || []).map((e: any) => ({
      url: e.url_completa,
      nome_produto: e.nome_produto,
      fornecedor_nome: e.fornecedor_nome,
      ativo: !!e.ativo,
      preco_atual: e.preco_atual,
      timestamp_check: e.timestamp_check,
    }));

    if (dupList.length > 0) {
      setDuplicados(dupList);
      setConfirmDupOpen(true);
      return;
    }

    await performSave(new Set());
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Novo site monitorado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-4 flex-1 min-h-0">
          <Alert>
            <Search className="h-4 w-4" />
            <AlertDescription>
              Cole uma ou mais URLs (uma por linha), teste o scraping e salve. Tudo passa pelo mesmo motor Playwright.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Categoria *</Label>
              {novaCategoriaMode || categoriasOrdenadas.length === 0 ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="ex: panfleto, flyer, cartão"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    autoFocus
                  />
                  {categoriasOrdenadas.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setNovaCategoriaMode(false);
                        setCategoria("");
                      }}
                      title="Voltar para lista"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <Select
                  value={categoria}
                  onValueChange={(v) => {
                    if (v === "__nova__") {
                      setNovaCategoriaMode(true);
                      setCategoria("");
                    } else {
                      setCategoria(v);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasOrdenadas.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                    <SelectItem value="__nova__">+ Nova categoria…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Produto canônico *</Label>
              <ProductPicker
                selectedId={produtoCatalogoId}
                selectedName={produtoCatalogoNome}
                defaultCategoria={categoria}
                onChange={({ id, name }) => {
                  setProdutoCatalogoId(id);
                  setProdutoCatalogoNome(name);
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>URLs (uma por linha)</Label>
            <Textarea
              rows={5}
              placeholder={"https://www.exemplo.com/produto-1\nhttps://www.exemplo.com/produto-2"}
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {urls.length} URL(s) válida(s) detectada(s)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleTest} disabled={testing || !urls.length} variant="outline">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar preços
            </Button>
            {results.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Última execução: {new Date().toLocaleTimeString("pt-BR")}
              </span>
            )}
          </div>

          {results.length > 0 && (
            <Alert variant={invalidResults.length > 0 ? "destructive" : "default"}>
              <AlertDescription className="text-sm">
                {results.length} URL(s) testada(s):{" "}
                <strong>{validResults.length}</strong> com tiers
                {validResults.length > 0 && (
                  <> ({validResults.map((r) => fornecedorOverrides[r.source_url] || detectSupplier(r.source_url)).join(", ")})</>
                )}
                {invalidResults.length > 0 && (
                  <>
                    {" · "}
                    <strong>{invalidResults.length}</strong> sem tiers (
                    {invalidResults
                      .map((r) => `${detectSupplier(r.source_url)} — ${r.error || "Nenhum tier encontrado"}`)
                      .join("; ")}
                    )
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((r, idx) => {
                const sb = strategyBadge(r.strategy);
                const hasTiers = r.prices.length > 0;
                return (
                  <div key={idx} className={`rounded-lg border ${!hasTiers ? "border-destructive/50" : ""}`}>
                    <div className="flex items-start justify-between gap-2 p-3 border-b bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {hasTiers ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          )}
                          <a
                            href={r.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-mono truncate hover:underline"
                          >
                            {r.source_url}
                          </a>
                        </div>
                        {r.error && (
                          <p className="text-xs text-destructive mt-1 ml-6">{r.error}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={sb.cls}>{sb.label}</Badge>
                    </div>

                    <div className="p-3 border-b bg-background flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">Fornecedor:</Label>
                      <Input
                        value={fornecedorOverrides[r.source_url] ?? ""}
                        onChange={(e) =>
                          setFornecedorOverrides((prev) => ({ ...prev, [r.source_url]: e.target.value }))
                        }
                        placeholder="Nome do fornecedor"
                        className="h-8 text-sm"
                      />
                    </div>

                    {hasTiers && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Preço unit.</TableHead>
                            <TableHead className="text-right">Preço total</TableHead>
                            <TableHead className="text-center">Calc?</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {r.prices.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-right font-mono">{p.quantity.toLocaleString("pt-BR")}</TableCell>
                              <TableCell className="text-right font-mono">{formatBRL(p.unit_price)}</TableCell>
                              <TableCell className="text-right font-mono">{formatBRL(p.total_price)}</TableCell>
                              <TableCell className="text-center">
                                {p.unit_price_calculated ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertTriangle className="h-4 w-4 text-amber-500 inline" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Preço unitário foi calculado (total / qtd), não lido diretamente.
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !validResults.length}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {results.length > 0
              ? `Salvar ${validResults.length} / ${results.length} URL(s)${
                  invalidResults.length > 0 ? ` (${invalidResults.length} sem tiers ignorada${invalidResults.length > 1 ? "s" : ""})` : ""
                }`
              : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmDupOpen} onOpenChange={setConfirmDupOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {duplicados.length === validResults.length
                ? "Todas as URLs já estão cadastradas"
                : `${duplicados.length} URL(s) já cadastrada(s)`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {duplicados.length === validResults.length
                    ? "Nenhuma URL nova para salvar. Você pode revisar os sites já cadastrados em Gerenciar sites."
                    : "Os itens abaixo já existem no banco e serão ignorados. As demais URLs serão salvas normalmente."}
                </p>
                <ul className="text-sm border rounded-md divide-y max-h-64 overflow-y-auto">
                  {duplicados.map((d) => {
                    const ultima = d.timestamp_check
                      ? new Date(d.timestamp_check).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null;
                    return (
                      <li key={d.url} className="p-2 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{d.nome_produto}</div>
                            <div className="text-xs text-muted-foreground">
                              {d.fornecedor_nome || "sem fornecedor"}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge
                              variant={d.ativo ? "default" : "secondary"}
                              className={
                                d.ativo
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                                  : ""
                              }
                            >
                              {d.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                              title="Abrir URL"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ultima ? `Última coleta: ${ultima}` : "Sem preço coletado"}
                          {d.preco_atual != null && ultima && (
                            <> · {formatBRL(d.preco_atual)}</>
                          )}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground truncate">{d.url}</div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {duplicados.length === validResults.length ? (
              onNavigateToManagement && (
                <AlertDialogAction
                  onClick={() => {
                    setConfirmDupOpen(false);
                    onOpenChange(false);
                    reset();
                    onNavigateToManagement();
                  }}
                >
                  Ir para Gerenciar sites
                </AlertDialogAction>
              )
            ) : (
              <AlertDialogAction
                onClick={async () => {
                  const skipSet = new Set(duplicados.map((d) => d.url));
                  setConfirmDupOpen(false);
                  await performSave(skipSet);
                }}
              >
                Ignorar duplicadas e salvar o resto
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
