

# Corrigir crash do `NovoSiteDialog` com nova estratégia

A edge function agora retorna `strategy: "function-atualcard"`, mas o map `strategyBadge` em `NovoSiteDialog.tsx` só conhece `api`, `html` e `html-regex`. Acessar `.cls` em `undefined` quebra o componente.

## Mudança em `src/components/monitoramento/NovoSiteDialog.tsx`

1. Adicionar `"function-atualcard"` ao tipo `WorkerResult.strategy`.
2. Adicionar entrada correspondente em `strategyBadge` (badge roxo/violeta com label `function`).
3. Fallback defensivo: se a strategy vier desconhecida, usar um badge neutro em vez de quebrar.

```ts
const strategyBadge = (s: WorkerResult["strategy"]) => {
  const map = {
    api: { label: "api", cls: "bg-emerald-100 ..." },
    html: { label: "html", cls: "bg-blue-100 ..." },
    "html-regex": { label: "html-regex", cls: "bg-amber-100 ..." },
    "function-atualcard": { label: "function", cls: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800" },
  };
  return map[s] ?? { label: String(s), cls: "bg-muted text-muted-foreground border-border" };
};
```

## Resultado

- Dialog volta a renderizar quando a Atual Card é testada.
- Badge "function" aparece roxo para diferenciar da estratégia HTML padrão.
- Qualquer estratégia futura desconhecida não derruba mais a UI.

