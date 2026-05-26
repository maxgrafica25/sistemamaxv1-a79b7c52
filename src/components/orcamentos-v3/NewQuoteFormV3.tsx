import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, FlaskConical, Save, Clock, Link2, FileDown, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { copyPublicQuoteLink, generateQuotePdf, openWhatsAppForClient } from "@/lib/quotes/quick-actions";
import { ClientCombobox } from "@/components/orcamentos-v3/shared/ClientCombobox";
import { TabsLayout, getTab } from "./workspace/TabsLayout";
import { PrintAndProductForm } from "./forms/PrintAndProductForm";
import { CVForm } from "./forms/CVForm";
import { ThirdPartyForm } from "./forms/ThirdPartyForm";


import { UnifiedCart } from "./cart/UnifiedCart";

import { QuoteChecklistPanelV3 } from "./cart/QuoteChecklistPanelV3";

import { FinancialPanel } from "./cart/FinancialPanel";
import { useQuoteDraftV3 } from "./shared/useQuoteDraftV3";
import { summarize, fmtBRL } from "./shared/pricing";
import { DEFAULT_STATE, genId, type V3Category, type V3Item, type V3QuoteState } from "./types";

import { saveQuoteV3, nextQuoteNumber } from "./shared/saveQuoteV3";
import { loadQuoteV3 } from "./shared/loadQuoteV3";
import { RecorrentesPanel } from "@/components/recorrentes/RecorrentesPanel";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";

import { stampArt, makeArtInternal, makeArtThirdParty, requiresArt } from "./shared/artStatus";
import { useHourRate } from "@/hooks/useHourRate";
import type { V3ThirdItem } from "./types";


interface Props {
  onCancel: () => void;
  onSave?: (result: { id: string; quote_number: string }) => void;
  editingQuoteId?: string | null;
}

export function NewQuoteFormV3({ onCancel, onSave, editingQuoteId }: Props) {
  const isEditing = !!editingQuoteId;
  const [state, setState] = useState<V3QuoteState>(DEFAULT_STATE);
  const [active, setActive] = useState<V3Category>("print");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
  const [editMeta, setEditMeta] = useState<{ quote_number: string; status: string } | null>(null);
  const [previewNumber, setPreviewNumber] = useState<string | null>(null);
  const [checklistAnswers, setChecklistAnswers] = useState<{ pergunta: string; resposta: string }[]>([]);
  const { settings: globalSettings, loading: globalLoading } = useGlobalSettings();

  // Seed inicial de imposto + taxa de cartão a partir das Configurações Globais
  // (só aplica quando o estado ainda está em 0 — preserva valores de rascunhos salvos).
  useEffect(() => {
    if (globalLoading) return;
    setState((s) => {
      if (s.tax_pct !== 0 || s.fees_pct !== 0) return s;
      return {
        ...s,
        tax_pct: globalSettings.tax_pct,
        fees_pct: globalSettings.credit_card_pct,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalLoading]);
  const { hourRate } = useHourRate();
  const { companyName, publicBaseUrl } = useCompanySettings();
  const [clientPhone, setClientPhone] = useState<string | null>(null);

  useEffect(() => {
    const id = state.cliente?.id;
    if (!id) { setClientPhone(null); return; }
    let cancelled = false;
    supabase.from("clients").select("telefone").eq("id", id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setClientPhone((data as any)?.telefone ?? null); });
    return () => { cancelled = true; };
  }, [state.cliente?.id]);



  // Pré-calcula o próximo número (provisório) ao criar um novo orçamento.
  useEffect(() => {
    if (isEditing) return;
    let cancelled = false;
    nextQuoteNumber()
      .then((n) => { if (!cancelled) setPreviewNumber(n); })
      .catch(() => { /* silencioso — badge fica oculto */ });
    return () => { cancelled = true; };
  }, [isEditing]);

  // Rascunho local desabilitado em modo edição (não queremos sobrescrever
  // o estado real com um rascunho antigo de "novo orçamento").
  const { hydrated, savedAt, clear } = useQuoteDraftV3(state, !isEditing);
  useEffect(() => {
    if (isEditing) return;
    if (hydrated) {
      // A pergunta da arte é respondida fresca por orçamento — não restaurar.
      setState({ ...hydrated, art_status: null, art_terceirizada_value: 0 });
      toast.info("Rascunho restaurado", {
        description: "Recuperamos o que estava em andamento.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isEditing]);

  // Carrega snapshot v3_payload quando estamos editando.
  useEffect(() => {
    if (!editingQuoteId) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadQuoteV3(editingQuoteId);
        if (cancelled) return;
        setState(loaded.state);
        setEditMeta({ quote_number: loaded.quote_number, status: loaded.status });
        if (loaded.is_locked) {
          toast.error("Esta versão foi substituída", {
            description: "Abra a versão mais recente para editar.",
          });
        } else if (loaded.status === "approved" || loaded.status === "partial") {
          toast.warning("Orçamento já tem aceite", {
            description: "Editar livre vai sobrescrever. Considere criar nova versão.",
          });
        }
      } catch (err: any) {
        toast.error("Não foi possível abrir o orçamento", {
          description: err?.message || "Tente novamente.",
        });
        onCancel();
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingQuoteId, onCancel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const map: Record<string, V3Category> = {
        "1": "print",
        "2": "cv",
        "3": "third",
      };
      const next = map[e.key];
      if (next) {
        e.preventDefault();
        setActive(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  const summary = useMemo(
    () => summarize(state.items, state.tax_pct, state.fees_pct, state.margin_pct, globalSettings.pricing_regime),
    [state.items, state.tax_pct, state.fees_pct, state.margin_pct, globalSettings.pricing_regime],
  );

  const addItem = (item: V3Item) => {
    setState((s) => {
      const stamped = stampArt([item], s.art_status ?? null)[0] ?? item;
      return { ...s, items: [...s.items, stamped] };
    });
    setHighlightId(item.id);
    setTimeout(() => setHighlightId(null), 1500);
  };
  const addItems = (items: V3Item[]) => {
    if (items.length === 0) return;
    setState((s) => {
      const stamped = stampArt(items, s.art_status ?? null);
      return { ...s, items: [...s.items, ...stamped] };
    });
    setHighlightId(items[items.length - 1].id);
    setTimeout(() => setHighlightId(null), 1500);
  };
  const removeItem = (id: string) =>
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
  const duplicateItem = (id: string) =>
    setState((s) => {
      const it = s.items.find((i) => i.id === id);
      if (!it) return s;
      const clone = { ...it, id: genId() } as V3Item;
      return { ...s, items: [...s.items, clone] };
    });

  // Reconciliação da linha única de "Arte" no nível do orçamento.
  // Roda quando a resposta global muda (ou o valor da hora / arte terceirizada).
  // Remove qualquer linha de arte vinculada ao orçamento (bundle_id null) e
  // recria conforme o status atual; re-carimba art_status nos itens existentes.
  useEffect(() => {
    setState((s) => {
      const status = s.art_status ?? null;
      const value = s.art_terceirizada_value ?? 0;
      const cleaned = s.items.filter((it) => {
        if (it.kind !== "third") return true;
        const t = it as V3ThirdItem;
        const isArt = t.fornecedor === "Arte (interna)" || t.fornecedor === "Arte (terceiro)";
        if (!isArt) return true;
        // mantém apenas itens de arte vinculados a um bundle (legado)
        return !!t.bundle_id;
      });
      const stamped = stampArt(cleaned, status);
      let next = stamped;
      if (status === "terceirizada" && value > 0) {
        const art = makeArtThirdParty(value, null);
        if (art) next = [...stamped, art];
      } else if (status && status !== "ready" && status !== "terceirizada") {
        const art = makeArtInternal(status, hourRate || 0, null);
        if (art) next = [...stamped, art];
      }
      return { ...s, items: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.art_status, state.art_terceirizada_value, hourRate]);


  const [saving, setSaving] = useState(false);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);

  const performSave = async () => {
    setSaving(true);
    try {
      const result = await saveQuoteV3(state, editingQuoteId ?? undefined);
      if (!isEditing) clear();
      toast.success(
        isEditing
          ? `Orçamento ${result.quote_number} atualizado.`
          : `Orçamento ${result.quote_number} criado.`,
      );
      onSave?.(result);
    } catch (err: any) {
      console.error("[V3 save]", err);
      toast.error("Falha ao salvar orçamento", {
        description: err?.message || "Tente novamente. O rascunho foi mantido.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (state.items.length === 0) {
      toast.error("Adicione pelo menos 1 item antes de salvar.");
      return;
    }
    if (!state.cliente.id) {
      toast.warning("Selecione um cliente válido antes de salvar.", {
        description: "Cliente Balcão é apenas para começar rápido — escolha o cliente real.",
      });
      return;
    }
    // Pergunta "Tem arte pronta?" agora é única por orçamento.
    const hasArtRequiringItem = state.items.some((it) => requiresArt(it));
    if (hasArtRequiringItem && !state.art_status) {
      toast.warning("Responda 'Tem arte pronta?' antes de salvar.");
      return;
    }
    if (state.art_status === "terceirizada" && (!state.art_terceirizada_value || state.art_terceirizada_value <= 0)) {
      toast.warning("Informe o valor da arte terceirizada.");
      return;
    }

    // Popup do checklist antes do save (se habilitado e houver itens CV).
    const hasCV = state.items.some((it) => it.kind === "cv");
    if (globalSettings.checklist_before_save && hasCV) {
      setChecklistDialogOpen(true);
      return;
    }
    await performSave();
  };

  const lastSaved = savedAt ? new Date(savedAt).toLocaleTimeString("pt-BR") : null;

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] text-sm text-muted-foreground">
        Carregando orçamento…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button variant="ghost" size="sm" onClick={onCancel} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
          </Button>
          {(isEditing ? editMeta : previewNumber) && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400 shrink-0"
            >
              <FlaskConical className="h-3 w-3" />
              {isEditing && editMeta
                ? `Editar Nº ${editMeta.quote_number}`
                : `Nº ${previewNumber}`}
            </Badge>
          )}
          <div className="hidden md:flex items-center gap-3 ml-2 min-w-0 flex-1">
            <div className="w-[380px] shrink-0">
              <ClientCombobox
                value={state.cliente}
                onChange={(next) =>
                  setState((s) => ({
                    ...s,
                    cliente: { id: next.id, nome: next.nome || "Cliente Balcão" },
                  }))
                }
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input
                value={state.assunto}
                onChange={(e) => setState((s) => ({ ...s, assunto: e.target.value }))}
                placeholder="Assunto do orçamento"
                className="h-9"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEditing && editMeta && (
            <div className="flex items-center gap-0.5 border-r border-border pr-2 mr-1">
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                title="Copiar link público"
                onClick={() => copyPublicQuoteLink(editMeta.quote_number, publicBaseUrl)}
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                title="Gerar PDF"
                onClick={() => generateQuotePdf({
                  quote_number: editMeta.quote_number,
                  client: state.cliente?.nome || "Cliente Balcão",
                  product: state.assunto || "Orçamento",
                  date: new Date(),
                  value: summary.total,
                })}
              >
                <FileDown className="h-3.5 w-3.5" />
              </Button>
              {clientPhone && (
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                  title="Contatar cliente no WhatsApp"
                  onClick={() => openWhatsAppForClient({
                    quoteNumber: editMeta.quote_number,
                    status: editMeta.status,
                    clientName: state.cliente?.nome,
                    clientPhone,
                    companyName,
                  })}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
          {lastSaved && (
            <span className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" /> Rascunho {lastSaved}
            </span>
          )}
          <Button onClick={handleSave} size="sm" disabled={saving || loadingEdit}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving
              ? "Salvando..."
              : isEditing
                ? "Salvar alterações"
                : "Salvar orçamento"}
          </Button>
        </div>
      </div>

      {/* Mobile client/subject */}
      <div className="md:hidden px-4 py-3 border-b border-border space-y-2 bg-background">
        <ClientCombobox
          value={state.cliente}
          onChange={(next) =>
            setState((s) => ({
              ...s,
              cliente: { id: next.id, nome: next.nome || "Cliente Balcão" },
            }))
          }
        />
        <Input
          value={state.assunto}
          onChange={(e) => setState((s) => ({ ...s, assunto: e.target.value }))}
          placeholder="Assunto"
          className="h-9"
        />
      </div>

      {/* Split-screen */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] overflow-hidden">
        {/* Workspace (70%) */}
        <div className="overflow-y-auto overscroll-contain bg-background pb-24 lg:pb-0">

          <div className="px-4 lg:px-6 py-5">
            <div className="min-h-full flex flex-col">
              <TabsLayout active={active} onChange={setActive} />
              <p className="mt-2 text-xs text-muted-foreground">
                {getTab(active).description}
              </p>

              <div className="mt-6 max-w-3xl flex-1 flex flex-col">
                <RecorrentesPanel clientId={state.cliente.id} clientName={state.cliente.nome} />

                {active === "print" && (
                  <PrintAndProductForm
                    onAdd={addItem}
                    onAddMany={addItems}
                    onAddTiers={addItems}
                    defaultMarginPct={state.margin_pct}
                    hideArtFinishings={state.art_status === "ready"}
                  />
                )}
                {active === "cv" && <CVForm onAdd={addItem} onAddTiers={addItems} />}
                {active === "third" && <ThirdPartyForm onAdd={addItem} onAddTiers={addItems} />}
              </div>
            </div>
          </div>
        </div>

        {/* Cart (30%) */}
        <aside className="hidden lg:flex flex-col border-l border-border bg-muted/20 overflow-hidden min-h-0">
          <div className="shrink-0 px-4 py-3 border-b border-border/60 bg-background">
            <h3 className="text-sm font-semibold text-foreground">
              Itens do orçamento
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {state.items.length} {state.items.length === 1 ? "item" : "itens"} adicionados
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">
            <UnifiedCart
              items={state.items}
              onDuplicate={duplicateItem}
              onRemove={removeItem}
              highlightId={highlightId}
              taxPct={state.tax_pct}
              feesPct={state.fees_pct}
              wastePct={globalSettings.waste_pct}
            />
          </div>
          <div className="shrink-0 p-3 border-t border-border/60 bg-background">
            <FinancialPanel summary={summary} />
          </div>
        </aside>

        {/* Mobile bottom sheet */}
        <MobileCart
          state={state}
          onDuplicate={duplicateItem}
          onRemove={removeItem}
          summary={summary}
          highlightId={highlightId}
          wastePct={globalSettings.waste_pct}
        />
      </div>

      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <DialogTitle>Revisão do checklist</DialogTitle>
            <DialogDescription>
              Confira as perguntas pendentes antes de salvar o orçamento.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <QuoteChecklistPanelV3
              items={state.items}
              quoteId={editingQuoteId ?? null}
              onItemsChange={(next) => setState((s) => ({ ...s, items: next }))}
              onAnswersChange={setChecklistAnswers}
            />
          </div>
          <DialogFooter className="px-6 py-3 border-t border-border gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setChecklistDialogOpen(false)}
              disabled={saving}
            >
              Voltar
            </Button>
            <Button
              onClick={async () => {
                setChecklistDialogOpen(false);
                await performSave();
              }}
              disabled={saving}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Confirmar e salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function MobileCart({
  state,
  onDuplicate,
  onRemove,
  summary,
  highlightId,
  wastePct,
}: {
  state: V3QuoteState;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  summary: ReturnType<typeof summarize>;
  highlightId: string | null;
  wastePct: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {state.items.length} {state.items.length === 1 ? "item" : "itens"}
        </span>
        <span className="text-base font-bold text-primary tabular-nums">
          {fmtBRL(summary.total)}
        </span>
      </button>
      {open && (
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-3 border-t border-border/60">
          <UnifiedCart
            items={state.items}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
            highlightId={highlightId}
            taxPct={state.tax_pct}
            feesPct={state.fees_pct}
            wastePct={wastePct}
          />
          <FinancialPanel summary={summary} />
        </div>
      )}
    </div>
  );
}
