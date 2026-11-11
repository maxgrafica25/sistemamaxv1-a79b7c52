// Configuração do CRM (só admin): etapas do quadro, etiquetas de cliente e mensagens prontas (atalhos).
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { VARIAVEIS_MODELO, normalizarAtalho, preencherModelo } from "@/lib/crm/fila";
import type { Atendimento, Crm, Etapa, Etiqueta, Modelo } from "@/lib/crm/dados";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/ConfirmDialog";
import { EtiquetaChip } from "./pecas";

const CORES = ["#64748b", "#ef4444", "#f59e0b", "#eab308", "#10b981", "#0f766e", "#3b82f6", "#8b5cf6", "#ec4899"];

function Cor({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  // o seletor dispara a cada movimento; só salva ao fechar/sair
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return (
    <input
      type="color"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== valor) onChange(v); }}
      list="crm-cores"
      className="h-8 w-9 shrink-0 cursor-pointer rounded border border-input bg-background p-0.5"
      title="Cor"
    />
  );
}

/** Campo que salva ao sair (ou Enter). */
function CampoSalva({ valor, onSalvar, className, placeholder }: { valor: string; onSalvar: (v: string) => void; className?: string; placeholder?: string }) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return (
    <Input
      value={v}
      placeholder={placeholder}
      className={className}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v.trim() && v.trim() !== valor) onSalvar(v.trim()); else setV(valor); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}

export function CrmConfigDialog({
  open,
  onOpenChange,
  crm,
  atendimentos,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  crm: Crm;
  atendimentos: Atendimento[];
}) {
  const [apagar, setApagar] = useState<{ tipo: "etiqueta" | "modelo"; id: string; nome: string } | null>(null);
  const [novoAtalho, setNovoAtalho] = useState({ atalho: "", titulo: "", texto: "" });

  const ok = async (p: PromiseLike<{ error: unknown }>, contexto: string) => {
    const { error } = await p;
    if (error) {
      handleError(error, contexto);
      return false;
    }
    await crm.recarregar();
    return true;
  };

  // ── Etapas
  const etapas = crm.etapas.filter((e) => !e.is_archived);
  const arquivadas = crm.etapas.filter((e) => e.is_archived);
  const salvarEtapa = (e: Etapa, patch: Partial<Etapa>) => ok(supabase.from("crm_etapas").update(patch).eq("id", e.id), "salvar etapa");
  const novaEtapa = () =>
    ok(supabase.from("crm_etapas").insert({ nome: "Nova etapa", sort_order: (etapas[etapas.length - 1]?.sort_order ?? 0) + 10 }), "criar etapa");
  const moverEtapa = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= etapas.length) return;
    const ordem = [...etapas];
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    const res = await Promise.all(ordem.map((e, k) => supabase.from("crm_etapas").update({ sort_order: (k + 1) * 10 }).eq("id", e.id)));
    const erro = res.find((r) => r.error)?.error;
    if (erro) handleError(erro, "reordenar etapas");
    await crm.recarregar();
  };
  const arquivarEtapa = (e: Etapa) => {
    const n = atendimentos.filter((a) => a.etapa_id === e.id).length;
    if (n > 0) {
      toast.error(`“${e.nome}” ainda tem ${n} cartão(ões)`, { description: "Arraste os cartões para outra etapa antes de arquivar." });
      return;
    }
    if (etapas.length <= 1) {
      toast.error("O quadro precisa de pelo menos uma etapa");
      return;
    }
    void salvarEtapa(e, { is_archived: true });
  };

  // ── Etiquetas
  const salvarEtiqueta = (e: Etiqueta, patch: Partial<Etiqueta>) => ok(supabase.from("crm_etiquetas").update(patch).eq("id", e.id), "salvar etiqueta");
  const novaEtiqueta = () => {
    let nome = "Nova etiqueta";
    for (let i = 2; crm.etiquetas.some((e) => e.nome.toLowerCase() === nome.toLowerCase()); i++) nome = `Nova etiqueta ${i}`;
    return ok(
      supabase.from("crm_etiquetas").insert({ nome, cor: CORES[crm.etiquetas.length % CORES.length], sort_order: (crm.etiquetas[crm.etiquetas.length - 1]?.sort_order ?? 0) + 10 }),
      "criar etiqueta",
    );
  };

  // ── Atalhos
  const salvarModelo = (m: Modelo, patch: Partial<Modelo>) => ok(supabase.from("crm_modelos_mensagem").update(patch).eq("id", m.id), "salvar atalho");
  const criarModelo = async () => {
    const atalho = normalizarAtalho(novoAtalho.atalho);
    if (!atalho || !novoAtalho.titulo.trim() || !novoAtalho.texto.trim()) {
      toast.error("Preencha o atalho, o título e a mensagem");
      return;
    }
    if (crm.modelos.some((m) => m.atalho === atalho)) {
      toast.error(`Já existe o atalho /${atalho}`);
      return;
    }
    const feito = await ok(
      supabase.from("crm_modelos_mensagem").insert({
        atalho,
        titulo: novoAtalho.titulo.trim(),
        texto: novoAtalho.texto.trim(),
        sort_order: (crm.modelos[crm.modelos.length - 1]?.sort_order ?? 0) + 10,
      }),
      "criar atalho",
    );
    if (feito) setNovoAtalho({ atalho: "", titulo: "", texto: "" });
  };

  const confirmarApagar = async () => {
    if (!apagar) return;
    const tabela = apagar.tipo === "etiqueta" ? "crm_etiquetas" : "crm_modelos_mensagem";
    await ok(supabase.from(tabela).delete().eq("id", apagar.id), "excluir");
    if (apagar.tipo === "etiqueta") void crm.recarregarAtendimentos();
    setApagar(null);
  };

  const exemplo = { nome: "Maria Silva", pedido: "PED-0123", orcamento: "ORC-0456", atendente: "Juliano", empresa: "Max Gráfica" };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar atendimentos</DialogTitle>
            <DialogDescription>Etapas do quadro, etiquetas dos clientes e mensagens prontas. O que você mudar aqui vale para toda a equipe.</DialogDescription>
          </DialogHeader>
          <datalist id="crm-cores">{CORES.map((c) => <option key={c} value={c} />)}</datalist>

          <Tabs defaultValue="etapas" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="self-start">
              <TabsTrigger value="etapas">Etapas</TabsTrigger>
              <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
              <TabsTrigger value="atalhos">Atalhos (mensagens prontas)</TabsTrigger>
            </TabsList>

            <TabsContent value="etapas" className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground">
                Cada etapa é uma coluna do quadro. “Encerra” = o cartão sai da fila de espera ao chegar nela. “Retorno em” cria o follow-up sozinho quando o cartão entra na etapa.
              </p>
              {etapas.map((e, i) => (
                <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                  <div className="flex flex-col">
                    <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0} onClick={() => void moverEtapa(i, -1)} title="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === etapas.length - 1} onClick={() => void moverEtapa(i, 1)} title="Descer"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <Cor valor={e.cor} onChange={(cor) => void salvarEtapa(e, { cor })} />
                  <CampoSalva valor={e.nome} onSalvar={(nome) => void salvarEtapa(e, { nome })} className="h-8 min-w-[140px] flex-1" />
                  <label className="flex items-center gap-1.5 text-xs">
                    Retorno em
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      defaultValue={e.retorno_auto_dias ?? ""}
                      key={`${e.id}-${e.retorno_auto_dias}`}
                      placeholder="–"
                      className="h-8 w-14 px-2 text-center"
                      onBlur={(ev) => {
                        const n = ev.target.value ? Math.max(1, Math.min(365, Math.round(Number(ev.target.value)))) : null;
                        if (n !== e.retorno_auto_dias) void salvarEtapa(e, { retorno_auto_dias: n });
                      }}
                    />
                    dias
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    Encerra
                    <Switch checked={e.is_final} onCheckedChange={(v) => void salvarEtapa(e, { is_final: v })} />
                  </label>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => arquivarEtapa(e)} title="Arquivar etapa">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void novaEtapa()}>
                <Plus className="h-3.5 w-3.5" /> Nova etapa
              </Button>
              {arquivadas.length > 0 && (
                <div className="pt-2 text-xs text-muted-foreground">
                  Arquivadas:{" "}
                  {arquivadas.map((e) => (
                    <button key={e.id} type="button" className="mr-2 underline hover:text-foreground" onClick={() => void salvarEtapa(e, { is_archived: false })} title="Clique para trazer de volta">
                      {e.nome}
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="etiquetas" className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground">
                Etiquetas ficam no cliente e aparecem em todos os atendimentos dele. Marque “Prioridade” para o cliente passar na frente na fila e ficar destacado.
              </p>
              {crm.etiquetas.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                  <Cor valor={e.cor} onChange={(cor) => void salvarEtiqueta(e, { cor })} />
                  <CampoSalva valor={e.nome} onSalvar={(nome) => void salvarEtiqueta(e, { nome })} className="h-8 min-w-[140px] flex-1" />
                  <EtiquetaChip etiqueta={e} />
                  <label className="flex items-center gap-1.5 text-xs">
                    Prioridade
                    <Switch checked={e.prioridade} onCheckedChange={(v) => void salvarEtiqueta(e, { prioridade: v })} />
                  </label>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setApagar({ tipo: "etiqueta", id: e.id, nome: e.nome })} title="Excluir etiqueta">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void novaEtiqueta()}>
                <Plus className="h-3.5 w-3.5" /> Nova etiqueta
              </Button>
            </TabsContent>

            <TabsContent value="atalhos" className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                Na caixa de mensagem, digite <code className="rounded bg-background px-1">/</code> e o atalho. O sistema troca sozinho:{" "}
                {VARIAVEIS_MODELO.map((v, i) => (
                  <span key={v.chave}>
                    <code className="rounded bg-background px-1 text-foreground">{v.chave}</code> {v.descricao}
                    {i < VARIAVEIS_MODELO.length - 1 ? " · " : "."}
                  </span>
                ))}
              </div>
              {crm.modelos.map((m) => (
                <div key={m.id} className="space-y-1.5 rounded-lg border border-border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">/</span>
                    <CampoSalva
                      valor={m.atalho}
                      onSalvar={(v) => {
                        const atalho = normalizarAtalho(v);
                        if (!atalho) return;
                        if (crm.modelos.some((x) => x.id !== m.id && x.atalho === atalho)) return void toast.error(`Já existe o atalho /${atalho}`);
                        void salvarModelo(m, { atalho });
                      }}
                      className="h-8 w-32 font-mono text-xs"
                    />
                    <CampoSalva valor={m.titulo} onSalvar={(titulo) => void salvarModelo(m, { titulo })} className="h-8 min-w-[140px] flex-1" />
                    <label className="flex items-center gap-1.5 text-xs">
                      Ativo
                      <Switch checked={m.is_active} onCheckedChange={(v) => void salvarModelo(m, { is_active: v })} />
                    </label>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setApagar({ tipo: "modelo", id: m.id, nome: `/${m.atalho}` })} title="Excluir atalho">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    defaultValue={m.texto}
                    key={`${m.id}-${m.updated_at}`}
                    rows={2}
                    className="resize-none text-sm"
                    onBlur={(e) => { const t = e.target.value.trim(); if (t && t !== m.texto) void salvarModelo(m, { texto: t }); }}
                  />
                  <p className="text-xs text-muted-foreground">Exemplo: {preencherModelo(m.texto, exemplo).texto}</p>
                </div>
              ))}
              <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2">
                <p className="text-xs font-semibold">Novo atalho</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">/</span>
                  <Input value={novoAtalho.atalho} onChange={(e) => setNovoAtalho({ ...novoAtalho, atalho: normalizarAtalho(e.target.value) })} placeholder="pronto" className="h-8 w-32 font-mono text-xs" />
                  <Input value={novoAtalho.titulo} onChange={(e) => setNovoAtalho({ ...novoAtalho, titulo: e.target.value })} placeholder="Título (ex.: Pedido pronto)" className="h-8 min-w-[140px] flex-1" />
                </div>
                <Textarea value={novoAtalho.texto} onChange={(e) => setNovoAtalho({ ...novoAtalho, texto: e.target.value })} rows={2} className="resize-none text-sm" placeholder="{nome}, seu pedido {pedido} está pronto e já pode ser retirado." />
                <Button size="sm" className="gap-1.5" onClick={() => void criarModelo()}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar atalho
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!apagar}
        onOpenChange={(o) => { if (!o) setApagar(null); }}
        title={`Excluir ${apagar?.nome ?? ""}?`}
        description={apagar?.tipo === "etiqueta" ? "A etiqueta sai de todos os clientes que a têm." : "A mensagem pronta deixa de aparecer para a equipe."}
        confirmText="Excluir"
        onConfirm={() => void confirmarApagar()}
      />
    </>
  );
}
