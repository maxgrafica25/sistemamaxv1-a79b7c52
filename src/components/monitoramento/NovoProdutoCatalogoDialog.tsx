import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProdutoCatalogo } from "@/lib/produtoCatalogo";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName?: string;
  initialCategoria?: string;
  onCreated: (produto: ProdutoCatalogo) => void;
};

export default function NovoProdutoCatalogoDialog({
  open,
  onOpenChange,
  initialName = "",
  initialCategoria = "",
  onCreated,
}: Props) {
  const [form, setForm] = useState({
    nome_canonico: "",
    categoria: "",
    dimensoes: "",
    gramatura: "",
    observacoes: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        nome_canonico: initialName,
        categoria: initialCategoria,
        dimensoes: "",
        gramatura: "",
        observacoes: "",
      });
    }
  }, [open, initialName, initialCategoria]);

  const handleSave = async () => {
    const nome = form.nome_canonico.trim();
    if (!nome) {
      toast.error("Nome é obrigatório");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        nome_canonico: nome,
        categoria: form.categoria.trim().toLowerCase() || null,
        dimensoes: form.dimensoes.trim() || null,
        gramatura: form.gramatura.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };
      const { data, error } = await supabase
        .from("produtos_catalogo")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      toast.success("Produto cadastrado");
      onCreated(data as ProdutoCatalogo);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo produto no catálogo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome canônico *</Label>
            <Input
              value={form.nome_canonico}
              onChange={(e) => setForm({ ...form, nome_canonico: e.target.value })}
              placeholder="Ex: Panfleto 10x14 Couché 90g"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Categoria</Label>
              <Input
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                placeholder="panfleto, banner..."
              />
            </div>
            <div>
              <Label>Dimensões</Label>
              <Input
                value={form.dimensoes}
                onChange={(e) => setForm({ ...form, dimensoes: e.target.value })}
                placeholder="10x14 cm"
              />
            </div>
            <div>
              <Label>Gramatura</Label>
              <Input
                value={form.gramatura}
                onChange={(e) => setForm({ ...form, gramatura: e.target.value })}
                placeholder="90g"
              />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Input
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
