import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Star, Clock, Layers, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import { PRODUCT_PRESETS, type ProductPresetKey } from "@/lib/orcamentos-v3/product-presets";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Step { id: string; description: string; time_minutes: number }
interface Group { id: string; name: string }
type LinkType = "fixed" | "optional";
interface Link {
  id: string;
  preset_key: string;
  step_id: string | null;
  group_id: string | null;
  link_type: LinkType;
}

export function ProductPresetLinksTab() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const { requireAdmin } = usePermissionGuard();

  const fetchAll = async () => {
    setLoading(true);
    const [sRes, gRes, lRes] = await Promise.all([
      supabase.from("production_steps").select("id, description, time_minutes").order("description"),
      supabase.from("step_groups").select("id, name").order("name"),
      supabase.from("product_preset_processes").select("*").order("sort_order"),
    ]);
    if (sRes.data) setSteps(sRes.data as Step[]);
    if (gRes.data) setGroups(gRes.data as Group[]);
    if (lRes.data) setLinks(lRes.data as Link[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const addLink = async (
    preset: ProductPresetKey,
    payload: { step_id?: string; group_id?: string },
    type: LinkType,
  ) => {
    if (!requireAdmin("vincular processo a favorito")) return;
    const { error } = await supabase
      .from("product_preset_processes")
      .insert({
        preset_key: preset,
        ...payload,
        link_type: type,
        sort_order: links.filter((l) => l.preset_key === preset).length,
      });
    if (error) return handleError(error, "vincular processo");
    toast.success(type === "fixed" ? "Adicionado como fixo" : "Adicionado como opcional");
    fetchAll();
  };

  const toggleType = async (link: Link) => {
    if (!requireAdmin("alterar tipo de vínculo")) return;
    const next: LinkType = link.link_type === "fixed" ? "optional" : "fixed";
    const { error } = await supabase
      .from("product_preset_processes")
      .update({ link_type: next })
      .eq("id", link.id);
    if (error) return handleError(error, "atualizar vínculo");
    toast.success(`Movido para ${next === "fixed" ? "Fixos" : "Opcionais"}`);
    fetchAll();
  };

  const removeLink = async (id: string) => {
    if (!requireAdmin("remover vínculo")) return;
    const { error } = await supabase.from("product_preset_processes").delete().eq("id", id);
    if (error) return handleError(error, "remover vínculo");
    toast.success("Vínculo removido");
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vincule etapas e grupos a cada favorito do orçamento V3. <strong>Fixos</strong>{" "}
        aparecem sempre marcados; <strong>Opcionais</strong> ficam em uma seção
        recolhível como sugestão (ex.: laminação, verniz).
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {PRODUCT_PRESETS.map((preset) => {
          const presetLinks = links.filter((l) => l.preset_key === preset.key);
          const usedStepIds = new Set(presetLinks.map((l) => l.step_id).filter(Boolean));
          const usedGroupIds = new Set(presetLinks.map((l) => l.group_id).filter(Boolean));
          const availableSteps = steps.filter((s) => !usedStepIds.has(s.id));
          const availableGroups = groups.filter((g) => !usedGroupIds.has(g.id));
          const fixedLinks = presetLinks.filter((l) => l.link_type === "fixed");
          const optionalLinks = presetLinks.filter((l) => l.link_type === "optional");

          return (
            <Card key={preset.key}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">{preset.label}</h3>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {fixedLinks.length} fixo · {optionalLinks.length} opcional
                  </Badge>
                </div>

                <LinkSection
                  title="Fixos"
                  emptyLabel="Nenhum fixo ainda."
                  items={fixedLinks}
                  steps={steps}
                  groups={groups}
                  onToggle={toggleType}
                  onRemove={removeLink}
                  toggleLabel="Tornar opcional"
                />

                <LinkSection
                  title="Opcionais (sugestões)"
                  emptyLabel="Nenhum opcional ainda."
                  items={optionalLinks}
                  steps={steps}
                  groups={groups}
                  onToggle={toggleType}
                  onRemove={removeLink}
                  toggleLabel="Tornar fixo"
                />

                <AdminOnly mode="hide" action="vincular processo">
                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="flex gap-2">
                      <AddPicker
                        label="+ Etapa fixa"
                        icon={<Clock className="h-3 w-3" />}
                        items={availableSteps.map((s) => ({ id: s.id, label: `${s.description} (${s.time_minutes}m)` }))}
                        onPick={(id) => addLink(preset.key, { step_id: id }, "fixed")}
                        emptyLabel="Todas etapas já vinculadas"
                      />
                      <AddPicker
                        label="+ Grupo fixo"
                        icon={<Layers className="h-3 w-3" />}
                        items={availableGroups.map((g) => ({ id: g.id, label: g.name }))}
                        onPick={(id) => addLink(preset.key, { group_id: id }, "fixed")}
                        emptyLabel="Todos grupos já vinculados"
                      />
                    </div>
                    <div className="flex gap-2">
                      <AddPicker
                        label="+ Etapa opcional"
                        icon={<Clock className="h-3 w-3" />}
                        items={availableSteps.map((s) => ({ id: s.id, label: `${s.description} (${s.time_minutes}m)` }))}
                        onPick={(id) => addLink(preset.key, { step_id: id }, "optional")}
                        emptyLabel="Todas etapas já vinculadas"
                      />
                      <AddPicker
                        label="+ Grupo opcional"
                        icon={<Layers className="h-3 w-3" />}
                        items={availableGroups.map((g) => ({ id: g.id, label: g.name }))}
                        onPick={(id) => addLink(preset.key, { group_id: id }, "optional")}
                        emptyLabel="Todos grupos já vinculados"
                      />
                    </div>
                  </div>
                </AdminOnly>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function LinkSection({
  title,
  emptyLabel,
  items,
  steps,
  groups,
  onToggle,
  onRemove,
  toggleLabel,
}: {
  title: string;
  emptyLabel: string;
  items: Link[];
  steps: Step[];
  groups: Group[];
  onToggle: (l: Link) => void;
  onRemove: (id: string) => void;
  toggleLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((l) => {
            const step = l.step_id ? steps.find((s) => s.id === l.step_id) : null;
            const group = l.group_id ? groups.find((g) => g.id === l.group_id) : null;
            return (
              <li
                key={l.id}
                className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1.5"
              >
                {step ? (
                  <>
                    <Clock className="h-3 w-3 text-blue-500 shrink-0" />
                    <span className="flex-1 truncate">{step.description}</span>
                    <span className="text-muted-foreground tabular-nums">{step.time_minutes}m</span>
                  </>
                ) : group ? (
                  <>
                    <Layers className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span className="flex-1 truncate">{group.name}</span>
                  </>
                ) : (
                  <span className="text-destructive flex-1">(item removido)</span>
                )}
                <AdminOnly mode="hide" action="alterar tipo">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={() => onToggle(l)}
                    title={toggleLabel}
                  >
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </AdminOnly>
                <AdminOnly mode="hide" action="remover vínculo">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:bg-destructive/10"
                    onClick={() => onRemove(l.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AdminOnly>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddPicker({
  label,
  icon,
  items,
  onPick,
  emptyLabel,
}: {
  label: string;
  icon: React.ReactNode;
  items: { id: string; label: string }[];
  onPick: (id: string) => void;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1">
          {icon}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="max-h-64 overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">{emptyLabel}</p>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  onPick(it.id);
                  setOpen(false);
                }}
                className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted flex items-center gap-2"
              >
                <Plus className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{it.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
