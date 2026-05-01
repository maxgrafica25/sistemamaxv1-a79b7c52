import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import type { ProdutoCatalogo } from "@/lib/produtoCatalogo";

type ProdutoComContagem = ProdutoCatalogo & { _count: number };

export default function Produtos() {
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoComContagem[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProdutoCatalogo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nome_canonico: "", categoria: "", dimensoes: "", gramatura: "", observacoes: "" });
  const [busy, setBusy] = useState(false);

  const fetchProdutos = async () => {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      supabase.from("produtos_catalogo").select("*").order("nome_canonico"),
      supabase.from("sites_monitorados").select("produto_catalogo_id"),
    ]);
    const counts = new Map<string, number>();
    (sRes.data || []).forEach((s: any) => {
      if (s.produto_catalogo_id) counts.set(s.produto_catalogo_id, (counts.get(s.produto_catalogo_id) || 0) + 1);
    });
    setProdutos(((pRes.data || []) as ProdutoCatalogo[]).map((p) => ({ ...p, _count: counts.get(p.id) || 0 })));
    setLoading(false);
  };

  useEffect(() => { fetchProdutos(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ nome_canonico: "", categoria: "", dimensoes: "", gramatura: "", observacoes: "" });
    setDialogOpen(true);
  };

  const openEdit = (p: ProdutoCatalogo) => {
    setEditing(p);
    setForm({
      nome_canonico: p.nome_canonico,
      categoria: p.categoria || "",
      dimensoes: p.dimensoes || "",
      gramatura: p.gramatura || "",
      observacoes: p.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const nome = form.nome_canonico.trim();
    if (!nome) return toast.error("Nome é obrigatório");
    setBusy(true);
    try {
      const payload = {
        nome_canonico: nome,
        categoria: form.categoria.trim().toLowerCase() || null,
        dimensoes: form.dimensoes.trim() || null,
        gramatura: form.gramatura.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("produtos_catalogo").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Referência atualizada!");
      } else {
        const { error } = await supabase.from("produtos_catalogo").insert(payload);
        if (error) throw error;
        toast.success("Referência cadastrada com sucesso!");
      }
      setDialogOpen(false);
      await fetchProdutos();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (p: ProdutoComContagem) => {
    if (p._count > 0) {
      return toast.error(`Este produto tem ${p._count} site(s) vinculado(s). Desvincule ou unifique antes de excluir.`);
    }
    if (!confirm(`Excluir "${p.nome_canonico}"?`)) return;
    const { error } = await supabase.from("produtos_catalogo").delete().eq("id", p.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Excluído");
    await fetchProdutos();
  };

  const filtered = produtos.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.nome_canonico.toLowerCase().includes(q) || (p.categoria || "").toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6" />Catálogo de Produtos</h1>
          <p className="text-sm text-muted-foreground">Biblioteca de nomes canônicos. Use no monitoramento para padronizar produtos entre fornecedores.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" />Novo produto</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-8" />
      </div>

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          {produtos.length === 0 ? "Nenhum produto cadastrado. Clique em \"Novo produto\" para começar." : "Nenhum produto corresponde à busca."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{p.nome_canonico}</span>
                    {p.categoria && <Badge variant="outline" className="text-xs">{p.categoria}</Badge>}
                    {p.dimensoes && <Badge variant="secondary" className="text-xs">{p.dimensoes}</Badge>}
                    {p.gramatura && <Badge variant="secondary" className="text-xs">{p.gramatura}</Badge>}
                    <Badge variant={p._count > 0 ? "default" : "outline"} className="text-xs">
                      {p._count} {p._count === 1 ? "site" : "sites"}
                    </Badge>
                  </div>
                  {p.observacoes && <p className="text-xs text-muted-foreground mt-1 truncate">{p.observacoes}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(p)}><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome canônico *</Label>
              <Input value={form.nome_canonico} onChange={(e) => setForm({ ...form, nome_canonico: e.target.value })} placeholder="Ex: Panfleto 10x14 Couché 90g" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Categoria</Label>
                <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="panfleto, banner..." />
              </div>
              <div>
                <Label>Dimensões</Label>
                <Input value={form.dimensoes} onChange={(e) => setForm({ ...form, dimensoes: e.target.value })} placeholder="10x14 cm" />
              </div>
              <div>
                <Label>Gramatura</Label>
                <Input value={form.gramatura} onChange={(e) => setForm({ ...form, gramatura: e.target.value })} placeholder="90g" />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
