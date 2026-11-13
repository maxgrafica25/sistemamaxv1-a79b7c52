// Pré-impressão → ferramenta "Crachás" (Fargo C50).
// Três caminhos, de acordo com o que a equipe tem em mãos:
//  1) Arte pronta (do cliente, do Canva ou do Corel): só encaixa no cartão e imprime.
//  2) Modelo com dados: abre o modelo da empresa e troca foto, nome, cargo e campos extras (uma ou várias pessoas).
//  3) Criar ou ajustar um modelo: arte de fundo, posições, campos extras, verso; salva com um nome.
// Tudo no navegador, sem custo.

import { useState } from "react";
import { FileImage, LayoutTemplate, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CrachaDadosTela } from "./CrachaDadosTela";
import { CrachaModeloTela } from "./CrachaModeloTela";
import { CrachaProntaTela } from "./CrachaProntaTela";
import { ativoDeModelo, lerModelos, novoModeloAtivo, type ModeloAtivo, type ModeloSalvo } from "./crachaModelos";

type Modo = "inicio" | "pronta" | "dados" | "modelo";

const OPCOES: { modo: Exclude<Modo, "inicio">; titulo: string; curto: string; descricao: string; exemplo: string; icon: typeof FileImage }[] = [
  {
    modo: "pronta",
    titulo: "Arte pronta",
    curto: "Arte pronta",
    descricao: "O cliente mandou a arte, ou você fez no Canva ou no Corel. O sistema só coloca no tamanho do cartão e imprime.",
    exemplo: "PDF, PNG ou JPG",
    icon: FileImage,
  },
  {
    modo: "dados",
    titulo: "Modelo com dados",
    curto: "Modelo com dados",
    descricao: "A empresa já tem um modelo salvo. Troque só a foto, o nome, o cargo e os outros dados, de uma pessoa ou de várias.",
    exemplo: "Foto, nome, cargo, tipo sanguíneo…",
    icon: Users,
  },
  {
    modo: "modelo",
    titulo: "Criar um modelo",
    curto: "Criar modelo",
    descricao: "Monte o visual do crachá de uma empresa nova: arte, posição da foto e dos textos, campos extras e verso. Salve e use depois.",
    exemplo: "Feito uma vez por empresa",
    icon: LayoutTemplate,
  },
];

export default function Crachas() {
  const [modo, setModo] = useState<Modo>("inicio");
  const [modelo, setModelo] = useState<ModeloAtivo>(novoModeloAtivo);
  const [modelos, setModelos] = useState<Record<string, ModeloSalvo>>(() => lerModelos());

  const atualizarModelo = (f: (m: ModeloAtivo) => ModeloAtivo) => setModelo((m) => f(m));

  /** Entra na tela de dados; sem modelo aberto, pega o último salvo. */
  const irParaDados = () => {
    const nomes = Object.keys(modelos).sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (modelo.nome === null && !modelo.arte && nomes.length === 1) setModelo(ativoDeModelo(nomes[0], modelos[nomes[0]]));
    setModo("dados");
  };

  if (modo === "inicio") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">O que você vai fazer?</h2>
          <p className="text-sm text-muted-foreground">Escolha a situação. Dá para trocar a qualquer momento.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {OPCOES.map((o) => (
            <button
              key={o.modo}
              type="button"
              onClick={() => (o.modo === "dados" ? irParaDados() : setModo(o.modo))}
              className="group flex flex-col gap-3 rounded-3xl border border-border/60 bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <o.icon className="h-6 w-6" />
              </span>
              <span className="text-base font-semibold tracking-tight">{o.titulo}</span>
              <span className="text-sm text-muted-foreground">{o.descricao}</span>
              <span className="mt-auto inline-block w-fit rounded-full bg-muted/70 px-2.5 py-0.5 text-xs text-muted-foreground">{o.exemplo}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Arte feita no Canva ou no Corel: exporte em PDF (ou PNG em alta qualidade) e use “Arte pronta”. Se a empresa vai trocar nomes e fotos, use a arte como fundo em “Criar um modelo”.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="O que fazer" className="flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-muted/70 p-1">
        {OPCOES.map((o) => (
          <button
            key={o.modo}
            type="button"
            role="tab"
            aria-selected={modo === o.modo}
            onClick={() => (o.modo === "dados" ? irParaDados() : setModo(o.modo))}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              modo === o.modo ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="h-4 w-4" />
            {o.curto}
          </button>
        ))}
      </div>
      {modo === "pronta" && <CrachaProntaTela />}
      {modo === "dados" && (
        <CrachaDadosTela
          modelo={modelo}
          onModelo={atualizarModelo}
          modelos={modelos}
          onEscolher={(n) => setModelo(ativoDeModelo(n, modelos[n]))}
          onAjustarModelo={() => setModo("modelo")}
          onCriarModelo={() => {
            setModelo(novoModeloAtivo());
            setModo("modelo");
          }}
        />
      )}
      {modo === "modelo" && <CrachaModeloTela modelo={modelo} onModelo={atualizarModelo} modelos={modelos} onModelos={setModelos} onUsar={() => setModo("dados")} />}
    </div>
  );
}
