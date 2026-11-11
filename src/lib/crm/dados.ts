// Leitura e gravação do CRM de atendimento no Supabase.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { handleError } from "@/lib/handleError";
import { retornoAutomatico, type Canal } from "./fila";

type Tabelas = Database["public"]["Tables"];
export type Etapa = Tabelas["crm_etapas"]["Row"];
export type Etiqueta = Tabelas["crm_etiquetas"]["Row"];
export type Modelo = Tabelas["crm_modelos_mensagem"]["Row"];
export type AtendimentoRow = Tabelas["atendimentos"]["Row"];
export type Mensagem = Tabelas["atendimento_mensagens"]["Row"];

export interface ClienteResumo {
  id: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
}

export interface Pessoa {
  user_id: string;
  display_name: string;
}

/** Atendimento já com cliente, etiquetas e números de pedido/orçamento. */
export interface Atendimento extends AtendimentoRow {
  cliente: ClienteResumo | null;
  etiquetas: Etiqueta[];
  prioridade: boolean;
  pedido_numero: string | null;
  orcamento_numero: string | null;
  responsavel_nome: string | null;
}

export const BUCKET_ANEXOS = "atendimento-anexos";

export const nomeDoContato = (a: Pick<Atendimento, "cliente" | "contato_nome">) =>
  a.cliente?.nome || a.contato_nome || "Contato sem nome";

const emBlocos = <T,>(lista: T[], n = 200) => {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
  return out;
};

export function useCrm() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [linhas, setLinhas] = useState<AtendimentoRow[]>([]);
  const [clientes, setClientes] = useState<Record<string, ClienteResumo>>({});
  const [etiquetasPorCliente, setEtiquetasPorCliente] = useState<Record<string, string[]>>({});
  const [pedidos, setPedidos] = useState<Record<string, string>>({});
  const [orcamentos, setOrcamentos] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const primeira = useRef(true);

  const carregarConfig = useCallback(async () => {
    const [e, t, m, p] = await Promise.all([
      supabase.from("crm_etapas").select("*").order("sort_order").order("created_at"),
      supabase.from("crm_etiquetas").select("*").order("sort_order").order("nome"),
      supabase.from("crm_modelos_mensagem").select("*").order("sort_order").order("atalho"),
      supabase.from("profiles").select("user_id, display_name").eq("is_active", true).order("display_name"),
    ]);
    if (e.error) handleError(e.error, "carregar etapas");
    setEtapas(e.data ?? []);
    setEtiquetas(t.data ?? []);
    setModelos(m.data ?? []);
    setPessoas((p.data ?? []) as Pessoa[]);
  }, []);

  const carregarAtendimentos = useCallback(async () => {
    const { data, error } = await supabase
      .from("atendimentos")
      .select("*")
      .is("arquivado_em", null)
      .order("ultima_atividade_em", { ascending: false })
      .limit(1000);
    if (error) {
      handleError(error, "carregar atendimentos");
      return;
    }
    const rows = data ?? [];
    const idsClientes = [...new Set(rows.map((r) => r.client_id).filter((x): x is string => !!x))];
    const idsPedidos = [...new Set(rows.map((r) => r.sales_order_id).filter((x): x is string => !!x))];
    const idsOrc = [...new Set(rows.map((r) => r.quote_id).filter((x): x is string => !!x))];

    const cli: Record<string, ClienteResumo> = {};
    const etq: Record<string, string[]> = {};
    const ped: Record<string, string> = {};
    const orc: Record<string, string> = {};
    await Promise.all([
      ...emBlocos(idsClientes).map(async (ids) => {
        const [c, ce] = await Promise.all([
          supabase.from("clients").select("id, nome, empresa, telefone, email").in("id", ids),
          supabase.from("client_etiquetas").select("client_id, etiqueta_id").in("client_id", ids),
        ]);
        for (const x of c.data ?? []) cli[x.id] = x;
        for (const x of ce.data ?? []) (etq[x.client_id] ??= []).push(x.etiqueta_id);
      }),
      ...emBlocos(idsPedidos).map(async (ids) => {
        const { data: d } = await supabase.from("sales_orders").select("id, order_number").in("id", ids);
        for (const x of d ?? []) ped[x.id] = x.order_number;
      }),
      ...emBlocos(idsOrc).map(async (ids) => {
        const { data: d } = await supabase.from("quotes").select("id, quote_number").in("id", ids);
        for (const x of d ?? []) orc[x.id] = x.quote_number;
      }),
    ]);
    setLinhas(rows);
    setClientes(cli);
    setEtiquetasPorCliente(etq);
    setPedidos(ped);
    setOrcamentos(orc);
  }, []);

  const recarregar = useCallback(async () => {
    await Promise.all([carregarConfig(), carregarAtendimentos()]);
    if (primeira.current) {
      primeira.current = false;
      setCarregando(false);
    }
  }, [carregarConfig, carregarAtendimentos]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // Atualiza sozinho quando alguém da equipe mexe em um cartão
  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | null = null;
    const agendar = () => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(() => void carregarAtendimentos(), 400);
    };
    const ch = supabase
      .channel("crm_atendimentos")
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos" }, agendar)
      .subscribe();
    return () => {
      if (espera) clearTimeout(espera);
      void supabase.removeChannel(ch);
    };
  }, [carregarAtendimentos]);

  const atendimentos: Atendimento[] = useMemo(() => {
    const porId = new Map(etiquetas.map((e) => [e.id, e]));
    const nomes = new Map(pessoas.map((p) => [p.user_id, p.display_name]));
    return linhas.map((r) => {
      const ets = (r.client_id ? etiquetasPorCliente[r.client_id] ?? [] : [])
        .map((id) => porId.get(id))
        .filter((e): e is Etiqueta => !!e)
        .sort((a, b) => Number(b.prioridade) - Number(a.prioridade) || a.sort_order - b.sort_order);
      return {
        ...r,
        cliente: r.client_id ? clientes[r.client_id] ?? null : null,
        etiquetas: ets,
        prioridade: ets.some((e) => e.prioridade),
        pedido_numero: r.sales_order_id ? pedidos[r.sales_order_id] ?? null : null,
        orcamento_numero: r.quote_id ? orcamentos[r.quote_id] ?? null : null,
        responsavel_nome: r.responsavel_id ? nomes.get(r.responsavel_id) ?? null : null,
      };
    });
  }, [linhas, clientes, etiquetasPorCliente, etiquetas, pedidos, orcamentos, pessoas]);

  /** Muda o cartão na tela na hora (antes de o banco responder). */
  const aplicarLocal = useCallback((id: string, patch: Partial<AtendimentoRow>) => {
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  return {
    carregando,
    etapas,
    etapasAtivas: useMemo(() => etapas.filter((e) => !e.is_archived), [etapas]),
    etiquetas,
    modelos,
    modelosAtivos: useMemo(() => modelos.filter((m) => m.is_active), [modelos]),
    pessoas,
    atendimentos,
    recarregar,
    recarregarAtendimentos: carregarAtendimentos,
    aplicarLocal,
  };
}

export type Crm = ReturnType<typeof useCrm>;

// ───────────── Ações ─────────────

export async function atualizarAtendimento(id: string, patch: Tabelas["atendimentos"]["Update"]): Promise<boolean> {
  const { error } = await supabase.from("atendimentos").update(patch).eq("id", id);
  if (error) {
    handleError(error, "salvar atendimento");
    return false;
  }
  return true;
}

/** O que muda no cartão ao entrar numa etapa (encerramento tira da fila; retorno automático). */
export function patchAoMover(a: Pick<AtendimentoRow, "retorno_em">, etapa: Etapa, agora = new Date()): Tabelas["atendimentos"]["Update"] {
  const patch: Tabelas["atendimentos"]["Update"] = { etapa_id: etapa.id, ultima_atividade_em: agora.toISOString() };
  if (etapa.is_final) {
    patch.aguardando_desde = null;
    patch.retorno_em = null;
    patch.retorno_nota = null;
  } else if (etapa.retorno_auto_dias && !a.retorno_em) {
    patch.retorno_em = retornoAutomatico(etapa.retorno_auto_dias, agora);
    patch.retorno_nota = `Cobrar retorno (${etapa.nome})`;
  }
  return patch;
}

export interface NovaMensagem {
  atendimento_id: string;
  tipo: "nota" | "equipe" | "cliente" | "sistema";
  conteudo: string;
  anexo_path?: string | null;
  anexo_nome?: string | null;
}

/**
 * Grava a mensagem e ajusta a fila:
 * - "cliente" (ele escreveu): começa a contar a espera, se ainda não estava contando;
 * - "equipe" (nós respondemos): zera a espera.
 */
export async function registrarMensagem(m: NovaMensagem, aguardandoDesde: string | null): Promise<Tabelas["atendimentos"]["Update"] | null> {
  const { error } = await supabase.from("atendimento_mensagens").insert(m);
  if (error) {
    handleError(error, "registrar mensagem");
    return null;
  }
  const agora = new Date().toISOString();
  const patch: Tabelas["atendimentos"]["Update"] = { ultima_atividade_em: agora };
  if (m.tipo === "cliente" && !aguardandoDesde) patch.aguardando_desde = agora;
  if (m.tipo === "equipe") patch.aguardando_desde = null;
  if (m.tipo === "sistema") return patch;
  const ok = await atualizarAtendimento(m.atendimento_id, patch);
  return ok ? patch : null;
}

export async function criarAtendimento(dados: {
  client_id: string;
  titulo: string;
  etapa_id: string;
  canal: Canal;
  responsavel_id: string | null;
  aguardando: boolean;
  observacao?: string;
}): Promise<string | null> {
  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from("atendimentos")
    .insert({
      client_id: dados.client_id,
      titulo: dados.titulo.trim(),
      etapa_id: dados.etapa_id,
      canal: dados.canal,
      responsavel_id: dados.responsavel_id,
      aguardando_desde: dados.aguardando ? agora : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    handleError(error, "criar atendimento");
    return null;
  }
  if (dados.observacao?.trim()) {
    await supabase.from("atendimento_mensagens").insert({ atendimento_id: data.id, tipo: "nota", conteudo: dados.observacao.trim() });
  }
  return data.id;
}

/** Troca as etiquetas de um cliente pelas escolhidas. */
export async function salvarEtiquetasDoCliente(clientId: string, antes: string[], depois: string[]): Promise<boolean> {
  const tirar = antes.filter((id) => !depois.includes(id));
  const por = depois.filter((id) => !antes.includes(id));
  if (tirar.length) {
    const { error } = await supabase.from("client_etiquetas").delete().eq("client_id", clientId).in("etiqueta_id", tirar);
    if (error) {
      handleError(error, "remover etiqueta");
      return false;
    }
  }
  if (por.length) {
    const { error } = await supabase.from("client_etiquetas").insert(por.map((etiqueta_id) => ({ client_id: clientId, etiqueta_id })));
    if (error) {
      handleError(error, "aplicar etiqueta");
      return false;
    }
  }
  return true;
}
