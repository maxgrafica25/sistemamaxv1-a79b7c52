## Adicionar descrição discreta abaixo das tabs

Atualmente, após remover o `ActiveTabBanner`, ficou só a linha de tabs — sem nenhum contexto sobre o que é cada categoria. Reintroduzir o texto descritivo da tab ativa, mas de forma **muito mais leve** que o banner anterior (sem card cinza, sem ícone grande, sem título redundante).

### Mudança

Em `src/components/orcamentos-v3/NewQuoteFormV3.tsx`:

- Reimportar `getTab` de `./workspace/TabsLayout`.
- Logo após `<TabsLayout />`, renderizar apenas um parágrafo pequeno:

```tsx
<p className="mt-2 text-xs text-muted-foreground">
  {getTab(active).description}
</p>
```

Resultado: a descrição da tab ativa (ex: "Itens impressos no parque próprio (folhetos, apostilas, etiquetas).") aparece como uma linha sutil de subtítulo, sem repetir o nome da categoria nem criar um bloco visual pesado.

### Fora de escopo

- Sub-formulários e campo "Descrição (opcional)" dos itens.
- Estilo das tabs.

### Validação

Em `/orcamentos-v3/novo`, ao alternar entre Impressão / Com. Visual / Terceirizados, uma linha de texto cinza-claro muda abaixo das tabs, sem reintroduzir o card destacado.