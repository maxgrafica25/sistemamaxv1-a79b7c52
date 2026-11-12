// Identidade do cliente no miolo/capa da agenda: logo, linha de contato e marca-d'água.

import { X } from "lucide-react";
import { Campo, Chave, Mini, Passo, Segmentado, SoltarArquivo } from "./ui";
import type { ConfigAgendaUI } from "./agendaConfig";

type Set = <K extends keyof ConfigAgendaUI>(k: K, v: ConfigAgendaUI[K]) => void;

export function AgendaLogo({ config, set, onArquivos, carregando, erro }: { config: ConfigAgendaUI; set: Set; onArquivos: (f: File[]) => void; carregando: boolean; erro: string | null }) {
  return (
    <Campo titulo="Logo do cliente" ajuda="PNG ou JPG. Com fundo transparente fica melhor. Fica só neste computador.">
      {config.logo && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-muted/40 p-3">
          <img src={config.logo.dataUrl} alt="Logo" className="h-12 max-w-[7rem] rounded-md bg-white object-contain p-1 shadow-sm ring-1 ring-border/60" />
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            {config.logo.w} × {config.logo.h} px
          </p>
          <button
            type="button"
            aria-label="Remover logo"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => set("logo", null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <SoltarArquivo
        titulo={config.logo ? "Trocar a logo" : "Solte a logo (PNG ou JPG)"}
        dica="Usada na capa, no verso da capa, no rodapé e, se quiser, na marca-d'água."
        aceita=".png,.jpg,.jpeg,image/png,image/jpeg"
        carregando={carregando}
        erro={erro}
        onArquivos={onArquivos}
      />
    </Campo>
  );
}

export function AgendaIdentidade({ config, set }: { config: ConfigAgendaUI; set: Set }) {
  return (
    <div className="space-y-6">
      <Campo titulo="Contato do cliente" ajuda="Uma linha com nome, telefone, Instagram… Aparece no rodapé e no verso da capa.">
        <Mini rotulo="Linha de contato (opcional)" valor={config.rodape} onChange={(v) => set("rodape", v.slice(0, 80))} texto ajuda="Ex.: Max Gráfica · (51) 99999-9999 · @maxgrafica" />
      </Campo>
      <div className="space-y-2">
        <Chave ligado={config.logoNaCapa} onChange={(v) => set("logoNaCapa", v)}>
          <span className="font-medium">Logo na capa do miolo</span>
        </Chave>
        <Chave ligado={config.logoNoVerso} onChange={(v) => set("logoNoVerso", v)}>
          <span className="font-medium">Logo e contato no verso da capa</span>
        </Chave>
        <Chave ligado={config.rodapeEmTodas} onChange={(v) => set("rodapeEmTodas", v)}>
          <span className="font-medium">Logo e contato no rodapé das páginas</span>
        </Chave>
      </div>
    </div>
  );
}

export function AgendaMarcaDagua({ config, set }: { config: ConfigAgendaUI; set: Set }) {
  return (
    <div className="space-y-4">
      <Chave ligado={config.marcaAtiva} onChange={(v) => set("marcaAtiva", v)}>
        <span className="font-medium">Marca-d&apos;água</span>
        <span className="block text-xs text-muted-foreground">Logo ou texto bem clarinho no meio das páginas.</span>
      </Chave>
      {config.marcaAtiva && (
        <div className="space-y-4 pl-1">
          <Segmentado
            valor={config.marcaTipo}
            opcoes={[
              { valor: "logo" as const, rotulo: "Logo" },
              { valor: "texto" as const, rotulo: "Texto" },
            ]}
            onChange={(v) => set("marcaTipo", v)}
          />
          {config.marcaTipo === "logo" ? (
            !config.logo ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">Envie a logo acima para usar como marca-d&apos;água.</p>
            ) : (
              <Chave ligado={config.marcaSilhueta} onChange={(v) => set("marcaSilhueta", v)}>
                <span className="font-medium">Só o desenho, em preto</span>
                <span className="block text-xs text-muted-foreground">Tira o fundo colorido da logo e usa só as letras e o símbolo.</span>
              </Chave>
            )
          ) : (
            <Mini rotulo="Texto da marca-d'água" valor={config.marcaTexto} onChange={(v) => set("marcaTexto", v.slice(0, 24))} texto ajuda="Ex.: NOME DA EMPRESA" />
          )}
          <Campo titulo="Quanto aparece" ajuda="Quanto menor, mais clarinha. Em impressão preto e branco use de 4% a 10%.">
            <Passo valor={String(config.marcaOpacidade)} onChange={(v) => set("marcaOpacidade", Math.min(30, Math.max(2, Number.parseInt(v, 10) || config.marcaOpacidade)))} passo={1} min={2} max={30} sufixo="%" rotulo="opacidade" />
          </Campo>
          <Campo titulo="Tamanho">
            <Passo valor={String(config.marcaEscala)} onChange={(v) => set("marcaEscala", Math.min(100, Math.max(20, Number.parseInt(v, 10) || config.marcaEscala)))} passo={5} min={20} max={100} sufixo="% da largura" rotulo="tamanho da marca" largura="w-14" />
          </Campo>
          <Segmentado
            valor={config.marcaOnde}
            opcoes={[
              { valor: "todas" as const, rotulo: "Todas as páginas" },
              { valor: "dias" as const, rotulo: "Dias e anotações" },
            ]}
            onChange={(v) => set("marcaOnde", v)}
          />
        </div>
      )}
    </div>
  );
}
