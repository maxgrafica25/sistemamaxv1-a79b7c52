import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, ArrowRightLeft, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import ConfirmDialog from "@/components/ConfirmDialog";

type CategoriaInfo = { nome: string; count: number };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categorias: CategoriaInfo[];
  onChanged: () => void;
  onCategoriaRemoved?: (nome: string) => void;
}

export default function GerenciarCategoriasDialog({
  open,
  onOpenChange,
  categorias,
  onChanged,
  onCategoriaRemoved,
}: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [movingFrom, setMovingFrom] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [deleting, setDeleting] = useState<CategoriaInfo | null>(null);
  const [deleteMode, setDeleteMode] = useState<"move" | "delete">("move");
  const [deleteMoveTarget, setDeleteMoveTarget] = useState<string>("");
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditingName(null);
      setEditValue("");
      setMovingFrom(null);
      setMoveTarget("");
      setDeleting(null);
      setDeleteMode("move");
      setDeleteMoveTarget("");
      setConfirmHardDelete(false);
    }
  }, [open]);

  const otherCategorias = (excluding: string) =>
    categorias.filter((c) => c.nome !== excluding);

  const handleRename = async (oldName: string) => {
    const novo = editValue.toLowerCase().trim();
    if (!novo) return toast.error("Nome não pode ficar vazio");
    if (novo === oldName) {
      setEditingName(null);
      return;
    }
    setBusy(true);
    const { error, count } = await supabase
      .from("sites_monitorados")
      .update({ categoria: novo }, { count: "exact" })
      .eq("categoria", oldName);
    setBusy(false);
    if (error) return toast.error("Erro ao renomear: " + error.message);
    toast.success(`Categoria renomeada · ${count ?? 0} sites atualizados`);
    setEditingName(null);
    onChanged();
    onCategoriaRemoved?.(oldName);
  };

  const handleMove = async (origem: string) => {
    if (!moveTarget) return toast.error("Selecione uma categoria de destino");
    setBusy(true);
    const { error, count } = await supabase
      .from("sites_monitorados")
      .update({ categoria: moveTarget }, { count: "exact" })
      .eq("categoria", origem);
    setBusy(false);
    if (error) return toast.error("Erro ao mover: " + error.message);
    toast.success(`${count ?? 0} sites movidos para "${moveTarget}"`);
    setMovingFrom(null);
    setMoveTarget("");
    onChanged();
    onCategoriaRemoved?.(origem);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    if (deleteMode === "move") {
      if (!deleteMoveTarget) return toast.error("Selecione uma categoria de destino");
      setBusy(true);
      const { error, count } = await supabase
        .from("sites_monitorados")
        .update({ categoria: deleteMoveTarget }, { count: "exact" })
        .eq("categoria", deleting.nome);
      setBusy(false);
      if (error) return toast.error("Erro ao mover: " + error.message);
      toast.success(`${count ?? 0} sites movidos para "${deleteMoveTarget}"`);
      onCategoriaRemoved?.(deleting.nome);
      setDeleting(null);
      onChanged();
    } else {
      // hard delete - exige confirmação extra
      setConfirmHardDelete(true);
    }
  };

  const executeHardDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    // Buscar IDs dos sites para limpar dependências sem cascade
    const { data: siteIds, error: selErr } = await supabase
      .from("sites_monitorados")
      .select("id")
      .eq("categoria", deleting.nome);
    if (selErr) {
      setBusy(false);
      return toast.error("Erro ao buscar sites: " + selErr.message);
    }
    const ids = (siteIds || []).map((s) => s.id);
    if (ids.length > 0) {
      // remover filhos (sem FK cascade garantido)
      await supabase.from("historico_precos_tiers").delete().in("site_id", ids);
      await supabase.from("historico_precos").delete().in("site_id", ids);
      await supabase.from("alertas_precos").delete().in("site_id", ids);
      await supabase.from("site_precos_tiers").delete().in("site_id", ids);
    }
    const { error, count } = await supabase
      .from("sites_monitorados")
      .delete({ count: "exact" })
      .eq("categoria", deleting.nome);
    setBusy(false);
    if (error) return toast.error("Erro ao excluir: " + error.message);
    toast.success(`Categoria "${deleting.nome}" excluída · ${count ?? 0} sites removidos`);
    onCategoriaRemoved?.(deleting.nome);
    setConfirmHardDelete(false);
    setDeleting(null);
    onChanged();
  };

  const sorted = useMemo(
    () => [...categorias].sort((a, b) => a.nome.localeCompare(b.nome)),
    [categorias]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
            <DialogDescription>
              Renomeie, funda ou exclua categorias do monitoramento. Categorias sem sites somem automaticamente.
            </DialogDescription>
          </DialogHeader>

          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma categoria cadastrada.
            </p>
          ) : (
            <div className="space-y-2">
              {sorted.map((cat) => {
                const isEditing = editingName === cat.nome;
                const isMoving = movingFrom === cat.nome;
                const others = otherCategorias(cat.nome);

                return (
                  <div
                    key={cat.nome}
                    className="flex flex-col gap-2 rounded-md border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isEditing ? (
                          <>
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8 max-w-xs"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRename(cat.nome);
                                if (e.key === "Escape") setEditingName(null);
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={busy}
                              onClick={() => handleRename(cat.nome)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingName(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="font-medium truncate">{cat.nome}</span>
                            <Badge variant="secondary">{cat.count} sites</Badge>
                          </>
                        )}
                      </div>

                      {!isEditing && !isMoving && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingName(cat.nome);
                              setEditValue(cat.nome);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Renomear
                          </Button>
                          {others.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setMovingFrom(cat.nome);
                                setMoveTarget("");
                              }}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Mover
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setDeleting(cat);
                                setDeleteMode(others.length > 0 ? "move" : "delete");
                                setDeleteMoveTarget("");
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {isMoving && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Mover para:</span>
                        <Select value={moveTarget} onValueChange={setMoveTarget}>
                          <SelectTrigger className="h-8 w-56">
                            <SelectValue placeholder="Escolher categoria…" />
                          </SelectTrigger>
                          <SelectContent>
                            {others.map((o) => (
                              <SelectItem key={o.nome} value={o.nome}>
                                {o.nome} ({o.count})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={busy || !moveTarget}
                          onClick={() => handleMove(cat.nome)}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setMovingFrom(null);
                            setMoveTarget("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de exclusão com 2 opções */}
      <Dialog open={!!deleting && !confirmHardDelete} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir categoria "{deleting?.nome}"</DialogTitle>
            <DialogDescription>
              Esta categoria possui {deleting?.count} site(s). Escolha o que fazer com eles.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {otherCategorias(deleting?.nome || "").length > 0 && (
              <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent">
                <input
                  type="radio"
                  className="mt-1"
                  checked={deleteMode === "move"}
                  onChange={() => setDeleteMode("move")}
                />
                <div className="flex-1 space-y-2">
                  <div className="font-medium text-sm">Mover sites para outra categoria</div>
                  {deleteMode === "move" && (
                    <Select value={deleteMoveTarget} onValueChange={setDeleteMoveTarget}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Escolher categoria…" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherCategorias(deleting?.nome || "").map((o) => (
                          <SelectItem key={o.nome} value={o.nome}>
                            {o.nome} ({o.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </label>
            )}

            <label className="flex items-start gap-2 rounded-md border border-destructive/30 p-3 cursor-pointer hover:bg-destructive/5">
              <input
                type="radio"
                className="mt-1"
                checked={deleteMode === "delete"}
                onChange={() => setDeleteMode("delete")}
              />
              <div className="flex-1">
                <div className="font-medium text-sm text-destructive">
                  Excluir todos os {deleting?.count} sites desta categoria
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Esta ação não pode ser desfeita. Os sites e seus históricos serão removidos permanentemente.
                </div>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant={deleteMode === "delete" ? "destructive" : "default"}
              disabled={busy || (deleteMode === "move" && !deleteMoveTarget)}
              onClick={handleDelete}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {deleteMode === "delete" ? "Continuar para excluir" : "Mover sites"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmHardDelete}
        onOpenChange={setConfirmHardDelete}
        title={`Excluir ${deleting?.count} sites permanentemente?`}
        description={`Todos os sites da categoria "${deleting?.nome}" e seus históricos de preços serão removidos. Esta ação não pode ser desfeita.`}
        confirmText="Sim, excluir tudo"
        onConfirm={executeHardDelete}
      />
    </>
  );
}
