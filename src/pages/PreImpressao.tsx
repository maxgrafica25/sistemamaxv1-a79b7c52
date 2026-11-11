// Central de Pré-impressão: ferramentas para preparar arquivos antes de imprimir.
// Sem ?tab mostra a tela inicial com todas as ferramentas em cartões; com
// ?tab=<key> abre a ferramenta. O cadastro fica em
// src/components/preimpressao/ferramentas.ts (ver lá como acrescentar uma nova).

import { Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock, Printer } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";
import PageLoader from "@/components/PageLoader";
import { FERRAMENTAS, GRUPOS } from "@/components/preimpressao/ferramentas";

export default function PreImpressao() {
  const [params] = useSearchParams();
  const atual = FERRAMENTAS.find((f) => f.key === params.get("tab"));

  if (!atual) {
    return (
      <PageContainer>
        <PageHeader icon={Printer} title="Pré-impressão" description="Escolha o que você precisa fazer com o arquivo." />
        <div className="space-y-8">
          {GRUPOS.map((g) => (
            <section key={g.titulo} className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.titulo}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {g.ferramentas.map((f) => (
                  <Link
                    key={f.key}
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
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Tudo roda no seu navegador: os arquivos não são enviados para lugar nenhum.
        </p>
      </PageContainer>
    );
  }

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
