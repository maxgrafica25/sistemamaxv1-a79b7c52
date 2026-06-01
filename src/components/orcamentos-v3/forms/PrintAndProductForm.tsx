// Wrapper da aba "Impressão + Acabamentos".
// Sem toggle: chip "Personalizado" (padrão) + chips de presets favoritos.
// Em personalizado, mostra sugestão inteligente quando a combinação
// de papel + acabamentos casa com um produto conhecido (ex: lona + ilhós).
import { useCallback, useMemo, useState } from "react";
import { CreditCard, Pencil, Sparkles, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrintForm } from "./PrintForm";
import { BookletForm } from "./BookletForm";
import { LabelEmbeddedForm } from "./LabelEmbeddedForm";
import { BusinessCardForm } from "./BusinessCardForm";
import { CertificateForm } from "./CertificateForm";
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

const isCertificateName = (nome: string | null | undefined): boolean => {
  if (!nome) return false;
  const norm = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /certificad/.test(norm);
};

interface Props {
  onAdd: (item: V3Item) => void;
  onAddMany?: (items: V3Item[]) => void;
  onAddTiers?: (items: V3Item[]) => void;
  defaultMarginPct?: number;
  hideArtFinishings?: boolean;
}

export function PrintAndProductForm({ onAdd, onAddMany, onAddTiers, defaultMarginPct = 20, hideArtFinishings = false }: Props) {
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


  const selectedPreset: QuotePreset | undefined = selectedPresetId
    ? presets.find((p) => p.id === selectedPresetId)
    : undefined;
  const treatAsBusinessCard = !!selectedPreset && isBusinessCardName(selectedPreset.nome);
  const treatAsCertificate = !!selectedPreset && isCertificateName(selectedPreset.nome);
  
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
      if (!sel.paper_type) {
        setSuggestion(null);
        return;
      }
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

  // Substrato do produto: padrão "Papel"; crachá usa "Cartão PVC".
  const substrateLabel = useMemo(() => {
    const nome = selectedPreset?.nome ?? "";
    const norm = nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (/crach/.test(norm)) return "Cartão PVC";
    if (/adesivo/.test(norm)) return "Adesivo";
    return "Papel";
  }, [selectedPreset]);

  return (

    <div className="space-y-5">


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

      {/* Produtos favoritos: Personalizado + favoritos */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Produtos favoritos</h3>
        <p className="text-xs text-muted-foreground">
          Atalhos rápidos com combinações salvas. Escolha um ou use "Personalizado".
        </p>
      </div>
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
        {presets.map((p) => {
          const Icon = iconFor(p.icone);
          const active = p.id === selectedPresetId;
          const paper = currentSel?.paper_type?.trim() ?? null;
          const excluded = !!(paper && p.papel_exclui?.includes(paper));
          if (excluded && !active) return null;
          const matches = !paper || !p.papel_inclui?.length || p.papel_inclui.includes(paper);
          const dimmed = !active && !!paper && !matches;
          const suggested = !active && !!paper && p.papel_inclui?.includes(paper);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPresetId(p.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : suggested
                    ? "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
                dimmed && "opacity-50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {p.nome}
              {suggested && <Sparkles className="h-3 w-3" />}
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
      </div>
      {savePayload && (
        <SavePresetDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          payload={savePayload}
          onSaved={reload}
        />
      )}


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
        {!treatAsBusinessCard && treatAsCertificate && (
          <CertificateForm
            onAdd={wrappedOnAdd}
            descricao={descricao}
            onDescricaoChange={setDescricao}
          />
        )}
        {!treatAsBusinessCard && !treatAsCertificate && isCustom && (
          <PrintForm
            onAdd={wrappedOnAdd}
            onAddMany={wrappedOnAddMany}
            onAddTiers={wrappedOnAddTiers}
            onSelectionChange={handleSelectionChange}
            descricao={descricao}
            onDescricaoChange={setDescricao}
            emptyDefaults
            substrateLabel={substrateLabel}
            hideArtFinishings={hideArtFinishings}
            suggestAllFinishings
          />

        )}
        {!treatAsBusinessCard && !treatAsCertificate && !isCustom && formTipo === "print" && (
          <PrintForm
            onAdd={wrappedOnAdd}
            onAddMany={wrappedOnAddMany}
            onAddTiers={wrappedOnAddTiers}
            defaultMarginPct={defaultMarginPct}
            descricao={descricao}
            onDescricaoChange={setDescricao}
            substrateLabel={substrateLabel}
            hideArtFinishings={hideArtFinishings}
            suggestedPapers={selectedPreset?.papel_inclui ?? undefined}
            defaultPaperHint={
              selectedPreset?.papel_default_nome
                ? {
                    name: selectedPreset.papel_default_nome,
                    grammage: selectedPreset.papel_default_grammage,
                    side: selectedPreset.side_default,
                  }
                : null
            }
            preselectedFinishings={
              selectedPreset?.preselect_acabamentos
                ? selectedPreset.acabamentos_sugeridos
                : undefined
            }
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
            defaultPaperHint={
              selectedPreset?.papel_default_nome
                ? {
                    name: selectedPreset.papel_default_nome,
                    grammage: selectedPreset.papel_default_grammage,
                    side: selectedPreset.side_default,
                  }
                : null
            }
            preselectedFinishings={
              selectedPreset?.preselect_acabamentos
                ? selectedPreset.acabamentos_sugeridos
                : undefined
            }
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



