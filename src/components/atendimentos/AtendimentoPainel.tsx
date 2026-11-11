// Painel de um atendimento: dados do cliente, etapa, fila, retorno, histórico, anexos e mensagens prontas.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive, CalendarClock, Check, Copy, FileText, Loader2, Mail, MessageCircle, MessageSquareReply, Paperclip, Phone,
  StickyNote, Trash2, UserRound, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { handleError } from "@/lib/handleError";
import { useAuth } from "@/hooks/useAuth";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { buildWaWebUrl } from "@/lib/quotes/whatsapp";
import { ehImagem, ehPdf, linkDoArquivo, nomeSeguro } from "@/lib/anexos";
import { CANAIS, type Canal, type DadosModelo } from "@/lib/crm/fila";
import {
  BUCKET_ANEXOS, atualizarAtendimento, nomeDoContato, patchAoMover, registrarMensagem, salvarEtiquetasDoCliente,
  type Atendimento, type AtendimentoRow, type Crm, type Mensagem,
} from "@/lib/crm/dados";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmDialog from "@/components/ConfirmDialog";
import { VisualizadorPdf, type PdfParaAbrir } from "@/components/shared/VisualizadorPdf";
import { CampoMensagem, EtiquetaChip, RelogioEspera, SeletorEtiquetas } from "./pecas";
import { ChipRetorno } from "./AtendimentosKanban";

const NENHUM = "__nenhum__";

/** ISO → valor do campo datetime-local (horário local). */
const paraCampo = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const daquiA = (dias: number, hora = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, 0, 0, 0);
  return d.toISOString();
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function ImagemAnexo({ path, nome }: { path: string; nome: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    linkDoArquivo(BUCKET_ANEXOS, path).then((u) => vivo && setUrl(u)).catch(() => undefined);
    return () => { vivo = false; };
  }, [path]);
  if (!url) return <div className="h-24 w-32 animate-pulse rounded-lg bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img src={url} alt={nome} className="max-h-44 max-w-[240px] rounded-lg border border-border object-cover" />
    </a>
  );
}

const ESTILO_MSG: Record<string, { rotulo: string; classe: string }> = {
  nota: { rotulo: "Anotação interna", classe: "bg-amber-500/10 border-amber-500/30" },
  equipe: { rotulo: "Enviada ao cliente", classe: "bg-primary/10 border-primary/30 ml-6" },
  cliente: { rotulo: "Cliente", classe: "bg-muted border-border mr-6" },
  sistema: { rotulo: "", classe: "border-transparent bg-transparent text-center" },
};

interface Vinculo { id: string; rotulo: string }

export function AtendimentoPainel({
  atendimento,
  crm,
  agora,
  onClose,
}: {
  atendimento: Atendimento | null;
  crm: Crm;
  agora: Date;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const { companyName } = useCompanySettings();
  const isAdmin = profile?.role === "admin";
  const a = atendimento;
  const id = a?.id ?? null;

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregandoMsgs, setCarregandoMsgs] = useState(false);
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [retornoNota, setRetornoNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const [pedidos, setPedidos] = useState<Vinculo[]>([]);
  const [orcamentos, setOrcamentos] = useState<Vinculo[]>([]);
  const [pdf, setPdf] = useState<PdfParaAbrir | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregarMensagens = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("atendimento_mensagens")
      .select("*")
      .eq("atendimento_id", id)
      .order("created_at");
    if (error) handleError(error, "carregar histórico");
    setMensagens(data ?? []);
    setCarregandoMsgs(false);
  }, [id]);

  useEffect(() => {
    setMensagens([]);
    setTexto("");
    if (!id) return;
    setCarregandoMsgs(true);
    void carregarMensagens();
    const ch = supabase
      .channel(`crm_msgs_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimento_mensagens", filter: `atendimento_id=eq.${id}` }, () => void carregarMensagens())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, carregarMensagens]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  useEffect(() => {
    setTitulo(a?.titulo ?? "");
    setRetornoNota(a?.retorno_nota ?? "");
    // só quando troca de cartão ou o valor salvo muda
  }, [id, a?.titulo, a?.retorno_nota]);

  // pedidos e orçamentos do cliente, para ligar ao cartão
  const clientId = a?.client_id ?? null;
  useEffect(() => {
    setPedidos([]);
    setOrcamentos([]);
    if (!clientId) return;
    let vivo = true;
    (async () => {
      const [p, o] = await Promise.all([
        supabase.from("sales_orders").select("id, order_number, status, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30),
        supabase.from("quotes").select("id, quote_number, product, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30),
      ]);
      if (!vivo) return;
      setPedidos((p.data ?? []).map((x) => ({ id: x.id, rotulo: `${x.order_number} · ${new Date(x.created_at).toLocaleDateString("pt-BR")}` })));
      setOrcamentos((o.data ?? []).map((x) => ({ id: x.id, rotulo: `${x.quote_number}${x.product ? ` · ${x.product}` : ""}`.slice(0, 60) })));
    })();
    return () => { vivo = false; };
  }, [clientId]);

  if (!a) {
    return (
      <Sheet open={false} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent />
      </Sheet>
    );
  }

  const salvar = async (patch: Partial<AtendimentoRow>) => {
    crm.aplicarLocal(a.id, patch);
    const ok = await atualizarAtendimento(a.id, patch);
    if (!ok) void crm.recarregarAtendimentos();
    return ok;
  };

  const dadosModelo: DadosModelo = {
    nome: nomeDoContato(a),
    pedido: a.pedido_numero,
    orcamento: a.orcamento_numero,
    atendente: profile?.display_name,
    empresa: companyName,
  };

  const telefone = a.cliente?.telefone?.trim() || "";
  const linkWhats = (msg: string) => buildWaWebUrl(msg, telefone);

  const registrar = async (tipo: "nota" | "equipe" | "cliente", conteudo: string, anexo?: { path: string; nome: string }) => {
    const patch = await registrarMensagem(
      { atendimento_id: a.id, tipo, conteudo, anexo_path: anexo?.path ?? null, anexo_nome: anexo?.nome ?? null },
      a.aguardando_desde,
    );
    if (patch) {
      crm.aplicarLocal(a.id, patch as Partial<AtendimentoRow>);
      void carregarMensagens();
    }
    return !!patch;
  };

  const enviar = async (tipo: "nota" | "equipe" | "cliente", abrirWhats = false) => {
    const msg = texto.trim();
    if (!msg || enviando) return;
    if (abrirWhats) {
      const url = linkWhats(msg);
      if (!url) {
        toast.error("Este cliente está sem telefone no cadastro");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setEnviando(true);
    const ok = await registrar(tipo, msg);
    setEnviando(false);
    if (!ok) return;
    setTexto("");
    if (abrirWhats) toast.success("WhatsApp aberto com a mensagem pronta", { description: "Confira e aperte enviar lá. Aqui já ficou registrado como respondido." });
  };

  const copiar = async () => {
    const msg = texto.trim();
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const aoEscolherArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máximo 20 MB)");
      return;
    }
    setSubindo(true);
    const path = `${a.empresa_id}/${a.id}/${Date.now()}-${nomeSeguro(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET_ANEXOS).upload(path, file, { contentType: file.type || undefined });
    if (error) {
      setSubindo(false);
      handleError(error, "enviar arquivo");
      return;
    }
    await registrar("nota", texto.trim(), { path, nome: file.name });
    setTexto("");
    setSubindo(false);
  };

  const mudarEtapa = async (etapaId: string) => {
    const etapa = crm.etapas.find((e) => e.id === etapaId);
    if (!etapa || etapa.id === a.etapa_id) return;
    await salvar(patchAoMover(a, etapa) as Partial<AtendimentoRow>);
  };

  const mudarEtiquetas = async (ids: string[]) => {
    if (!a.client_id) return;
    const ok = await salvarEtiquetasDoCliente(a.client_id, a.etiquetas.map((e) => e.id), ids);
    if (ok) void crm.recarregarAtendimentos();
  };

  const arquivar = async () => {
    if (await salvar({ arquivado_em: new Date().toISOString() })) {
      toast.success("Atendimento arquivado");
      onClose();
    }
  };

  const excluir = async () => {
    const { error } = await supabase.from("atendimentos").delete().eq("id", a.id);
    if (error) return handleError(error, "excluir atendimento");
    toast.success("Atendimento excluído");
    void crm.recarregarAtendimentos();
    onClose();
  };

  const nomes = new Map(crm.pessoas.map((p) => [p.user_id, p.display_name]));

  return (
    <>
      <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="space-y-1 border-b border-border px-4 py-3 pr-12 text-left">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <UserRound className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate">{nomeDoContato(a)}</span>
            </SheetTitle>
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {a.cliente?.empresa && <span>{a.cliente.empresa}</span>}
                {telefone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{telefone}</span>}
                {a.cliente?.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{a.cliente.email}</span>}
                {a.client_id && <Link to="/cadastros" className="text-primary hover:underline">Abrir cadastro</Link>}
              </div>
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {a.etiquetas.map((e) => <EtiquetaChip key={e.id} etiqueta={e} />)}
              {a.client_id && (
                <SeletorEtiquetas etiquetas={crm.etiquetas} selecionadas={a.etiquetas.map((e) => e.id)} onChange={mudarEtiquetas} />
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Dados do cartão */}
            <div className="grid grid-cols-2 gap-3 border-b border-border px-4 py-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Assunto</Label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  onBlur={() => { if (titulo.trim() !== a.titulo) void salvar({ titulo: titulo.trim() }); }}
                  placeholder="Ex.: 500 cartões de visita"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Etapa</Label>
                <Select value={a.etapa_id} onValueChange={mudarEtapa}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {crm.etapas.filter((e) => !e.is_archived || e.id === a.etapa_id).map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Responsável</Label>
                <Select value={a.responsavel_id ?? NENHUM} onValueChange={(v) => void salvar({ responsavel_id: v === NENHUM ? null : v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Ninguém ainda</SelectItem>
                    {crm.pessoas.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Canal</Label>
                <Select value={a.canal} onValueChange={(v) => void salvar({ canal: v as Canal })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANAIS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pedido</Label>
                <Select value={a.sales_order_id ?? NENHUM} onValueChange={(v) => void salvar({ sales_order_id: v === NENHUM ? null : v }).then(() => crm.recarregarAtendimentos())}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>{pedidos.length ? "Nenhum" : "Cliente sem pedidos"}</SelectItem>
                    {a.sales_order_id && !pedidos.some((p) => p.id === a.sales_order_id) && (
                      <SelectItem value={a.sales_order_id}>{a.pedido_numero ?? "Pedido"}</SelectItem>
                    )}
                    {pedidos.map((p) => <SelectItem key={p.id} value={p.id}>{p.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Orçamento</Label>
                <Select value={a.quote_id ?? NENHUM} onValueChange={(v) => void salvar({ quote_id: v === NENHUM ? null : v }).then(() => crm.recarregarAtendimentos())}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>{orcamentos.length ? "Nenhum" : "Cliente sem orçamentos"}</SelectItem>
                    {a.quote_id && !orcamentos.some((o) => o.id === a.quote_id) && (
                      <SelectItem value={a.quote_id}>{a.orcamento_numero ?? "Orçamento"}</SelectItem>
                    )}
                    {orcamentos.map((o) => <SelectItem key={o.id} value={o.id}>{o.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fila e retorno */}
            <div className="space-y-3 border-b border-border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {a.aguardando_desde ? (
                  <>
                    <RelogioEspera desde={a.aguardando_desde} agora={agora} />
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => void salvar({ aguardando_desde: null })}>
                      <Check className="h-3 w-3" /> Já respondi
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">Sem resposta pendente.</span>
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => void salvar({ aguardando_desde: new Date().toISOString() })}>
                      <MessageSquareReply className="h-3 w-3" /> Cliente está aguardando
                    </Button>
                  </>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Retorno (follow-up)</span>
                  <ChipRetorno retornoEm={a.retorno_em} agora={agora} />
                  {a.retorno_em && (
                    <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1 text-xs" onClick={() => { setRetornoNota(""); void salvar({ retorno_em: null, retorno_nota: null }); }}>
                      <Check className="h-3 w-3" /> Retorno feito
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Input
                    type="datetime-local"
                    className="h-8 w-52 text-xs"
                    value={paraCampo(a.retorno_em)}
                    onChange={(e) => void salvar({ retorno_em: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                  {[["Hoje 16h", 0, 16], ["Amanhã", 1, 9], ["2 dias", 2, 9], ["1 semana", 7, 9]].map(([rot, d, h]) => (
                    <Button key={rot as string} size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => void salvar({ retorno_em: daquiA(d as number, h as number) })}>
                      {rot}
                    </Button>
                  ))}
                </div>
                <Input
                  value={retornoNota}
                  onChange={(e) => setRetornoNota(e.target.value)}
                  onBlur={() => { if ((retornoNota.trim() || null) !== (a.retorno_nota || null)) void salvar({ retorno_nota: retornoNota.trim() || null }); }}
                  placeholder="O que fazer no retorno? Ex.: cobrar aprovação do orçamento"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Histórico */}
            <div className="space-y-2 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico</p>
              {carregandoMsgs && <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />}
              {!carregandoMsgs && mensagens.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">Nada registrado ainda. Anote o que foi combinado ou anexe o arquivo do cliente.</p>
              )}
              {mensagens.map((m) => {
                const est = ESTILO_MSG[m.tipo] ?? ESTILO_MSG.nota;
                return (
                  <div key={m.id} className={cn("rounded-lg border px-3 py-2", est.classe)}>
                    <div className="mb-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      {est.rotulo && <span className="font-semibold">{est.rotulo}</span>}
                      <span>{m.user_id ? nomes.get(m.user_id) ?? "" : ""}</span>
                      <span className="ml-auto">{dataHora(m.created_at)}</span>
                    </div>
                    {m.conteudo && <p className="whitespace-pre-wrap break-words text-sm">{m.conteudo}</p>}
                    {m.anexo_path && (
                      <div className="mt-1.5">
                        {ehImagem(m.anexo_nome) ? (
                          <ImagemAnexo path={m.anexo_path} nome={m.anexo_nome || "Imagem"} />
                        ) : ehPdf(m.anexo_nome) ? (
                          <button
                            type="button"
                            onClick={() => setPdf({ nome: m.anexo_nome || "Documento.pdf", obterUrl: () => linkDoArquivo(BUCKET_ANEXOS, m.anexo_path!) })}
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs hover:bg-muted"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded bg-red-100 text-[10px] font-bold text-red-600">PDF</span>
                            <span className="max-w-[220px] truncate">{m.anexo_nome}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => linkDoArquivo(BUCKET_ANEXOS, m.anexo_path!).then((u) => window.open(u, "_blank", "noopener,noreferrer")).catch((err) => handleError(err, "abrir arquivo"))}
                            className="inline-flex items-center gap-1.5 rounded bg-background px-2 py-1 text-xs text-primary hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" /> {m.anexo_nome || "Arquivo"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={fimRef} />
            </div>
          </div>

          {/* Escrever */}
          {/* pr maior: o botão flutuante do assistente fica no canto de baixo à direita */}
          <div className="space-y-2 border-t border-border bg-background py-3 pl-4 pr-4 sm:pr-20">
            <CampoMensagem valor={texto} onChange={setTexto} modelos={crm.modelosAtivos} dados={dadosModelo} />
            <div className="flex flex-wrap items-center gap-1.5">
              <input ref={arquivoRef} type="file" className="hidden" onChange={aoEscolherArquivo} />
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs" onClick={() => arquivoRef.current?.click()} disabled={subindo} title="Anexar arquivo (PDF, imagem…)">
                {subindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Anexar
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs" onClick={copiar} disabled={!texto.trim()}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void enviar("cliente")} disabled={!texto.trim() || enviando} title="Registrar o que o cliente escreveu/pediu (começa a contar a espera)">
                  <MessageSquareReply className="h-3.5 w-3.5" /> Cliente disse
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void enviar("nota")} disabled={!texto.trim() || enviando}>
                  <StickyNote className="h-3.5 w-3.5" /> Anotar
                </Button>
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void enviar("equipe", true)} disabled={!texto.trim() || enviando || !telefone} title={telefone ? "Abre o WhatsApp Web na conversa do cliente com o texto pronto" : "Cliente sem telefone no cadastro"}>
                  <MessageCircle className="h-3.5 w-3.5" /> Enviar pelo WhatsApp
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" onClick={arquivar}>
                <Archive className="h-3.5 w-3.5" /> Arquivar atendimento
              </Button>
              {isAdmin && (
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-destructive" onClick={() => setConfirmarExcluir(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <VisualizadorPdf arquivo={pdf} onClose={() => setPdf(null)} />
      <ConfirmDialog
        open={confirmarExcluir}
        onOpenChange={setConfirmarExcluir}
        title="Excluir atendimento?"
        description="O histórico e as anotações deste cartão serão apagados. Para só tirar do quadro, use Arquivar."
        confirmText="Excluir"
        onConfirm={excluir}
      />
    </>
  );
}
