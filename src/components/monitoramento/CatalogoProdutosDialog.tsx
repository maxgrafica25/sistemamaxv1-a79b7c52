import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Pencil, Merge, Unlink, Check, X, Search } from "lucide-react";
import { toast } from "sonner";
import type { ProdutoCatalogo } from "@/lib/produtoCatalogo";
import { findOrCreateCatalogo } from "@/lib/produtoCatalogo";

type SiteRow = {
  id: string;
  nome_produto: string;
  fornecedor_nome: string | null;
  produto_catalogo_id: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
  getSupplierColor: (name: string | null | undefined) => { bg: string; border: string; text: string; solid: string };
};

export default function CatalogoProdutosDialog({ open, onOpenChange, onChanged, getSupplierColor }: Props) {
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      supabase.from("produtos_catalogo").select("*").order("nome_canonico"),
      supabase.from("sites_monitorados").select("id, nome_produto, fornecedor_nome, produto_catalogo_id"),
    ]);
    if (pRes.data) setProdutos(pRes.data as ProdutoCatalogo[]);
    if (sRes.data) setSites(sRes.data as SiteRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchAll();
      setSelected(new Set());
      setEditingId(null);
      setSearch("");
      setMergeMasterId(null);
    }
  }, [open]);

  const sitesByProduto = useMemo(() => {
    const map: Record<string, SiteRow[]> = {};
    for (const s of sites) {
      if (s.produto_catalogo_id) (map[s.produto_catalogo_id] ||= []).push(s);
    }
    return map;
  }, [sites]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter((p) => p.nome_canonico.toLowerCase().includes(q));
  }, [produtos, search]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
      if (mergeMasterId === id) setMergeMasterId(null);
    } else {
      next.add(id);
    }
    setSelected(next);
  };


  const [mergeMasterId, setMergeMasterId] = useState<string | null>(null);

  const handleMerge = async () => {
    if (selected.size < 2) return toast.error("Selecione pelo menos 2 produtos para unificar");
    if (!mergeMasterId || !selected.has(mergeMasterId)) {
      return toast.error("Escolha qual nome será mantido (clique no radio do produto principal)");
    }
    const ids = Array.from(selected);
    const master = produtos.find((p) => p.id === mergeMasterId)!;
    const others = ids.filter((id) => id !== master.id);
    const totalSites = others.reduce((acc, id) => acc + (sitesByProduto[id]?.length || 0), 0);

    if (!confirm(
      `Unificar ${ids.length} produtos em "${master.nome_canonico}"?\n\n` +
      `• ${totalSites} site(s) vinculados serão migrados\n` +
      `• ${others.length} entrada(s) duplicada(s) do catálogo serão excluídas\n` +
      `• Os links/preços/fornecedores de cada site são preservados`
    )) return;

    setBusy(true);
    try {
      // Migra apenas o vínculo (produto_catalogo_id). URL, preço, fornecedor permanecem intactos.
      const { error: upErr } = await supabase
        .from("sites_monitorados")
        .update({ produto_catalogo_id: master.id })
        .in("produto_catalogo_id", others);
      if (upErr) throw upErr;

      const { error: delErr } = await supabase
        .from("produtos_catalogo")
        .delete()
        .in("id", others);
      if (delErr) throw delErr;

      toast.success(`Unificado em "${master.nome_canonico}" — ${totalSites} site(s) agrupados`);
      setSelected(new Set());
      setMergeMasterId(null);
      await fetchAll();
      onChanged();
    } catch (e: any) {
      toast.error("Erro ao unificar: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string) => {
    const nome = editName.trim();
    if (!nome) return toast.error("Nome não pode ficar vazio");
    setBusy(true);
    try {
      const { error } = await supabase
        .from("produtos_catalogo")
        .update({ nome_canonico: nome })
        .eq("id", id);
      if (error) throw error;
      toast.success("Renomeado");
      setEditingId(null);
      await fetchAll();
      onChanged();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async (site: SiteRow) => {
    if (!confirm(`Desvincular "${site.nome_produto}" desta referência? Será criada uma nova referência para ele.`)) return;
    setBusy(true);
    try {
      const newId = await findOrCreateCatalogo(site.nome_produto + " (variante)");
      if (!newId) throw new Error("Falha ao criar novo produto");
      const { error } = await supabase
        .from("sites_monitorados")
        .update({ produto_catalogo_id: newId })
        .eq("id", site.id);
      if (error) throw error;
      toast.success("Desvinculado");
      await fetchAll();
      onChanged();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Produtos de Referência</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
          <p className="font-semibold">Como unificar produtos iguais de fornecedores diferentes:</p>
          <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
            <li>Marque o <strong>checkbox</strong> de 2 ou mais produtos que são o mesmo item.</li>
            <li>Clique no <strong>radio (●)</strong> do produto cujo nome será mantido como padrão.</li>
            <li>Clique em <strong>"Unificar selecionados"</strong>. Os links/preços/fornecedores de cada site são <strong>preservados</strong> — só o nome padrão e o agrupamento mudam.</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-8"
            />
          </div>
          <Button
            onClick={handleMerge}
            disabled={busy || selected.size < 2 || !mergeMasterId}
            variant="default"
          >
            <Merge className="h-4 w-4" />
            Unificar selecionados ({selected.size})
          </Button>
        </div>


        {loading ? (
          <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
            Nenhum produto no catálogo. Cadastre um site monitorado para começar.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const sitesVinc = sitesByProduto[p.id] || [];
              const isEditing = editingId === p.id;
              return (
                <Card key={p.id} className={selected.has(p.id) ? "border-primary" : ""}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                      />
                      {selected.has(p.id) && (
                        <input
                          type="radio"
                          name="merge-master"
                          checked={mergeMasterId === p.id}
                          onChange={() => setMergeMasterId(p.id)}
                          title="Manter este nome ao unificar"
                          className="h-4 w-4 accent-primary cursor-pointer"
                        />
                      )}
                      {isEditing ? (
                        <>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" onClick={() => handleRename(p.id)} disabled={busy}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="font-medium flex-1 truncate">{p.nome_canonico}</span>
                          <Badge variant="outline" className="text-xs">
                            {sitesVinc.length} {sitesVinc.length === 1 ? "fornecedor" : "fornecedores"}
                          </Badge>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => { setEditingId(p.id); setEditName(p.nome_canonico); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                    {sitesVinc.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-7">
                        {sitesVinc.map((s) => {
                          const cor = getSupplierColor(s.fornecedor_nome);
                          return (
                            <div
                              key={s.id}
                              className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"
                              style={{ backgroundColor: cor.bg, borderColor: cor.border, color: cor.text }}
                            >
                              <span className="font-semibold">{s.fornecedor_nome || "—"}</span>
                              <span className="text-muted-foreground truncate max-w-[200px]">· {s.nome_produto}</span>
                              <button
                                type="button"
                                onClick={() => handleUnlink(s)}
                                className="opacity-60 hover:opacity-100"
                                title="Desvincular"
                              >
                                <Unlink className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
