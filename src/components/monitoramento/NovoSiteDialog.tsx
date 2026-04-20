import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FlaskConical, Loader2, Save, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { findOrCreateCatalogo } from "@/lib/produtoCatalogo";
import ProductPicker from "./ProductPicker";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
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
  strategy: "api" | "html" | "html-regex";
  prices: WorkerPrice[];
  error: string | null;
};

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 4 });

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

const strategyBadge = (s: WorkerResult["strategy"]) => {
  const map = {
    api: { label: "api", cls: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800" },
    html: { label: "html", cls: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800" },
    "html-regex": { label: "html-regex", cls: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800" },
  };
  return map[s];
};

export default function NovoSiteDialog({ open, onOpenChange, onCreated }: Props) {
  const [urlsText, setUrlsText] = useState("");
  const [categoria, setCategoria] = useState("");
  const [produtoCatalogoId, setProdutoCatalogoId] = useState<string | null>(null);
  const [produtoCatalogoNome, setProdutoCatalogoNome] = useState("");
  const [results, setResults] = useState<WorkerResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const urls = useMemo(
    () =>
      urlsText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s)),
    [urlsText],
  );

  const reset = () => {
    setUrlsText("");
    setCategoria("");
    setProdutoCatalogoId(null);
    setProdutoCatalogoNome("");
    setResults([]);
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
      toast.error(e?.message || "Erro ao testar scraping");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const valid = results.filter((r) => r.prices.length > 0);
    if (!valid.length) {
      toast.error("Nenhuma URL com tiers para salvar. Rode o teste primeiro.");
      return;
    }
    if (!categoria.trim()) {
      toast.error("Informe a categoria");
      return;
    }
    if (!produtoCatalogoNome.trim()) {
      toast.error("Selecione ou digite o produto do catálogo");
      return;
    }

    setSaving(true);
    let created = 0;
    let skipped = 0;
    let failed = 0;

    try {
      // Resolver produto canônico uma única vez
      let catalogoId = produtoCatalogoId;
      if (!catalogoId) {
        catalogoId = await findOrCreateCatalogo(produtoCatalogoNome, categoria);
      }

      for (const r of valid) {
        // Dedupe por URL exata
        const { data: dup } = await supabase
          .from("sites_monitorados")
          .select("id")
          .eq("url_completa", r.source_url)
          .limit(1);
        if (dup && dup.length) {
          skipped++;
          continue;
        }

        const fornecedor = extractDomainName(r.source_url);
        const minUnit = Math.min(...r.prices.map((p) => p.unit_price));

        const { data: inserted, error: insErr } = await supabase
          .from("sites_monitorados")
          .insert({
            nome_produto: produtoCatalogoNome.trim(),
            categoria: categoria.trim().toLowerCase(),
            url_completa: r.source_url,
            fornecedor_nome: fornecedor || null,
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
        skipped > 0 && `${skipped} duplicado(s)`,
        failed > 0 && `${failed} falha(s)`,
      ].filter(Boolean) as string[];

      if (created > 0) {
        toast.success(parts.join(" · "));
        onCreated();
        reset();
        onOpenChange(false);
      } else {
        toast.error(parts.join(" · ") || "Nada foi salvo");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo site monitorado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <FlaskConical className="h-4 w-4" />
            <AlertDescription>
              Cole uma ou mais URLs (uma por linha), teste o scraping e salve. Tudo passa pelo mesmo motor Playwright.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Categoria *</Label>
              <Input
                placeholder="ex: panfleto, flyer, cartão"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Produto canônico *</Label>
              <ProductPicker
                selectedId={produtoCatalogoId}
                selectedName={produtoCatalogoNome}
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
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Testar scraping
            </Button>
            {results.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Última execução: {new Date().toLocaleTimeString("pt-BR")}
              </span>
            )}
          </div>

          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((r, idx) => {
                const sb = strategyBadge(r.strategy);
                return (
                  <div key={idx} className="rounded-lg border">
                    <div className="flex items-start justify-between gap-2 p-3 border-b bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {r.prices.length > 0 ? (
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
                    {r.prices.length > 0 && (
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

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !results.some((r) => r.prices.length > 0)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar {results.filter((r) => r.prices.length > 0).length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
