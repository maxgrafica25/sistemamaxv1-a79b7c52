// Peças pequenas usadas em todo o CRM de atendimento.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Star, Tag, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  atalhoDigitado,
  buscarModelos,
  corDoTexto,
  formatarEspera,
  minutosDeEspera,
  nivelDeEspera,
  preencherModelo,
  type DadosModelo,
} from "@/lib/crm/fila";
import type { Etiqueta, Modelo } from "@/lib/crm/dados";

export function EtiquetaChip({ etiqueta, className }: { etiqueta: Pick<Etiqueta, "nome" | "cor" | "prioridade">; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4", className)}
      style={{ backgroundColor: etiqueta.cor, color: corDoTexto(etiqueta.cor) }}
    >
      {etiqueta.prioridade && <Star className="h-2.5 w-2.5 fill-current" />}
      {etiqueta.nome}
    </span>
  );
}

const CORES_ESPERA = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  atencao: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  atrasado: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
} as const;

/** "esperando há 35 min", verde → amarelo → vermelho. */
export function RelogioEspera({ desde, agora, curto }: { desde: string | null; agora: Date; curto?: boolean }) {
  const min = minutosDeEspera(desde, agora);
  if (min === null) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", CORES_ESPERA[nivelDeEspera(min)])}
      title="Tempo desde a primeira mensagem do cliente ainda sem resposta"
    >
      <Clock className="h-3 w-3" />
      {curto ? formatarEspera(min) : `esperando ${min < 1 ? "agora" : `há ${formatarEspera(min)}`}`}
    </span>
  );
}

/** Lista de etiquetas com marcação (usada no cartão do cliente e no cadastro). */
export function SeletorEtiquetas({
  etiquetas,
  selecionadas,
  onChange,
  children,
}: {
  etiquetas: Etiqueta[];
  selecionadas: string[];
  onChange: (ids: string[]) => void;
  children?: React.ReactNode;
}) {
  const alternar = (id: string) =>
    onChange(selecionadas.includes(id) ? selecionadas.filter((x) => x !== id) : [...selecionadas, id]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children ?? (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <Tag className="h-3 w-3" /> Etiquetas
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1.5">
        {etiquetas.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">Nenhuma etiqueta criada. O administrador cria em “Configurar”.</p>
        )}
        {etiquetas.map((e) => {
          const on = selecionadas.includes(e.id);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => alternar(e.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                {on && <Check className="h-3 w-3" />}
              </span>
              <EtiquetaChip etiqueta={e} />
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Caixa de texto com atalhos, como no WhatsApp Business: digite "/" e escolha a mensagem pronta;
 * nome do cliente, número do pedido etc. entram sozinhos.
 */
export function CampoMensagem({
  valor,
  onChange,
  modelos,
  dados,
  placeholder,
  linhas = 3,
  autoFocus,
}: {
  valor: string;
  onChange: (v: string) => void;
  modelos: Modelo[];
  dados: DadosModelo;
  placeholder?: string;
  linhas?: number;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [indice, setIndice] = useState(0);
  const [listaAberta, setListaAberta] = useState(false);
  const busca = atalhoDigitado(valor);
  const sugestoes = useMemo(() => (busca === null ? [] : buscarModelos(modelos, busca).slice(0, 8)), [busca, modelos]);

  useEffect(() => setIndice(0), [busca]);

  const usar = (m: Modelo) => {
    const r = preencherModelo(m.texto, dados);
    onChange(r.texto);
    setListaAberta(false);
    if (r.faltando.length) {
      toast.warning(`Complete antes de enviar: ${r.faltando.join(", ")}`, {
        description: "Este atendimento não tem esse dado (ligue o pedido/orçamento ao cartão ou digite na mensagem).",
      });
    }
    requestAnimationFrame(() => ref.current?.focus());
  };

  const aoTeclar = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!sugestoes.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => (i + 1) % sugestoes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => (i - 1 + sugestoes.length) % sugestoes.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      usar(sugestoes[indice]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onChange("");
    }
  };

  const Item = ({ m, ativo, onClick }: { m: Modelo; ativo?: boolean; onClick: () => void }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted", ativo && "bg-muted")}
    >
      <span className="flex items-center gap-2 text-sm">
        <code className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">/{m.atalho}</code>
        <span className="font-medium">{m.titulo}</span>
      </span>
      <span className="line-clamp-2 text-xs text-muted-foreground">{preencherModelo(m.texto, dados).texto}</span>
    </button>
  );

  return (
    <div className="relative">
      {sugestoes.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
          {sugestoes.map((m, i) => (
            <Item key={m.id} m={m} ativo={i === indice} onClick={() => usar(m)} />
          ))}
          <p className="px-2 pt-1 text-[10px] text-muted-foreground">↑ ↓ para escolher · Enter para usar · Esc para fechar</p>
        </div>
      )}
      {busca !== null && sugestoes.length === 0 && modelos.length > 0 && (
        <div className="absolute bottom-full left-0 z-20 mb-1 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
          Nenhum atalho com “/{busca}”
        </div>
      )}
      <Textarea
        ref={ref}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={aoTeclar}
        rows={linhas}
        autoFocus={autoFocus}
        placeholder={placeholder ?? "Escreva aqui… (digite / para usar uma mensagem pronta)"}
        className="resize-none pr-10"
      />
      <Popover open={listaAberta} onOpenChange={setListaAberta}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7 text-primary" title="Mensagens prontas (atalhos)">
            <Zap className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-h-80 w-80 overflow-y-auto p-1">
          {modelos.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">Nenhuma mensagem pronta. O administrador cria em “Configurar → Atalhos”.</p>
          ) : (
            modelos.map((m) => <Item key={m.id} m={m} onClick={() => usar(m)} />)
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
