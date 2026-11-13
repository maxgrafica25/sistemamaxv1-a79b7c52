// Crachás: o "modelo" (visual + posições + campos extras) e os modelos salvos por cliente.

import { configCrachaPadrao, type ConfigCracha } from "@/lib/preimpressao/cracha";
import { arteParaModelo, fundoDeModelo, type ArteLida } from "@/lib/preimpressao/crachaNavegador";

export interface ConfigModelo extends ConfigCracha {
  extras: NonNullable<ConfigCracha["extras"]>;
  girarVerso: boolean;
  corVerso: string;
  mostrarFuro: boolean;
}

export const MODELO_PADRAO: ConfigModelo = { ...configCrachaPadrao("pe"), extras: [], girarVerso: false, corVerso: "#ffffff", mostrarFuro: true };

export interface ArteGuardada {
  dataUrl: string;
  tipo: "png" | "jpg";
  w: number;
  h: number;
}

export interface ModeloSalvo {
  cfg: ConfigModelo;
  fundo: ArteGuardada | null;
  verso: ArteGuardada | null;
}

/** O modelo que está sendo usado ou editado agora (as artes ficam na memória). */
export interface ModeloAtivo {
  /** Nome com que foi salvo (null = ainda sem nome). */
  nome: string | null;
  cfg: ConfigModelo;
  arte: ArteLida | null;
  arteVerso: ArteLida | null;
}

export const novoModeloAtivo = (): ModeloAtivo => ({ nome: null, cfg: MODELO_PADRAO, arte: null, arteVerso: null });

const CHAVE = "preimpressao.cracha.modelos.v1";

export function lerModelos(): Record<string, ModeloSalvo> {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE) ?? "{}") as Record<string, ModeloSalvo>;
  } catch {
    return {};
  }
}

export function gravarModelos(m: Record<string, ModeloSalvo>): boolean {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(m));
    return true;
  } catch {
    return false;
  }
}

const comoArte = (a: ArteGuardada | null, nome: string): ArteLida | null => (a ? { nome, fundo: fundoDeModelo(a), aspecto: a.w / a.h, px: { w: a.w, h: a.h } } : null);

/** Abre um modelo salvo (completa com os padrões o que os modelos antigos não tinham). */
export function ativoDeModelo(nome: string, m: ModeloSalvo): ModeloAtivo {
  const cfg: ConfigModelo = { ...MODELO_PADRAO, ...m.cfg, extras: m.cfg.extras ?? [] };
  return { nome, cfg, arte: comoArte(m.fundo, "arte do modelo"), arteVerso: comoArte(m.verso, "verso do modelo") };
}

/** Guarda o modelo com um nome (a arte em PDF vira imagem de alta qualidade). */
export async function guardarModelo(nome: string, a: ModeloAtivo, todos: Record<string, ModeloSalvo>): Promise<{ ok: boolean; modelos: Record<string, ModeloSalvo> }> {
  const m: ModeloSalvo = { cfg: a.cfg, fundo: a.arte ? await arteParaModelo(a.arte.fundo) : null, verso: a.arteVerso ? await arteParaModelo(a.arteVerso.fundo) : null };
  const novo = { ...todos, [nome]: m };
  return { ok: gravarModelos(novo), modelos: novo };
}

/** Um resumo curto do modelo para mostrar em chips. */
export function resumoDoModelo(a: ModeloAtivo): string {
  const campos = ["nome", "cargo", "setor", "matricula"].filter((k) => a.cfg.elementos[k as "nome"].ativo).length + a.cfg.extras.filter((x) => x.layout.ativo).length + (a.cfg.elementos.foto.ativo ? 1 : 0);
  return `${a.cfg.orientacao === "pe" ? "Em pé" : "Deitado"} · ${campos} campos${a.arte ? " · com arte" : ""}`;
}
