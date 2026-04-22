import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";

interface BaseConhecimentoItem {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string | null;
  ativo: boolean;
  atualizado_em: string;
}

const empty = { titulo: "", conteudo: "", categoria: "", ativo: true };

export default function BaseConhecimentoTab() {
  const [items, setItems] = useState<BaseConhecimentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BaseConhecimentoItem | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("base_conhecimento" as any)
      .select("id, titulo, conteudo, categoria, ativo, atualizado_em")
      .order("atualizado_em", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar base de conhecimento");
    } else {
      setItems((data as unknown as BaseConhecimentoItem[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setDialogOpen(true);
  }

  function openEdit(item: BaseConhecimentoItem) {
    setEditing(item);
    setForm({
      titulo: item.titulo,
      conteudo: item.conteudo,
      categoria: item.categoria ?? "",
      ativo: item.ativo,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.titulo.trim()) {
      toast.error("Informe um título");
      return;
    }
    if (!form.conteudo.trim()) {
      toast.error("Informe o conteúdo");
      return;
    }
    setSaving(true);
    const payload = {
      titulo: form.titulo.trim().slice(0, 200),
      conteudo: form.conteudo.trim(),
      categoria: form.categoria.trim() || null,
      ativo: form.ativo,
    };
    const op = editing
      ? supabase.from("base_conhecimento" as any).update(payload).eq("id", editing.id)
      : supabase.from("base_conhecimento" as any).insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(editing ? "Conhecimento atualizado" : "Conhecimento adicionado");
    setDialogOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase
      .from("base_conhecimento" as any)
      .delete()
      .eq("id", deleteId);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Conhecimento excluído");
      load();
    }
    setDeleteId(null);
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Base de Conhecimento do Assistente
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Conteúdo manual que o assistente virtual usa como fonte de verdade.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo conhecimento
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum conhecimento cadastrado ainda.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.titulo}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.categoria || "—"}
                  </TableCell>
                  <TableCell>
                    {item.ativo ? (
                      <Badge variant="default" className="bg-accent text-accent-foreground">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(item.atualizado_em).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(item)}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(item.id)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar conhecimento" : "Novo conhecimento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                maxLength={200}
                placeholder="Ex: Regras de desconto para clientes recorrentes"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categoria">Categoria (opcional)</Label>
              <Input
                id="categoria"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                placeholder="Ex: Política comercial"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conteudo">Conteúdo</Label>
              <Textarea
                id="conteudo"
                value={form.conteudo}
                onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                rows={10}
                placeholder="Escreva instruções, regras, FAQ, procedimentos..."
                className="min-h-[180px]"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="ativo" className="text-sm font-medium">
                  Ativo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando desligado, o assistente ignora este item.
                </p>
              </div>
              <Switch
                id="ativo"
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir conhecimento"
        description="Tem certeza? O assistente deixará de usar este conteúdo."
        confirmText="Excluir"
        variant="destructive"
      />
    </Card>
  );
}
