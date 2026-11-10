// Atendimentos (CRM): quadro kanban por etapa, fila "sem resposta" e retornos (follow-up).
// Regras da fila em src/lib/crm/fila.ts; dados em src/lib/crm/dados.ts.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, Headset, Inbox, LayoutGrid, Loader2, Plus, Search, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DotTabs } from "@/components/ui/dot-tabs";
import { useAuth } from "@/hooks/useAuth";
import { CANAIS, combinaBusca, ordenarFila, retornoPendente } from "@/lib/crm/fila";
import { atualizarAtendimento, nomeDoContato, patchAoMover, useCrm, type AtendimentoRow } from "@/lib/crm/dados";
import { AtendimentosKanban } from "@/components/atendimentos/AtendimentosKanban";
import { AtendimentoPainel } from "@/components/atendimentos/AtendimentoPainel";
import { ListaFila } from "@/components/atendimentos/ListaFila";
import { NovoAtendimentoDialog } from "@/components/atendimentos/NovoAtendimentoDialog";
import { CrmConfigDialog } from "@/components/atendimentos/CrmConfigDialog";
import { EtiquetaChip } from "@/components/atendimentos/pecas";

type Aba = "quadro" | "sem_resposta" | "retornos";
const TODOS = "__todos__";

export default function Atendimentos() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const crm = useCrm();
  const [params, setParams] = useSearchParams();
  const abertoId = params.get("a");
  const aba = (["quadro", "sem_resposta", "retornos"].includes(params.get("aba") ?? "") ? params.get("aba") : "quadro") as Aba;

  const [busca, setBusca] = useState("");
  const [etiqueta, setEtiqueta] = useState(TODOS);
  const [responsavel, setResponsavel] = useState(TODOS);
  const [canal, setCanal] = useState(TODOS);
  const [novoAberto, setNovoAberto] = useState(false);
  const [configAberta, setConfigAberta] = useState(false);

  // relógio da fila (tempo de espera e retornos do dia)
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const mudarParam = (chave: string, valor: string | null) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(chave, valor);
    else p.delete(chave);
    setParams(p, { replace: true });
  };
  const abrir = (id: string) => mudarParam("a", id);

  const finais = useMemo(() => new Set(crm.etapas.filter((e) => e.is_final).map((e) => e.id)), [crm.etapas]);

  const filtrados = useMemo(
    () =>
      crm.atendimentos.filter((a) => {
        if (etiqueta !== TODOS && !a.etiquetas.some((e) => e.id === etiqueta)) return false;
        if (responsavel !== TODOS && a.responsavel_id !== responsavel) return false;
        if (canal !== TODOS && a.canal !== canal) return false;
        if (busca.trim()) {
          const alvo = [nomeDoContato(a), a.cliente?.empresa, a.cliente?.telefone, a.titulo, a.pedido_numero, a.orcamento_numero].filter(Boolean).join(" ");
          if (!combinaBusca(alvo, busca)) return false;
        }
        return true;
      }),
    [crm.atendimentos, etiqueta, responsavel, canal, busca],
  );

  const semResposta = useMemo(() => ordenarFila(filtrados.filter((a) => a.aguardando_desde && !finais.has(a.etapa_id)), agora), [filtrados, finais, agora]);
  const retornosTotal = useMemo(() => filtrados.filter((a) => retornoPendente(a.retorno_em, agora)).length, [filtrados, agora]);

  const mover = async (id: string, etapaId: string) => {
    const a = crm.atendimentos.find((x) => x.id === id);
    const etapa = crm.etapas.find((e) => e.id === etapaId);
    if (!a || !etapa) return;
    const patch = patchAoMover(a, etapa) as Partial<AtendimentoRow>;
    crm.aplicarLocal(id, patch);
    const ok = await atualizarAtendimento(id, patch);
    if (!ok) return void crm.recarregarAtendimentos();
    if (patch.retorno_em && !a.retorno_em) {
      toast.success(`Retorno marcado para ${new Date(patch.retorno_em).toLocaleDateString("pt-BR")}`, { description: `Regra da etapa “${etapa.nome}”.` });
    }
  };

  const aberto = abertoId ? crm.atendimentos.find((a) => a.id === abertoId) ?? null : null;
  const temFiltro = busca.trim() || etiqueta !== TODOS || responsavel !== TODOS || canal !== TODOS;
  const etiquetaSel = crm.etiquetas.find((e) => e.id === etiqueta);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <PageHeader
        icon={Headset}
        title="Atendimentos"
        description="Cada cartão é um atendimento ligado a um cliente. Quem espera resposta há mais tempo fica em cima."
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => setConfigAberta(true)} className="gap-1.5">
                <Settings2 className="h-4 w-4" /> Configurar
              </Button>
            )}
            <Button onClick={() => setNovoAberto(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo atendimento
            </Button>
          </div>
        }
      />

      <DotTabs<Aba>
        tabs={[
          { key: "quadro", label: "Quadro", icon: LayoutGrid },
          { key: "sem_resposta", label: `Sem resposta${semResposta.length ? ` (${semResposta.length})` : ""}`, icon: Inbox },
          { key: "retornos", label: `Retornos${retornosTotal ? ` (${retornosTotal})` : ""}`, icon: CalendarClock },
        ]}
        value={aba}
        onChange={(k) => mudarParam("aba", k === "quadro" ? null : k)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cliente, assunto, pedido…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
        </div>
        <Select value={etiqueta} onValueChange={setEtiqueta}>
          <SelectTrigger className="w-[170px]">
            {etiquetaSel ? <EtiquetaChip etiqueta={etiquetaSel} /> : <SelectValue />}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as etiquetas</SelectItem>
            {crm.etiquetas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={responsavel} onValueChange={setResponsavel}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Toda a equipe</SelectItem>
            {user && <SelectItem value={user.id}>Só os meus</SelectItem>}
            {crm.pessoas.filter((p) => p.user_id !== user?.id).map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={canal} onValueChange={setCanal}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os canais</SelectItem>
            {CANAIS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {temFiltro && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setBusca(""); setEtiqueta(TODOS); setResponsavel(TODOS); setCanal(TODOS); }}>
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {crm.carregando ? (
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : crm.etapasAtivas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Nenhuma etapa criada. {isAdmin ? "Clique em “Configurar” para criar as colunas do quadro." : "Peça ao administrador para configurar o quadro."}
        </div>
      ) : aba === "quadro" ? (
        <AtendimentosKanban etapas={crm.etapasAtivas} atendimentos={filtrados} agora={agora} onMover={(id, e) => void mover(id, e)} onAbrir={abrir} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ListaFila modo={aba} itens={aba === "retornos" ? ordenarRetornos(filtrados, agora) : semResposta} crm={crm} agora={agora} onAbrir={abrir} />
        </div>
      )}

      <AtendimentoPainel atendimento={aberto} crm={crm} agora={agora} onClose={() => mudarParam("a", null)} />
      <NovoAtendimentoDialog open={novoAberto} onOpenChange={setNovoAberto} crm={crm} onCriado={abrir} />
      {isAdmin && <CrmConfigDialog open={configAberta} onOpenChange={setConfigAberta} crm={crm} atendimentos={crm.atendimentos} />}
    </div>
  );
}

/** Retornos vencidos ou de hoje: prioridade primeiro, depois o mais antigo. */
function ordenarRetornos<T extends { retorno_em: string | null; prioridade: boolean }>(itens: T[], agora: Date): T[] {
  return itens
    .filter((a) => retornoPendente(a.retorno_em, agora))
    .sort((a, b) => Number(b.prioridade) - Number(a.prioridade) || new Date(a.retorno_em!).getTime() - new Date(b.retorno_em!).getTime());
}
