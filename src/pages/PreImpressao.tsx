// Central de Pré-impressão: ferramentas para preparar arquivos antes de imprimir.
// Sem ?tab mostra a tela inicial: busca, as últimas ferramentas usadas e os grupos com todas as
// ferramentas em cartões; com ?tab=<key> abre a ferramenta. O cadastro fica em
// src/components/preimpressao/ferramentas.ts (ver lá como acrescentar uma nova).

import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, Lock, Printer, Search, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import PageLoader from "@/components/PageLoader";
import { FERRAMENTAS, GRUPOS, buscarFerramentas, lerRecentes, marcarRecente, type Ferramenta } from "@/components/preimpressao/ferramentas";

function Cartao({ f }: { f: Ferramenta }) {
  return (
    <Link
      to={`/pre-impressao?tab=${f.key}`}
      className="group flex gap-4 rounded-3xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
  );
}

function Inicio() {
  const [busca, setBusca] = useState("");
  const recentes = useMemo(() => lerRecentes(3), []);
  const achadas = useMemo(() => buscarFerramentas(busca), [busca]);
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
              <Cartao key={f.key} f={f} />
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">Nenhuma ferramenta com “{busca.trim()}”. Tente outra palavra, como “foto”, “cartão” ou “PDF”.</p>
        )
      ) : (
        <div className="space-y-8">
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
                  <Cartao key={f.key} f={f} />
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

  useEffect(() => {
    if (atual) marcarRecente(atual.key);
  }, [atual]);

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
        </h1>
        <p className="basis-full text-sm text-muted-foreground lg:basis-auto">{atual.descricao}</p>
      </div>
      <Suspense fallback={<PageLoader />}>
        <Componente key={atual.key} />
      </Suspense>
    </PageContainer>
  );
}
