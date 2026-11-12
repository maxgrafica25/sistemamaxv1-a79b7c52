// Configuração do "Miolo de agenda" (o que fica salvo no navegador) e modelos salvos por cliente.

import { type Feriado } from "@/lib/preimpressao/agenda";

/** Logo guardada no navegador como data URL (já reduzida). */
export interface ImagemSalva {
  dataUrl: string;
  w: number;
  h: number;
  tipo: "png" | "jpg";
}

export type Saida = "a5" | "a4";
export type ModoAgenda = "miolo" | "capa";

export interface ConfigAgendaUI {
  ano: number;
  capa: string;
  regionais: Feriado[];
  total: string;
  saida: Saida;
  modelo: "diario" | "semanal";
  estiloDia: "horas" | "linhas";
  horaInicio: number;
  horaFim: number;
  semanaComeca: "dom" | "seg";
  luas: boolean;
  destaque: boolean;
  logo: ImagemSalva | null;
  rodape: string;
  logoNaCapa: boolean;
  logoNoVerso: boolean;
  rodapeEmTodas: boolean;
  marcaAtiva: boolean;
  marcaTipo: "logo" | "texto";
  marcaTexto: string;
  /** Opacidade em % (2 a 30). */
  marcaOpacidade: number;
  /** Largura em % da página. */
  marcaEscala: number;
  marcaOnde: "todas" | "dias";
  /** Usa só o desenho da logo, em preto, na marca-d'água. */
  marcaSilhueta: boolean;
  capaCor: string;
  capaLinha1: string;
  capaLinha2: string;
  capaContato: string;
  capaUsarLogo: boolean;
}

/** Ano da próxima agenda: a partir de setembro já se prepara o ano seguinte. */
export function anoPadrao() {
  const h = new Date();
  return h.getFullYear() + (h.getMonth() >= 8 ? 1 : 0);
}

export function configPadrao(): ConfigAgendaUI {
  return {
    ano: anoPadrao(),
    capa: "AGENDA",
    regionais: [],
    total: "",
    saida: "a5",
    modelo: "diario",
    estiloDia: "horas",
    horaInicio: 8,
    horaFim: 18,
    semanaComeca: "dom",
    luas: true,
    destaque: false,
    logo: null,
    rodape: "",
    logoNaCapa: true,
    logoNoVerso: true,
    rodapeEmTodas: true,
    marcaAtiva: false,
    marcaTipo: "logo",
    marcaTexto: "",
    marcaOpacidade: 8,
    marcaEscala: 60,
    marcaOnde: "todas",
    marcaSilhueta: true,
    capaCor: "#1f1f1f",
    capaLinha1: "",
    capaLinha2: "",
    capaContato: "",
    capaUsarLogo: true,
  };
}

// ─── Modelos salvos por cliente ──────────────────────────────────────

const CHAVE_MODELOS = "preimpressao.agenda.modelos.v1";

/** O que um modelo guarda: tudo, menos o ano (muda a cada vez) e o formato de saída. */
export type ModeloAgenda = Omit<ConfigAgendaUI, "ano" | "saida">;

export function paraModelo(c: ConfigAgendaUI): ModeloAgenda {
  const { ano: _ano, saida: _saida, ...resto } = c;
  void _ano;
  void _saida;
  return resto;
}

export function lerModelos(): Record<string, ModeloAgenda> {
  try {
    const raw = window.localStorage.getItem(CHAVE_MODELOS);
    return raw ? (JSON.parse(raw) as Record<string, ModeloAgenda>) : {};
  } catch {
    return {};
  }
}

export function gravarModelos(m: Record<string, ModeloAgenda>): boolean {
  try {
    window.localStorage.setItem(CHAVE_MODELOS, JSON.stringify(m));
    return true;
  } catch {
    return false; // sem espaço no navegador (logo muito grande?)
  }
}

/** Aplica um modelo sobre a configuração atual (mantém o ano e a saída), completando o que faltar com o padrão. */
export function aplicarModelo(atual: ConfigAgendaUI, m: Partial<ModeloAgenda>): ConfigAgendaUI {
  return { ...configPadrao(), ...m, ano: atual.ano, saida: atual.saida };
}

/** Valida um modelo vindo de arquivo: só campos conhecidos, com o tipo certo. */
export function modeloDeArquivo(json: unknown): Partial<ModeloAgenda> | null {
  if (!json || typeof json !== "object") return null;
  const padrao = configPadrao() as unknown as Record<string, unknown>;
  const origem = json as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(padrao)) {
    if (k === "ano" || k === "saida") continue;
    const v = origem[k];
    if (v === undefined) continue;
    if (k === "logo") {
      const l = v as ImagemSalva | null;
      if (l === null || (typeof l === "object" && typeof l.dataUrl === "string" && l.dataUrl.startsWith("data:image/") && typeof l.w === "number" && typeof l.h === "number")) out[k] = l;
    } else if (k === "regionais") {
      if (Array.isArray(v)) out[k] = v.filter((f) => f && typeof f.dia === "number" && typeof f.mes === "number" && typeof f.nome === "string").slice(0, 12);
    } else if (typeof v === typeof padrao[k]) out[k] = v;
  }
  return Object.keys(out).length ? (out as Partial<ModeloAgenda>) : null;
}
