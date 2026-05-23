import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit2, Palette, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import PageLoader from "@/components/PageLoader";
import { useStepCategories, type StepCategory } from "@/hooks/useStepCategories";
import { useQueryClient } from "@tanstack/react-query";

const COLOR_PRESETS = [
  "#3b82f6", "#10b981", "#f97316", "#ef4444",
  "#a855f7", "#ec4899", "#eab308", "#14b8a6",
  "#6366f1", "#6b7280", "#0ea5e9", "#84cc16",
];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "categoria";
}

export default function CategoriasTab() {
  const { data: categories, isLoading } = useStepCategories();
  const qc = useQueryClient();
  const { requireAdmin } = usePermissionGuard();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StepCategory | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["production_step_categories"] });

  const openNew = () => {
    setEditing(null); setName(""); setColor("#6366f1");
    setIsDialogOpen(true);
  };
  const openEdit = (c: StepCategory) => {
    setEditing(c); setName(c.name); setColor(c.color);
    setIsDialogOpen(true);
  };

  const save = async () => {
    if (!requireAdmin(editing ? "editar categoria" : "criar categoria")) return;
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Digite um nome"); return; }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) { toast.error("Cor inválida"); return; }

    if (editing) {
      const { error } = await supabase
        .from("production_step_categories" as any)
        .update({ name: trimmed, color })
        .eq("id", editing.id);
      if (error) return handleError(error, "atualizar categoria");
      toast.success("Categoria atualizada!");
    } else {
      const slug = slugify(trimmed);
      const sort = (categories?.length ?? 0) + 1;
      const { error } = await supabase
        .from("production_step_categories" as any)
        .insert({ name: trimmed, slug, color, sort_order: sort });
      if (error) return handleError(error, "criar categoria");
      toast.success("Categoria criada!");
    }
    setIsDialogOpen(false);
    refresh();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    if (!requireAdmin("excluir categoria")) { setDeletingId(null); return; }
    const cat = categories?.find((c) => c.id === deletingId);
    if (cat) {
      const { count } = await supabase
        .from("production_steps")
        .select("id", { count: "exact", head: true })
        .eq("step_type", cat.slug);
      if ((count ?? 0) > 0) {
        toast.error(`Não é possível excluir: ${count} etapa(s) usam esta categoria.`);
        setDeletingId(null);
        return;
      }
    }
    const { error } = await supabase
      .from("production_step_categories" as any)
      .delete().eq("id", deletingId);
    if (error) { handleError(error, "excluir categoria"); setDeletingId(null); return; }
    toast.success("Categoria excluída!");
    setDeletingId(null);
    refresh();
  };

  if (isLoading) return <PageLoader />;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categories?.length ?? 0} categoria(s)</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <AdminOnly mode="disable" action="criar categoria">
              <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova Categoria</Button>
            </AdminOnly>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input placeholder="Ex: Pré-impressão" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" maxLength={7} />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="h-7 w-7 rounded-full border-2 border-border transition hover:scale-110"
                      style={{ backgroundColor: c, borderColor: color === c ? "hsl(var(--ring))" : undefined }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="mb-2 text-xs text-muted-foreground">Preview</p>
                <PreviewBadge name={name || "Categoria"} color={color} />
              </div>
              <Button onClick={save} className="w-full">{editing ? "Salvar Alterações" : "Criar Categoria"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(categories?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Palette className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Nenhuma categoria cadastrada</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-32">Cor</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories!.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PreviewBadge name={c.name} color={c.color} />
                      {c.is_system && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Lock className="h-3 w-3" /> sistema
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded-full border border-border" style={{ backgroundColor: c.color }} />
                      <code className="text-xs text-muted-foreground">{c.color}</code>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => setDeletingId(c.id)}
                        disabled={c.is_system}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Excluir Categoria"
        description="Tem certeza que deseja excluir esta categoria?"
        onConfirm={confirmDelete}
      />
    </>
  );
}

function PreviewBadge({ name, color }: { name: string; color: string }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#6b7280";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
        color: hex,
        borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
      }}
    >
      {name}
    </span>
  );
}
