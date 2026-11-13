// Central de Pré-impressão: ferramentas para preparar arquivos antes de imprimir.
// Sem ?tab mostra a tela inicial: busca, as últimas ferramentas usadas e os grupos com todas as
// ferramentas em cartões; com ?tab=<key> abre a ferramenta. O cadastro fica em
// src/components/preimpressao/ferramentas.ts (ver lá como acrescentar uma nova).

import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, Lock, Printer, Search, Star, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import PageLoader from "@/components/PageLoader";
import { FERRAMENTAS, GRUPOS, buscarFerramentas, favoritasPrimeiro, ferramentasFavoritas, lerRecentes, marcarRecente, type Ferramenta } from "@/components/preimpressao/ferramentas";
import { useFavoritos } from "@/components/preimpressao/useFavoritos";
import { cn } from "@/lib/utils";

/** Estrela de favorita (no canto do cartão e no cabeçalho da ferramenta). */
function Estrela({ ligada, nome, onClick, className }: { ligada: boolean; nome: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={ligada}
      aria-label={ligada ? `Tirar ${nome} dos favoritos` : `Favoritar ${nome}`}
      title={ligada ? "Tirar dos favoritos" : "Favoritar: fica no topo da lista"}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        ligada ? "text-amber-500 hover:bg-amber-50" : "text-muted-foreground/60 hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Star className={cn("h-5 w-5 transition-transform", ligada && "fill-current")} />
    </button>
  );
}

function Cartao({ f, favorita, onFavoritar, compacto }: { f: Ferramenta; favorita: boolean; onFavoritar: () => void; compacto?: boolean }) {
  if (compacto) {
    // Favoritas: só o ícone e o nome, para o topo da página ficar curto
    return (
      <div className="group relative">
        <Link
          to={`/pre-impressao?tab=${f.key}`}
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 pr-12 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <f.icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight">{f.nome}</span>
            <span className="block truncate text-xs text-muted-foreground">{f.entrada}</span>
          </span>
        </Link>
        <Estrela ligada={favorita} nome={f.nome} onClick={onFavoritar} className="absolute right-1.5 top-1/2 -translate-y-1/2" />
      </div>
    );
  }
  return (
    <div className="group relative">
      <Link
        to={`/pre-impressao?tab=${f.key}`}
        className="flex gap-4 rounded-3xl border border-border/60 bg-card p-5 pr-14 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <f.icon className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-base font-semibold tracking-tight">{f.nome}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">{f.descricao}</span>
          <span className="mt-3 inline-block rounded-full bg-muted/70 px-2.5 py-0.5 text-xs text-muted-foreground">{f.entrada}</span>
        </span>
      </Link>
      <Estrela ligada={favorita} nome={f.nome} onClick={onFavoritar} className="absolute right-3 top-3" />
    </div>
  );
}

function Inicio() {
  const [busca, setBusca] = useState("");
  const { favoritos, ehFavorita, alternar, usuario } = useFavoritos();
  const recentes = useMemo(() => lerRecentes(3, usuario), [usuario]);
  const achadas = useMemo(() => favoritasPrimeiro(buscarFerramentas(busca), favoritos), [busca, favoritos]);
  const favoritas = useMemo(() => ferramentasFavoritas(favoritos), [favoritos]);
  const buscando = busca.trim().length > 0;

  return (
    <PageContainer>
      <PageHeader icon={Printer} title="Pré-impressão" description="Escolha o que você precisa fazer com o arquivo." />
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar ferramenta (ex.: foto 3x4, crachá, agenda, banner)"
          aria-label="Buscar ferramenta"
          className="h-12 w-full rounded-full bg-muted/70 pl-11 pr-11 text-sm outline-none ring-1 ring-transparent transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        {buscando && (
          <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")} className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {buscando ? (
        achadas.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {achadas.map((f) => (
              <Cartao key={f.key} f={f} favorita={ehFavorita(f.key)} onFavoritar={() => alternar(f.key)} />
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">Nenhuma ferramenta com “{busca.trim()}”. Tente outra palavra, como “foto”, “cartão” ou “PDF”.</p>
        )
      ) : (
        <div className="space-y-8">
          <section className="space-y-3" aria-label="Favoritas">
            <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> Favoritas
            </h2>
            {favoritas.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {favoritas.map((f) => (
                  <Cartao key={f.key} f={f} favorita compacto onFavoritar={() => alternar(f.key)} />
                ))}
              </div>
            ) : (
              <p className="rounded-3xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">Toque na ★ de uma ferramenta para ela ficar aqui no topo, só para você.</p>
            )}
          </section>
          {recentes.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Usadas por último
              </h2>
              <div className="flex flex-wrap gap-2">
                {recentes.map((f) => (
                  <Link key={f.key} to={`/pre-impressao?tab=${f.key}`} className="flex items-center gap-2 rounded-full bg-muted/70 px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                    <f.icon className="h-4 w-4 text-primary" />
                    {f.nome}
                  </Link>
                ))}
              </div>
            </section>
          )}
          {GRUPOS.map((g) => (
            <section key={g.titulo} className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.titulo}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {g.ferramentas.map((f) => (
                  <Cartao key={f.key} f={f} favorita={ehFavorita(f.key)} onFavoritar={() => alternar(f.key)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" /> Tudo roda no seu navegador: os arquivos não são enviados para lugar nenhum.
      </p>
    </PageContainer>
  );
}

export default function PreImpressao() {
  const [params] = useSearchParams();
  const atual = FERRAMENTAS.find((f) => f.key === params.get("tab"));
  const { ehFavorita, alternar, usuario } = useFavoritos();

  useEffect(() => {
    if (atual) marcarRecente(atual.key, usuario);
  }, [atual, usuario]);

  if (!atual) return <Inicio />;

  const { Componente } = atual;
  return (
    <PageContainer>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          to="/pre-impressao"
          className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Pré-impressão
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <atual.icon className="h-5 w-5 shrink-0 text-primary" />
          {atual.nome}
          <Estrela ligada={ehFavorita(atual.key)} nome={atual.nome} onClick={() => alternar(atual.key)} className="-ml-1 h-8 w-8" />
        </h1>
        <p className="basis-full text-sm text-muted-foreground lg:basis-auto">{atual.descricao}</p>
      </div>
      <Suspense fallback={<PageLoader />}>
        <Componente key={atual.key} />
      </Suspense>
    </PageContainer>
  );
}
