import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Loader2, Package, Layers, Link2, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import SupplySearch from "@/components/orcamentos-v2/SupplySearch";

interface MaterialItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  sort_order: number;
  supply_id: string | null;
  // Live unit price coming from supplies table (when linked)
  live_unit_price?: number | null;
}

interface MaterialGroup {
  id: string;
  name: string;
  items: MaterialItem[];
}

interface DraftItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  supply_id: string | null;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function GruposMateriais() {
  const [groups, setGroups] = useState<MaterialGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialGroup | null>(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    const [gRes, iRes, sRes] = await Promise.all([
      supabase.from("material_groups").select("*").order("created_at"),
      supabase.from("material_group_items").select("*").order("sort_order"),
      supabase.from("supplies").select("id, valor_unitario"),
    ]);
    if (gRes.data && iRes.data) {
      const supplyMap = new Map<string, number>(
        (sRes.data || []).map((s: any) => [s.id, Number(s.valor_unitario) || 0]),
      );
      setGroups(
        gRes.data.map((g) => ({
          ...g,
          items: iRes.data
            .filter((i: any) => i.material_group_id === g.id)
            .map((i: any) => ({
              ...i,
              supply_id: i.supply_id ?? null,
              live_unit_price: i.supply_id ? supplyMap.get(i.supply_id) ?? null : null,
            })),
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const blankItem = (): DraftItem => ({
    id: `${Date.now()}-${Math.random()}`,
    description: "",
    quantity: 1,
    unit_price: 0,
    supply_id: null,
  });

  const openNew = () => {
    setEditing(null);
    setName("");
    setItems([blankItem()]);
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
        // If linked, prefer live price from supplies
        unit_price: i.supply_id && i.live_unit_price != null ? i.live_unit_price : i.unit_price,
        supply_id: i.supply_id ?? null,
      })),
    );
    setIsDialogOpen(true);
  };

  const addItem = () => setItems((prev) => [...prev, blankItem()]);

  const updateItem = (id: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

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

    const payload = (groupId: string) =>
      items.map((i, idx) => ({
        material_group_id: groupId,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        supply_id: i.supply_id,
        sort_order: idx,
      }));

    if (editing) {
      await supabase.from("material_groups").update({ name }).eq("id", editing.id);
      await supabase.from("material_group_items").delete().eq("material_group_id", editing.id);
      await supabase.from("material_group_items").insert(payload(editing.id));
      toast.success("Grupo atualizado!");
    } else {
      const { data } = await supabase.from("material_groups").insert({ name }).select("id").single();
      if (data) await supabase.from("material_group_items").insert(payload(data.id));
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
    its.reduce((s, i) => {
      const price = i.supply_id && i.live_unit_price != null ? i.live_unit_price : i.unit_price;
      return s + i.quantity * price;
    }, 0);

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
          Templates reutilizáveis. Vincule cada item a um suprimento cadastrado para usar sempre o preço atualizado.
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
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
                {items.map((it, idx) => {
                  const linked = !!it.supply_id;
                  return (
                    <div key={it.id} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                      <div className="flex gap-2 items-center">
                        <span className="flex h-9 w-7 items-center justify-center text-xs font-medium text-muted-foreground">
                          {idx + 1}
                        </span>

                        {linked ? (
                          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border bg-background">
                            <Link2 className="h-4 w-4 text-primary shrink-0" />
                            <span className="flex-1 truncate text-sm font-medium">{it.description}</span>
                            <Badge variant="secondary" className="text-xs">vinculado</Badge>
                          </div>
                        ) : (
                          <SupplySearch
                            initialLabel={it.description}
                            onSelect={(s) =>
                              updateItem(it.id, {
                                supply_id: s.id,
                                description: s.produto,
                                unit_price: Number(s.valor_unitario) || 0,
                              })
                            }
                          />
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(it.id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex gap-2 items-center pl-9">
                        <div className="flex flex-col gap-0.5">
                          <Label className="text-[10px] text-muted-foreground uppercase">Qtd</Label>
                          <Input
                            type="number"
                            value={it.quantity || ""}
                            onChange={(e) => updateItem(it.id, { quantity: parseFloat(e.target.value) || 0 })}
                            className="w-20 h-8"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <Label className="text-[10px] text-muted-foreground uppercase">Preço un.</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={it.unit_price || ""}
                            onChange={(e) => updateItem(it.id, { unit_price: parseFloat(e.target.value) || 0 })}
                            className="w-32 h-8"
                            disabled={linked}
                            title={linked ? "Preço vem do cadastro de Suprimentos" : ""}
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <Label className="text-[10px] text-muted-foreground uppercase">Subtotal</Label>
                          <div className="h-8 flex items-center px-2 text-sm font-medium tabular-nums">
                            {formatBRL((it.quantity || 0) * (it.unit_price || 0))}
                          </div>
                        </div>

                        {linked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateItem(it.id, { supply_id: null })
                            }
                            className="ml-auto gap-1 text-xs text-muted-foreground"
                            title="Desvincular do cadastro (preço passa a ser editável)"
                          >
                            <Link2Off className="h-3.5 w-3.5" /> Desvincular
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                    {g.items.map((it, idx) => {
                      const livePrice =
                        it.supply_id && it.live_unit_price != null ? it.live_unit_price : it.unit_price;
                      return (
                        <TableRow key={it.id}>
                          <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {it.supply_id && <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                              <span>{it.description}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{it.quantity}</TableCell>
                          <TableCell className="text-right">{formatBRL(livePrice)}</TableCell>
                          <TableCell className="text-right pr-6 font-medium">
                            {formatBRL(it.quantity * livePrice)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
