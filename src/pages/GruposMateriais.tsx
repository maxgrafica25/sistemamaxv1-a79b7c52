import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit2, Loader2, Package, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";

interface MaterialItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  sort_order: number;
}

interface MaterialGroup {
  id: string;
  name: string;
  items: MaterialItem[];
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function GruposMateriais() {
  const [groups, setGroups] = useState<MaterialGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialGroup | null>(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState<{ id: string; description: string; quantity: number; unit_price: number }[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    const [gRes, iRes] = await Promise.all([
      supabase.from("material_groups").select("*").order("created_at"),
      supabase.from("material_group_items").select("*").order("sort_order"),
    ]);
    if (gRes.data && iRes.data) {
      setGroups(
        gRes.data.map((g) => ({
          ...g,
          items: iRes.data.filter((i) => i.material_group_id === g.id),
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const openNew = () => {
    setEditing(null);
    setName("");
    setItems([{ id: `${Date.now()}`, description: "", quantity: 1, unit_price: 0 }]);
    setIsDialogOpen(true);
  };

  const openEdit = (g: MaterialGroup) => {
    setEditing(g);
    setName(g.name);
    setItems(
      g.items.map((i) => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    );
    setIsDialogOpen(true);
  };

  const addItem = () =>
    setItems((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, description: "", quantity: 1, unit_price: 0 }]);

  const updateItem = (id: string, field: string, value: string | number) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const save = async () => {
    if (!name.trim()) {
      toast.error("Digite um nome para o grupo");
      return;
    }
    if (items.length === 0 || items.some((i) => !i.description.trim())) {
      toast.error("Adicione ao menos um item válido");
      return;
    }

    if (editing) {
      await supabase.from("material_groups").update({ name }).eq("id", editing.id);
      await supabase.from("material_group_items").delete().eq("material_group_id", editing.id);
      await supabase.from("material_group_items").insert(
        items.map((i, idx) => ({
          material_group_id: editing.id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          sort_order: idx,
        })),
      );
      toast.success("Grupo atualizado!");
    } else {
      const { data } = await supabase.from("material_groups").insert({ name }).select("id").single();
      if (data) {
        await supabase.from("material_group_items").insert(
          items.map((i, idx) => ({
            material_group_id: data.id,
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
            sort_order: idx,
          })),
        );
      }
      toast.success("Grupo criado!");
    }
    setIsDialogOpen(false);
    fetchGroups();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await supabase.from("material_groups").delete().eq("id", deletingId);
    toast.success("Grupo excluído!");
    setDeletingId(null);
    fetchGroups();
  };

  const groupTotal = (its: MaterialItem[]) =>
    its.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          Grupos de Materiais
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Templates de materiais reutilizáveis para acelerar a montagem de orçamentos
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{groups.length} grupo(s) cadastrado(s)</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Grupo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Grupo de Materiais" : "Novo Grupo de Materiais"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label>Nome do Grupo *</Label>
                <Input
                  placeholder="Ex: Cartão de Visita Padrão"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Itens *</Label>
                  <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
                    <Plus className="h-4 w-4" /> Item
                  </Button>
                </div>
                {items.map((it, idx) => (
                  <div key={it.id} className="flex gap-2 items-start">
                    <span className="flex h-9 w-7 items-center justify-center text-xs font-medium text-muted-foreground">
                      {idx + 1}
                    </span>
                    <Input
                      placeholder="Descrição do material"
                      value={it.description}
                      onChange={(e) => updateItem(it.id, "description", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Qtd"
                      value={it.quantity || ""}
                      onChange={(e) => updateItem(it.id, "quantity", parseFloat(e.target.value) || 0)}
                      className="w-20"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="R$"
                      value={it.unit_price || ""}
                      onChange={(e) => updateItem(it.id, "unit_price", parseFloat(e.target.value) || 0)}
                      className="w-28"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(it.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={save} className="flex-1">
                  {editing ? "Atualizar Grupo" : "Criar Grupo"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Nenhum grupo de materiais cadastrado ainda</p>
            <Button onClick={openNew} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Criar primeiro grupo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.id}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h3 className="font-semibold text-foreground">{g.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {g.items.length} item(ns) · Total estimado: {formatBRL(groupTotal(g.items))}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(g)}
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingId(g.id)}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-24 text-center">Qtd</TableHead>
                      <TableHead className="w-32 text-right">Preço un.</TableHead>
                      <TableHead className="w-32 text-right pr-6">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map((it, idx) => (
                      <TableRow key={it.id}>
                        <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>{it.description}</TableCell>
                        <TableCell className="text-center">{it.quantity}</TableCell>
                        <TableCell className="text-right">{formatBRL(it.unit_price)}</TableCell>
                        <TableCell className="text-right pr-6 font-medium">
                          {formatBRL(it.quantity * it.unit_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Excluir Grupo"
        description="Tem certeza que deseja excluir este grupo de materiais?"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
