import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import {
  PRESET_ICONS,
  PRESET_ICON_NAMES,
  iconFor,
} from "@/components/orcamentos-v3/shared/presetIcons";
import { ChipMultiPicker, type ChipOption } from "@/components/orcamentos-v3/shared/ChipMultiPicker";
import { listFinishings } from "@/lib/finishings/catalog";
import type { QuotePreset } from "@/components/orcamentos-v3/shared/useQuotePresets";

const PAPER_GROUP_LABELS: Record<string, string> = {
  comum: "Papel Comum",
  especial: "Especial",
  adesivo: "Adesivo",
};
const PAPER_GROUP_ORDER = ["comum", "especial", "adesivo"];

function summarizePaperSelection(selected: string[], options: ChipOption[]): string {
  if (!selected.length) return "";
  const byGroup = new Map<string, { total: number; picked: number }>();
  for (const opt of options) {
    const g = opt.group ?? "outros";
    if (!byGroup.has(g)) byGroup.set(g, { total: 0, picked: 0 });
    byGroup.get(g)!.total += 1;
    if (selected.includes(opt.value)) byGroup.get(g)!.picked += 1;
  }
  const parts: string[] = [];
  for (const [g, { total, picked }] of byGroup) {
    if (picked === 0) continue;
    if (picked === total) parts.push(`${PAPER_GROUP_LABELS[g] ?? g} (todos)`);
  }
  if (parts.length) {
    const remaining = selected.length - PAPER_GROUP_ORDER.reduce((acc, g) => {
      const info = byGroup.get(g);
      return acc + (info && info.picked === info.total ? info.total : 0);
    }, 0);
    if (remaining > 0) parts.push(`+${remaining}`);
    return parts.join(", ");
  }
  const head = selected.slice(0, 3).join(", ");
  return selected.length > 3 ? `${head} +${selected.length - 3}` : head;
}

type FormState = {
  nome: string;
  icone: string;
  modulo: "cv" | "impressao" | "ambos";
  form_tipo: "print" | "booklet" | "label" | "";
  ordem: number;
  ativo: boolean;
  largura_cm: string;
  altura_cm: string;
  quantidade_padrao: string;
  is_banner: boolean;
  midia_tipo: "lona" | "adesivo" | "chapa" | "";
  midia_nome_match: string;
  papel_inclui: string[];
  papel_exclui: string[];
  acabamentos_sugeridos: string[];
  papel_default_nome: string;
  papel_default_grammage: string;
  side_default: "" | "F" | "F/V";
  preselect_acabamentos: boolean;
};

const EMPTY: FormState = {
  nome: "",
  icone: "Wand2",
  modulo: "ambos",
  form_tipo: "print",
  ordem: 0,
  ativo: true,
  largura_cm: "",
  altura_cm: "",
  quantidade_padrao: "",
  is_banner: false,
  midia_tipo: "",
  midia_nome_match: "",
  papel_inclui: [],
  papel_exclui: [],
  acabamentos_sugeridos: [],
  papel_default_nome: "",
  papel_default_grammage: "",
  side_default: "",
  preselect_acabamentos: false,
};

export default function QuotePresets() {
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<QuotePreset[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuotePreset | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [filtroModulo, setFiltroModulo] = useState<"todos" | "cv" | "impressao" | "ambos">("todos");
  const [paperOptions, setPaperOptions] = useState<ChipOption[]>([]);
  const [finishingOptions, setFinishingOptions] = useState<ChipOption[]>([]);
  const { requireAdmin } = usePermissionGuard();

  useEffect(() => {
    (async () => {
      const [{ data: papers }, finishings] = await Promise.all([
        (supabase as any)
          .from("papers")
          .select("name, category")
          .eq("is_active", true),
        listFinishings("impressao").catch(() => []),
      ]);
      // Dedupe by name — pick the most specific category found.
      const byName = new Map<string, string>();
      for (const r of (papers ?? []) as any[]) {
        const name = String(r.name ?? "").trim();
        if (!name) continue;
        const cat = String(r.category ?? "comum");
        if (!byName.has(name)) byName.set(name, cat);
      }
      const uniq = Array.from(byName.entries()).sort((a, b) =>
        a[0].localeCompare(b[0], "pt-BR"),
      );
      setPaperOptions(uniq.map(([name, cat]) => ({ value: name, group: cat })));
      setFinishingOptions(
        (finishings as any[])
          .map((f) => String(f.name ?? "").trim())
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map((v) => ({ value: v })),
      );
    })();
  }, []);


  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quote_presets")
      .select("*")
      .order("modulo")
      .order("ordem");
    setLoading(false);
    if (error) return handleError(error, "carregar presets");
    setPresets(((data as unknown) as QuotePreset[]) ?? []);
  };

  useEffect(() => { fetchAll(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (p: QuotePreset) => {
    setEditing(p);
    setForm({
      nome: p.nome,
      icone: p.icone || "Wand2",
      modulo: p.modulo,
      form_tipo: (p.form_tipo ?? "") as FormState["form_tipo"],
      ordem: p.ordem,
      ativo: p.ativo,
      largura_cm: p.largura_cm?.toString() ?? "",
      altura_cm: p.altura_cm?.toString() ?? "",
      quantidade_padrao: p.quantidade_padrao?.toString() ?? "",
      is_banner: p.is_banner,
      midia_tipo: (p.midia_tipo ?? "") as FormState["midia_tipo"],
      midia_nome_match: p.midia_nome_match ?? "",
      papel_inclui: p.papel_inclui ?? [],
      papel_exclui: p.papel_exclui ?? [],
      acabamentos_sugeridos: p.acabamentos_sugeridos ?? [],
      papel_default_nome: p.papel_default_nome ?? "",
      papel_default_grammage: p.papel_default_grammage ?? "",
      side_default: (p.side_default ?? "") as FormState["side_default"],
      preselect_acabamentos: !!p.preselect_acabamentos,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!requireAdmin(editing ? "editar preset" : "criar preset")) return;
    const nome = form.nome.trim();
    if (!nome) return toast.error("Nome é obrigatório");
    const payload = {
      nome,
      icone: form.icone || "Wand2",
      modulo: form.modulo,
      form_tipo: form.modulo === "cv" ? null : (form.form_tipo || null),
      ordem: Number(form.ordem) || 0,
      ativo: form.ativo,
      largura_cm: form.largura_cm ? Number(form.largura_cm) : null,
      altura_cm: form.altura_cm ? Number(form.altura_cm) : null,
      quantidade_padrao: form.quantidade_padrao ? Number(form.quantidade_padrao) : null,
      is_banner: form.is_banner,
      midia_tipo: form.midia_tipo || null,
      midia_nome_match: form.midia_nome_match.trim() || null,
      papel_inclui: form.papel_inclui,
      papel_exclui: form.papel_exclui,
      acabamentos_sugeridos: form.acabamentos_sugeridos,
      papel_default_nome: form.papel_default_nome.trim() || null,
      papel_default_grammage: form.papel_default_grammage.trim() || null,
      side_default: form.side_default || null,
      preselect_acabamentos: form.preselect_acabamentos,
    };
    setBusy(true);
    if (editing) {
      const { error } = await supabase
        .from("quote_presets")
        .update(payload)
        .eq("id", editing.id);
      setBusy(false);
      if (error) return handleError(error, "atualizar preset");
      toast.success("Preset atualizado!");
    } else {
      const { error } = await supabase.from("quote_presets" as never).insert(payload as never);
      setBusy(false);
      if (error) return handleError(error, "criar preset");
      toast.success("Preset criado!");
    }
    setDialogOpen(false);
    await fetchAll();
  };

  const handleDelete = async (p: QuotePreset) => {
    if (!requireAdmin("excluir preset")) return;
    if (!confirm(`Excluir o preset "${p.nome}"?`)) return;
    const { error } = await supabase.from("quote_presets" as never).delete().eq("id", p.id);
    if (error) return handleError(error, "excluir preset");
    toast.success("Excluído");
    await fetchAll();
  };

  const filtered = presets.filter(
    (p) => filtroModulo === "todos" || p.modulo === filtroModulo,
  );

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader icon={Wand2} title="Produtos Favoritos" description="Botões rápidos exibidos nos módulos Comunicação Visual e Impressão + Acabamentos ao criar um orçamento." />
        <AdminOnly mode="disable" action="criar favorito">
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            Novo favorito
          </Button>
        </AdminOnly>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["todos", "cv", "impressao", "ambos"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setFiltroModulo(m)}
            className={`text-xs rounded-full border px-3 h-7 transition-colors ${
              filtroModulo === m
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "todos" ? "Todos" : m === "cv" ? "Comunicação Visual" : m === "impressao" ? "Impressão" : "Ambos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum preset nesta visualização.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => {
            const Icon = iconFor(p.icone);
            return (
              <Card key={p.id} className={p.ativo ? "" : "opacity-60"}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.nome}</span>
                      <Badge variant="outline" className="text-xs uppercase">
                        {p.modulo === "cv" ? "CV" : p.modulo === "impressao" ? "Impressão" : "Ambos"}
                      </Badge>
                      {p.form_tipo && (
                        <Badge variant="secondary" className="text-xs">{p.form_tipo}</Badge>
                      )}
                      {p.is_banner && <Badge className="text-xs">banner</Badge>}
                      {p.midia_tipo && (
                        <Badge variant="secondary" className="text-xs">mídia: {p.midia_tipo}</Badge>
                      )}
                      {!p.ativo && <Badge variant="destructive" className="text-xs">inativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ordem {p.ordem}
                      {p.largura_cm ? ` · ${p.largura_cm}×${p.altura_cm ?? "?"} cm` : ""}
                      {p.quantidade_padrao ? ` · qtd ${p.quantidade_padrao}` : ""}
                      {p.midia_nome_match ? ` · mídia "${p.midia_nome_match}"` : ""}
                      {p.papel_inclui.length ? ` · papel: ${summarizePaperSelection(p.papel_inclui, paperOptions)}` : ""}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <AdminOnly mode="disable" action="excluir preset">
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AdminOnly>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar preset" : "Novo preset"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Banner, Cartão de Visita" />
              </div>
              <div>
                <Label>Ícone</Label>
                <Select value={form.icone} onValueChange={(v) => setForm({ ...form, icone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRESET_ICON_NAMES.map((n) => {
                      const I = PRESET_ICONS[n];
                      return (
                        <SelectItem key={n} value={n}>
                          <span className="inline-flex items-center gap-2"><I className="h-4 w-4" /> {n}</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Módulo</Label>
                <Select value={form.modulo} onValueChange={(v) => setForm({ ...form, modulo: v as FormState["modulo"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cv">Comunicação Visual</SelectItem>
                    <SelectItem value="impressao">Impressão + Acabamentos</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.modulo !== "cv" && (
                <div>
                  <Label>Modo de cálculo</Label>
                  <p className="text-xs text-muted-foreground mb-1">
                    Define qual calculadora abre ao escolher este favorito no orçamento.
                  </p>
                  <Select value={form.form_tipo || "print"} onValueChange={(v) => setForm({ ...form, form_tipo: v as FormState["form_tipo"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="print">Impressão (papel + acabamentos)</SelectItem>
                      <SelectItem value="booklet">Apostila (miolo + capa)</SelectItem>
                      <SelectItem value="label">Etiqueta (layout em folha)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Largura (cm)</Label>
                <Input type="number" value={form.largura_cm} onChange={(e) => setForm({ ...form, largura_cm: e.target.value })} placeholder="opcional" />
              </div>
              <div>
                <Label>Altura (cm)</Label>
                <Input type="number" value={form.altura_cm} onChange={(e) => setForm({ ...form, altura_cm: e.target.value })} placeholder="opcional" />
              </div>
              <div>
                <Label>Quantidade padrão</Label>
                <Input type="number" value={form.quantidade_padrao} onChange={(e) => setForm({ ...form, quantidade_padrao: e.target.value })} placeholder="opcional" />
              </div>
            </div>

            {form.modulo !== "impressao" && (
              <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Comunicação Visual
                </p>
                <div className="flex items-center gap-3">
                  <Switch checked={form.is_banner} onCheckedChange={(v) => setForm({ ...form, is_banner: !!v })} />
                  <Label className="cursor-pointer">É banner? (filtra acabamentos de banner e sugere bastão)</Label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de mídia</Label>
                    <Select value={form.midia_tipo || "__none"} onValueChange={(v) => setForm({ ...form, midia_tipo: (v === "__none" ? "" : v) as FormState["midia_tipo"] })}>
                      <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Qualquer</SelectItem>
                        <SelectItem value="lona">Lona</SelectItem>
                        <SelectItem value="adesivo">Adesivo</SelectItem>
                        <SelectItem value="chapa">Chapa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mídia: trecho do nome</Label>
                    <Input value={form.midia_nome_match} onChange={(e) => setForm({ ...form, midia_nome_match: e.target.value })} placeholder="ex: brilho 440" />
                  </div>
                </div>
              </div>
            )}

            {form.modulo !== "cv" && (
              <div className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Impressão + Acabamentos
                </p>
                <ChipMultiPicker
                  label="Papel inclui"
                  helpText="Filtra para sugerir este favorito apenas quando o papel selecionado bate."
                  options={paperOptions}
                  value={form.papel_inclui}
                  onChange={(v) => setForm({ ...form, papel_inclui: v })}
                  groupLabels={PAPER_GROUP_LABELS}
                  groupOrder={PAPER_GROUP_ORDER}
                  emptyHint="Nenhum papel cadastrado em Preço Impressão."
                />
                <ChipMultiPicker
                  label="Papel exclui (opcional)"
                  helpText="Impede sugerir este favorito quando o papel é um dos marcados."
                  options={paperOptions}
                  value={form.papel_exclui}
                  onChange={(v) => setForm({ ...form, papel_exclui: v })}
                  groupLabels={PAPER_GROUP_LABELS}
                  groupOrder={PAPER_GROUP_ORDER}
                />
                <ChipMultiPicker
                  label="Acabamentos sugeridos"
                  helpText="Acabamentos que aparecem pré-selecionados ao escolher este favorito."
                  options={finishingOptions}
                  value={form.acabamentos_sugeridos}
                  onChange={(v) => setForm({ ...form, acabamentos_sugeridos: v })}
                  emptyHint="Nenhum acabamento de Impressão cadastrado."
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
                  <div className="sm:col-span-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Pré-seleção automática (opcional)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Quando o favorito é escolhido, o orçamento já vem com este papel e lado preenchidos.
                    </p>
                  </div>
                  <div>
                    <Label>Papel padrão</Label>
                    <Input
                      value={form.papel_default_nome}
                      onChange={(e) => setForm({ ...form, papel_default_nome: e.target.value })}
                      placeholder="ex: Couchê"
                    />
                  </div>
                  <div>
                    <Label>Gramatura padrão</Label>
                    <Input
                      value={form.papel_default_grammage}
                      onChange={(e) => setForm({ ...form, papel_default_grammage: e.target.value })}
                      placeholder="ex: 300"
                    />
                  </div>
                  <div>
                    <Label>Lado padrão</Label>
                    <Select
                      value={form.side_default || "__none"}
                      onValueChange={(v) =>
                        setForm({ ...form, side_default: (v === "__none" ? "" : v) as FormState["side_default"] })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Qualquer</SelectItem>
                        <SelectItem value="F">Só frente (F)</SelectItem>
                        <SelectItem value="F/V">Frente e verso (F/V)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3 flex items-center gap-3">
                    <Switch
                      checked={form.preselect_acabamentos}
                      onCheckedChange={(v) => setForm({ ...form, preselect_acabamentos: !!v })}
                    />
                    <Label className="cursor-pointer">Pré-marcar acabamentos sugeridos</Label>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: !!v })} />
              <Label className="cursor-pointer">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
