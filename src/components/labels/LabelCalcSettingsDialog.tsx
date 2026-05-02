import { forwardRef, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Plus, RotateCw, Trash2, Settings2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import {
  CUT_DEFAULTS,
  CUT_LABELS,
  SHEET_PRESETS,
  SHAPE_LABELS,
  type CutType,
} from "@/lib/labels/layout";
import {
  loadConfig,
  saveConfig,
  addCustomSheet,
  removeCustomSheet,
  removeLabelPreset,
  type LabelCalcConfig,
  type CustomSheetPreset,
} from "@/lib/labels/config-storage";
import { HARDWARE_PROFILES, clampMarginsToHardware } from "@/lib/labels/hardware";

const CUSTOM_SHEET_ID = "__custom__";

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
}
function NumField({ label, value, onChange, step = 1, min = 0 }: NumFieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
      />
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  /** Chamado depois que o usuário confirma — recebe a config aplicada. */
  onSaved?: (cfg: LabelCalcConfig) => void;
}

export const LabelCalcSettingsDialog = forwardRef<HTMLDivElement, Props>(function LabelCalcSettingsDialog({ open, onOpenChange, onSaved }, _ref) {
  const [draft, setDraft] = useState<LabelCalcConfig>(() => loadConfig());

  // Form de "nova folha personalizada"
  const [newSheetLabel, setNewSheetLabel] = useState("");
  const [newSheetW, setNewSheetW] = useState(0);
  const [newSheetH, setNewSheetH] = useState(0);
  const [showNewSheet, setShowNewSheet] = useState(false);

  // Recarrega ao abrir (caso outro lugar tenha alterado)
  useEffect(() => {
    if (open) {
      setDraft(loadConfig());
      setShowNewSheet(false);
      setNewSheetLabel("");
      setNewSheetW(0);
      setNewSheetH(0);
    }
  }, [open]);

  const update = (patch: Partial<LabelCalcConfig>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const handleSheetPresetChange = (id: string) => {
    if (id === CUSTOM_SHEET_ID) {
      update({ sheetPresetId: CUSTOM_SHEET_ID });
      return;
    }
    const fixed = SHEET_PRESETS.find((p) => p.id === id);
    if (fixed) {
      update({ sheetPresetId: id, sheetW: fixed.width, sheetH: fixed.height });
      return;
    }
    const custom = draft.customSheets.find((p) => p.id === id);
    if (custom) {
      update({ sheetPresetId: id, sheetW: custom.width, sheetH: custom.height });
    }
  };

  const handleCutChange = (next: string) => {
    if (!next) return;
    const t = next as CutType;
    const d = CUT_DEFAULTS[t];
    update({
      cutType: t,
      marginTop: d.marginTop,
      marginBottom: d.marginBottom,
      marginLeft: d.marginLeft,
      marginRight: d.marginRight,
      gap: d.gap,
    });
  };

  const restoreCutDefaults = () => {
    const d = CUT_DEFAULTS[draft.cutType];
    update({
      marginTop: d.marginTop,
      marginBottom: d.marginBottom,
      marginLeft: d.marginLeft,
      marginRight: d.marginRight,
      gap: d.gap,
    });
  };

  const handleAddCustomSheet = () => {
    const label = newSheetLabel.trim();
    if (!label) {
      toast.error("Dê um nome para a folha");
      return;
    }
    if (newSheetW <= 0 || newSheetH <= 0) {
      toast.error("Largura e altura devem ser maiores que zero");
      return;
    }
    const preset = addCustomSheet({ label, width: newSheetW, height: newSheetH });
    setDraft((d) => ({
      ...d,
      customSheets: [...d.customSheets, preset],
      sheetPresetId: preset.id,
      sheetW: preset.width,
      sheetH: preset.height,
    }));
    setShowNewSheet(false);
    setNewSheetLabel("");
    setNewSheetW(0);
    setNewSheetH(0);
    toast.success("Folha cadastrada");
  };

  const handleRemoveCustomSheet = (id: string) => {
    removeCustomSheet(id);
    setDraft((d) => {
      const next = { ...d, customSheets: d.customSheets.filter((s) => s.id !== id) };
      // Se a folha removida estava selecionada, volta para A4
      if (d.sheetPresetId === id) {
        next.sheetPresetId = "A4";
        next.sheetW = 210;
        next.sheetH = 297;
      }
      return next;
    });
  };

  const isCustomSheet = draft.sheetPresetId === CUSTOM_SHEET_ID;

  const validation = (() => {
    if (draft.sheetW <= 0 || draft.sheetH <= 0)
      return "A folha precisa ter largura e altura > 0";
    if (draft.marginTop + draft.marginBottom >= draft.sheetH)
      return "Margens topo + base não cabem na folha";
    if (draft.marginLeft + draft.marginRight >= draft.sheetW)
      return "Margens esquerda + direita não cabem na folha";
    return null;
  })();

  const handleSave = () => {
    if (validation) {
      toast.error(validation);
      return;
    }
    let toSave = draft;
    if (!draft.marginsUnlocked) {
      const profile = HARDWARE_PROFILES[draft.hardwareProfileId];
      if (profile) {
        toSave = { ...draft, ...clampMarginsToHardware(draft, profile) };
      }
    }
    const saved = saveConfig(toSave);
    toast.success("Configurações salvas");
    onSaved?.(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configurações da calculadora
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* === 1. Folha === */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Folha de impressão</h3>
            <div className="space-y-2">
              <Label className="text-xs">Tamanho</Label>
              <div className="flex gap-2">
                <Select value={draft.sheetPresetId} onValueChange={handleSheetPresetChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Padrão</SelectLabel>
                      {SHEET_PRESETS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {draft.customSheets.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Personalizadas</SelectLabel>
                        {draft.customSheets.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label} ({p.width}×{p.height}mm)
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    <SelectItem value={CUSTOM_SHEET_ID}>Personalizado (digitar)…</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewSheet((s) => !s)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Cadastrar
                </Button>
              </div>

              {/* Lixeira ao lado da folha custom selecionada */}
              {(() => {
                const sel = draft.customSheets.find((s) => s.id === draft.sheetPresetId);
                if (!sel) return null;
                return (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive h-7 text-xs"
                    onClick={() => handleRemoveCustomSheet(sel.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Excluir folha "{sel.label}"
                  </Button>
                );
              })()}
            </div>

            {/* W x H — editável só se "Personalizado" */}
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Largura (mm)"
                value={draft.sheetW}
                onChange={(v) => update({ sheetW: v, sheetPresetId: isCustomSheet ? CUSTOM_SHEET_ID : draft.sheetPresetId })}
              />
              <NumField
                label="Altura (mm)"
                value={draft.sheetH}
                onChange={(v) => update({ sheetH: v, sheetPresetId: isCustomSheet ? CUSTOM_SHEET_ID : draft.sheetPresetId })}
              />
            </div>
            {!isCustomSheet && (
              <p className="text-[11px] text-muted-foreground">
                Para alterar livremente, escolha "Personalizado (digitar)…" no select acima.
              </p>
            )}

            {/* Form de cadastrar nova folha */}
            {showNewSheet && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <Label className="text-xs font-semibold">Nova folha personalizada</Label>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <div>
                    <Label className="text-[11px]">Nome</Label>
                    <Input
                      value={newSheetLabel}
                      onChange={(e) => setNewSheetLabel(e.target.value)}
                      placeholder="Ex.: Couché 250g cortado"
                    />
                  </div>
                  <NumField label="W (mm)" value={newSheetW} onChange={setNewSheetW} />
                  <NumField label="H (mm)" value={newSheetH} onChange={setNewSheetH} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowNewSheet(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleAddCustomSheet}>
                    Adicionar folha
                  </Button>
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* === 2. Tipo de corte === */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Tipo de corte</h3>
            <ToggleGroup
              type="single"
              value={draft.cutType}
              onValueChange={handleCutChange}
              className="grid grid-cols-3 gap-2"
            >
              {(Object.keys(CUT_LABELS) as CutType[]).map((t) => (
                <ToggleGroupItem
                  key={t}
                  value={t}
                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border h-auto py-2 text-xs"
                >
                  {CUT_LABELS[t]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </section>

          <Separator />

          {/* === 2.5 Perfil de Hardware === */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Perfil de hardware</h3>
            <Select
              value={draft.hardwareProfileId}
              onValueChange={(id) => {
                const profile = HARDWARE_PROFILES[id];
                if (!profile) return;
                const clamped = clampMarginsToHardware(draft, profile);
                setDraft((d) => ({
                  ...d,
                  hardwareProfileId: id,
                  marginsUnlocked: false,
                  ...clamped,
                }));
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(HARDWARE_PROFILES).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {HARDWARE_PROFILES[draft.hardwareProfileId]?.description}
            </p>
          </section>

          <Separator />

          {/* === 3. Margens + gap === */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Margens direcionais e gap</h3>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => update({ marginsUnlocked: !draft.marginsUnlocked })}
                  title={draft.marginsUnlocked ? "Voltar a respeitar mínimos do hardware" : "Destravar para ajuste fino"}
                >
                  {draft.marginsUnlocked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                  {draft.marginsUnlocked ? "Destravado" : "Travado p/ hardware"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={restoreCutDefaults}
                >
                  <RotateCw className="h-3 w-3 mr-1" /> Padrão de corte
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField label="Topo (mm)" value={draft.marginTop} onChange={(v) => update({ marginTop: v })} />
              <NumField label="Base (mm)" value={draft.marginBottom} onChange={(v) => update({ marginBottom: v })} />
              <NumField label="Esquerda (mm)" value={draft.marginLeft} onChange={(v) => update({ marginLeft: v })} />
              <NumField label="Direita (mm)" value={draft.marginRight} onChange={(v) => update({ marginRight: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:max-w-[240px]">
              <NumField label="Espaçamento entre etiquetas (mm)" value={draft.gap} onChange={(v) => update({ gap: v })} />
            </div>
            {!draft.marginsUnlocked && draft.hardwareProfileId !== "generico" && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Margens travadas pelo perfil <strong>{HARDWARE_PROFILES[draft.hardwareProfileId]?.label}</strong>.
                Os valores menores que o mínimo do hardware serão automaticamente ajustados.
              </p>
            )}
          </section>

          <Separator />

          {/* Preço da folha agora vem do cadastro Preço Impressão + Acabamentos.
              Editado diretamente naquelas telas, não aqui. */}

          <Separator />

          {/* === 5. Unidade de medida === */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Unidade de medida</h3>
            <ToggleGroup
              type="single"
              value={draft.unit}
              onValueChange={(v) => v && update({ unit: v as "mm" | "cm" })}
              className="grid grid-cols-2 gap-2 sm:max-w-[240px]"
            >
              <ToggleGroupItem
                value="mm"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border h-9 text-xs"
              >
                Milímetros (mm)
              </ToggleGroupItem>
              <ToggleGroupItem
                value="cm"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border h-9 text-xs"
              >
                Centímetros (cm)
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-[11px] text-muted-foreground">
              Afeta apenas a exibição no simulador. Os cálculos internos sempre usam mm.
            </p>
          </section>

          {validation && (
            <p className="text-xs text-destructive font-medium">{validation}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!!validation}>
            Salvar configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// Re-export para uso externo (ex.: tests)
export type { CustomSheetPreset };
