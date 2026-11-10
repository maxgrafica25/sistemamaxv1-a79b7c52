// Lista em fila única (todas as etapas juntas): "Sem resposta" e "Retornos".
// Em cada linha: abrir o WhatsApp Web com uma mensagem pronta e marcar como feito.
import { Check, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { buildWaWebUrl } from "@/lib/quotes/whatsapp";
import { preencherModelo, type DadosModelo } from "@/lib/crm/fila";
import { atualizarAtendimento, nomeDoContato, registrarMensagem, type Atendimento, type AtendimentoRow, type Crm, type Modelo } from "@/lib/crm/dados";
import { EtiquetaChip, RelogioEspera } from "./pecas";
import { ChipRetorno } from "./AtendimentosKanban";

export function ListaFila({
  modo,
  itens,
  crm,
  agora,
  onAbrir,
}: {
  modo: "sem_resposta" | "retornos";
  itens: Atendimento[];
  crm: Crm;
  agora: Date;
  onAbrir: (id: string) => void;
}) {
  const { profile } = useAuth();
  const { companyName } = useCompanySettings();
  const etapaNome = new Map(crm.etapas.map((e) => [e.id, e]));

  const salvar = async (a: Atendimento, patch: Partial<AtendimentoRow>) => {
    crm.aplicarLocal(a.id, patch);
    if (!(await atualizarAtendimento(a.id, patch))) void crm.recarregarAtendimentos();
  };

  const feito = (a: Atendimento) => {
    const antes: Partial<AtendimentoRow> =
      modo === "retornos" ? { retorno_em: a.retorno_em, retorno_nota: a.retorno_nota } : { aguardando_desde: a.aguardando_desde };
    void salvar(a, modo === "retornos" ? { retorno_em: null, retorno_nota: null } : { aguardando_desde: null });
    toast.success(modo === "retornos" ? "Retorno marcado como feito" : "Marcado como respondido", {
      action: { label: "Desfazer", onClick: () => void salvar(a, antes) },
    });
  };

  const enviar = async (a: Atendimento, m: Modelo) => {
    const dados: DadosModelo = {
      nome: nomeDoContato(a),
      pedido: a.pedido_numero,
      orcamento: a.orcamento_numero,
      atendente: profile?.display_name,
      empresa: companyName,
    };
    const r = preencherModelo(m.texto, dados);
    if (r.faltando.length) {
      toast.warning(`Falta ${r.faltando.join(", ")} neste atendimento`, { description: "Abra o cartão para ligar o pedido/orçamento ou ajustar a mensagem." });
      onAbrir(a.id);
      return;
    }
    const url = buildWaWebUrl(r.texto, a.cliente?.telefone ?? "");
    if (!url) {
      toast.error("Este cliente está sem telefone no cadastro");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    const patch = await registrarMensagem({ atendimento_id: a.id, tipo: "equipe", conteudo: r.texto }, a.aguardando_desde);
    if (!patch) return;
    const extra: Partial<AtendimentoRow> = modo === "retornos" ? { retorno_em: null, retorno_nota: null } : {};
    crm.aplicarLocal(a.id, { ...(patch as Partial<AtendimentoRow>), ...extra });
    if (modo === "retornos") await atualizarAtendimento(a.id, extra);
    toast.success("WhatsApp aberto com a mensagem pronta", { description: "Confira e aperte enviar lá. Aqui já saiu da fila." });
  };

  if (itens.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        {modo === "retornos" ? "Nenhum retorno para hoje ou atrasado. 🎉" : "Ninguém aguardando resposta. 🎉"}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {itens.map((a, i) => {
        const etapa = etapaNome.get(a.etapa_id);
        return (
          <div key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
            <span className="w-6 text-center text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
            <button type="button" onClick={() => onAbrir(a.id)} className="min-w-0 flex-1 text-left">
              <div className="flex flex-wrap items-center gap-1.5">
                {a.prioridade && <Star className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />}
                <span className="truncate text-sm font-semibold">{nomeDoContato(a)}</span>
                {a.etiquetas.map((e) => <EtiquetaChip key={e.id} etiqueta={e} />)}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {modo === "retornos" && a.retorno_nota && <span className="font-medium text-foreground">{a.retorno_nota}</span>}
                {a.titulo && <span className="truncate">{a.titulo}</span>}
                {etapa && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: etapa.cor }} />
                    {etapa.nome}
                  </span>
                )}
                {a.pedido_numero && <span>Pedido {a.pedido_numero}</span>}
                {a.responsavel_nome && <span>· {a.responsavel_nome.split(" ")[0]}</span>}
              </div>
            </button>
            <div className="flex items-center gap-1.5">
              {modo === "retornos" ? <ChipRetorno retornoEm={a.retorno_em} agora={agora} /> : <RelogioEspera desde={a.aguardando_desde} agora={agora} />}
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={!a.cliente?.telefone} title={a.cliente?.telefone ? "Escolher mensagem pronta e abrir o WhatsApp Web" : "Cliente sem telefone no cadastro"}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="max-h-80 w-80 overflow-y-auto p-1">
                  {crm.modelosAtivos.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nenhuma mensagem pronta cadastrada.</p>}
                  {crm.modelosAtivos.map((m) => (
                    <button key={m.id} type="button" onClick={() => void enviar(a, m)} className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted">
                      <span className="text-sm font-medium">{m.titulo}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {preencherModelo(m.texto, { nome: nomeDoContato(a), pedido: a.pedido_numero, orcamento: a.orcamento_numero, atendente: profile?.display_name, empresa: companyName }).texto}
                      </span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => feito(a)}>
                <Check className="h-3.5 w-3.5" /> {modo === "retornos" ? "Feito" : "Respondido"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
