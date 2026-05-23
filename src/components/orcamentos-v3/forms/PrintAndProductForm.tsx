// Wrapper da aba "Impressão + Acabamentos".
// Sem toggle: chip "Personalizado" (padrão) + chips de presets favoritos.
// Em personalizado, mostra sugestão inteligente quando a combinação
// de papel + acabamentos casa com um produto conhecido (ex: lona + ilhós).
import { useCallback, useMemo, useState } from "react";
import { CreditCard, Pencil, Sparkles, X, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PrintForm } from "./PrintForm";
import { BookletForm } from "./BookletForm";
import { LabelEmbeddedForm } from "./LabelEmbeddedForm";
import { BusinessCardForm } from "./BusinessCardForm";
import { useQuotePresets, type QuotePreset } from "../shared/useQuotePresets";
import { iconFor } from "../shared/presetIcons";
import { SavePresetDialog, type SavePresetPayload } from "../shared/SavePresetDialog";
import { PRESET_BY_ID } from "../shared/productPresets";
import { suggestProduct, type SuggestResult } from "../shared/productSuggester";
import type { V3Item } from "../types";


const BUILTIN_BUSINESS_CARD_ID = "__builtin_business_card__";

const isBusinessCardName = (nome: string | null | undefined): boolean => {
  if (!nome) return false;
  const norm = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /\bcartao\b.*\bvisita\b/.test(norm);
};

interface Props {
  onAdd: (item: V3Item) => void;
  onAddMany?: (items: V3Item[]) => void;
  onAddTiers?: (items: V3Item[]) => void;
  defaultMarginPct?: number;
}

export function PrintAndProductForm({ onAdd, onAddMany, onAddTiers, defaultMarginPct = 20 }: Props) {
  const { presets, reload } = useQuotePresets("impressao");
  // null = Personalizado (padrão)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [suggestion, setSuggestion] = useState<SuggestResult | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string>("");
  const [currentSel, setCurrentSel] = useState<{
    paper_type: string | null;
    size: string | null;
    grammage: string | null;
    finishings: string[];
  } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<QuotePreset | null>(null);
  const [deleting, setDeleting] = useState(false);

  // A pergunta "Tem arte pronta?" agora é única por orçamento (NewQuoteFormV3).
  // Os formulários apenas emitem itens; o pai carimba o art_status global.
  const wrappedOnAdd = useCallback((it: V3Item) => onAdd(it), [onAdd]);
  const wrappedOnAddMany = useCallback(
    (its: V3Item[]) => (onAddMany ? onAddMany(its) : its.forEach((x) => onAdd(x))),
    [onAddMany, onAdd],
  );
  const wrappedOnAddTiers = useCallback(
    (its: V3Item[]) => (onAddTiers ? onAddTiers(its) : its.forEach((x) => onAdd(x))),
    [onAddTiers, onAdd],
  );


  const handleConfirmDelete = useCallback(async () => {
    if (!presetToDelete) return;
    setDeleting(true);
    const { error } = await supabase
      .from("quote_presets" as never)
      .delete()
      .eq("id", presetToDelete.id);
    setDeleting(false);
    if (error) {
      toast.error("Não foi possível remover o favorito.");
      return;
    }
    toast.success(`"${presetToDelete.nome}" removido dos favoritos.`);
    if (selectedPresetId === presetToDelete.id) setSelectedPresetId(null);
    setPresetToDelete(null);
    reload();
  }, [presetToDelete, reload, selectedPresetId]);

  const selectedPreset: QuotePreset | undefined = selectedPresetId && selectedPresetId !== BUILTIN_BUSINESS_CARD_ID
    ? presets.find((p) => p.id === selectedPresetId)
    : undefined;
  const isBusinessCard = selectedPresetId === BUILTIN_BUSINESS_CARD_ID;
  const treatAsBusinessCard = isBusinessCard || (!!selectedPreset && isBusinessCardName(selectedPreset.nome));
  const hasUserBusinessCardPreset = useMemo(
    () => presets.some((p) => isBusinessCardName(p.nome)),
    [presets],
  );
  const formTipo: "print" | "booklet" | "label" = selectedPreset?.form_tipo ?? "print";
  const isCustom = !selectedPresetId;

  const handleSelectionChange = useCallback(
    (sel: {
      paper_type: string | null;
      size: string | null;
      grammage: string | null;
      finishings: string[];
    }) => {
      setCurrentSel(sel);
      const s = suggestProduct(sel);
      if (!s) {
        setSuggestion(null);
        return;
      }
      const key = `${s.productId}|${sel.paper_type}|${sel.finishings.join(",")}`;
      if (key === dismissedKey) {
        setSuggestion(null);
        return;
      }
      setSuggestion(s);
    },
    [dismissedKey],
  );

  const canSavePreset = isCustom && !!currentSel?.paper_type;

  const savePayload = useMemo<SavePresetPayload | null>(() => {
    if (!currentSel?.paper_type) return null;
    const paper = currentSel.paper_type.trim().toLowerCase();
    const resumo: { label: string; value: string }[] = [
      { label: "Papel", value: paper },
    ];
    if (currentSel.finishings.length) {
      resumo.push({ label: "Acabamentos", value: currentSel.finishings.join(", ") });
    }
    if (currentSel.size) resumo.push({ label: "Tamanho de referência", value: currentSel.size });
    return {
      modulo: "impressao",
      form_tipo: "print",
      papel_inclui: [paper],
      acabamentos_sugeridos: currentSel.finishings,
      resumo,
    };
  }, [currentSel]);

  const applySuggestion = () => {
    if (!suggestion) return;
    const label = PRESET_BY_ID[suggestion.productId]?.label?.toLowerCase();
    const match = label
      ? presets.find((p) => p.nome.toLowerCase().includes(label) || label.includes(p.nome.toLowerCase()))
      : undefined;
    if (match) setSelectedPresetId(match.id);
    setSuggestion(null);
  };

  return (
    <div className="space-y-5">
      {/* Pergunta de arte — obrigatória */}
      <ArtePromptBlock
        value={artStatus}
        onChange={setArtStatus}
        terceirizadaValue={artTercValue}
        onTerceirizadaValueChange={setArtTercValue}
      />

      {/* Descrição (opcional) */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Descrição (opcional)
        </Label>
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Opcional — ex: nome do produto ou observação"
          className="h-9"
        />
      </div>

      {/* Chips: Personalizado + favoritos */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedPresetId(null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            isCustom
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          Personalizado
        </button>
        {!hasUserBusinessCardPreset && (
          <button
            type="button"
            onClick={() => setSelectedPresetId(BUILTIN_BUSINESS_CARD_ID)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isBusinessCard
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
            )}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Cartão de Visita
          </button>
        )}
        {presets.map((p) => {
          const Icon = iconFor(p.icone);
          const active = p.id === selectedPresetId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPresetId(p.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {p.nome}
            </button>
          );
        })}
        {canSavePreset && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSaveOpen(true)}
            className="h-7 text-xs text-muted-foreground hover:text-primary ml-auto"
            title="Salva a combinação atual como um botão rápido em favoritos"
          >
            <Star className="h-3.5 w-3.5" />
            Salvar como favorito
          </Button>
        )}
        {selectedPreset && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPresetToDelete(selectedPreset)}
            className="h-7 text-xs text-muted-foreground hover:text-destructive ml-auto"
            title="Remove este favorito da sua lista de atalhos rápidos"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Desfavoritar
          </Button>
        )}
      </div>
      {savePayload && (
        <SavePresetDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          payload={savePayload}
          onSaved={reload}
        />
      )}

      <AlertDialog open={!!presetToDelete} onOpenChange={(o) => !o && setPresetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfavoritar este atalho?</AlertDialogTitle>
            <AlertDialogDescription>
              O favorito "{presetToDelete?.nome}" será removido da sua lista de atalhos rápidos. Isso não apaga nenhum orçamento já criado e você pode salvá-lo novamente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Faixa de sugestão (apenas em Personalizado) */}
      {isCustom && suggestion && (
        <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-medium text-foreground">
              Parece um <strong>{PRESET_BY_ID[suggestion.productId]?.label}</strong> —
              aplicar preset?
            </p>
            <p className="text-muted-foreground">{suggestion.reason}</p>
          </div>
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={applySuggestion}>
            Aplicar
          </Button>
          <button
            type="button"
            aria-label="Dispensar sugestão"
            onClick={() => {
              setDismissedKey(`${suggestion.productId}|||`);
              setSuggestion(null);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sub-formulário */}
      <div>
        {treatAsBusinessCard && (
          <BusinessCardForm
            onAdd={wrappedOnAdd}
            descricao={descricao}
            onDescricaoChange={setDescricao}
          />
        )}
        {!treatAsBusinessCard && isCustom && (
          <PrintForm
            onAdd={wrappedOnAdd}
            onAddMany={wrappedOnAddMany}
            onAddTiers={wrappedOnAddTiers}
            onSelectionChange={handleSelectionChange}
            descricao={descricao}
            onDescricaoChange={setDescricao}
            emptyDefaults
          />
        )}
        {!treatAsBusinessCard && !isCustom && formTipo === "print" && (
          <PrintForm
            onAdd={wrappedOnAdd}
            onAddMany={wrappedOnAddMany}
            onAddTiers={wrappedOnAddTiers}
            defaultMarginPct={defaultMarginPct}
            descricao={descricao}
            onDescricaoChange={setDescricao}
          />
        )}
        {!treatAsBusinessCard && !isCustom && formTipo === "booklet" && (
          <BookletForm
            onAdd={wrappedOnAdd}
            onAddMany={wrappedOnAddMany}
            onAddTiers={wrappedOnAddTiers}
            defaultMarginPct={defaultMarginPct}
            descricao={descricao}
            onDescricaoChange={setDescricao}
          />
        )}
        {!treatAsBusinessCard && !isCustom && formTipo === "label" && (
          <LabelEmbeddedForm
            onAdd={wrappedOnAdd}
            onAddMany={wrappedOnAddMany}
            onAddTiers={wrappedOnAddTiers}
            descricao={descricao}
            onDescricaoChange={setDescricao}
          />
        )}
      </div>
    </div>
  );
}



