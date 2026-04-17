

## Problema observado

Pelo print: produto detectado é "Flyer couche 80g 4x0 sem verniz 14x10 cm". Já existe da ANS algo como "Panfleto ... 10x14". Dimensões são equivalentes (14x10 ≈ 10x14), mas a sugestão **não apareceu**.

## Investigação necessária

Preciso confirmar 2 hipóteses antes de propor a solução:

1. **Regex de `extractDimKey`** está casando "14x10 cm" com espaço entre número e "cm"? O regex atual é `/(\d{1,3})\s*x\s*(\d{1,3})/` — deve casar. Mas pode ter sido excluído pelo filtro de "nome igual" (caso o nome do catálogo tenha sido salvo idêntico).
2. **Produtos no catálogo** têm dimensão extraível? Se a ANS foi salva como "Panfleto a jato 10x14" sem "cm", ainda casa. Mas se foi salva sem dimensão no nome canônico (ex: só "Panfleto ANS"), o `extractDimKey` retorna null e ela some das sugestões.

Vou checar o banco para ter certeza do que está salvo.

## Proposta de solução (2 partes)

### Parte 1: Corrigir o matcher (causa raiz)

O problema mais provável é que o componente `SugestoesCatalogoInline` só dispara quando o nome **muda via digitação** — mas o nome é preenchido programaticamente via `setNomeProduto(...)` após o `detect-price-tiers`. O `useEffect` deve disparar igual (depende de `nome`), então isso deveria funcionar.

Outra hipótese mais provável: **o componente está sendo renderizado, mas o filtro `normCurrent === p.nome_canonico` está excluindo o match** quando os nomes são parecidos demais após normalização. Vou revisar a lógica de exclusão.

Também vou adicionar **logs de debug temporários** no console para o usuário confirmar se a busca está sendo executada e o que está retornando.

### Parte 2: Confirmação ao salvar (ideia do usuário)

Adicionar um diálogo de confirmação **ao clicar em "Salvar"** quando:
- Existem produtos no catálogo com **dimensões equivalentes** (±1cm) E
- O nome digitado **não é idêntico** a nenhum deles

O diálogo mostra:

```text
┌─ Padronizar nome do produto? ────────────────┐
│ Você está salvando: "Flyer couche 80g 14x10" │
│                                              │
│ Existe(m) produto(s) similar(es) (10x14cm):  │
│   ○ Panfleto a jato 10x14 (ANS) [Usar]      │
│                                              │
│ ○ Manter o nome que digitei                  │
│                                              │
│        [Cancelar]   [Salvar]                 │
└──────────────────────────────────────────────┘
```

Isso garante que mesmo se o usuário ignorar a sugestão inline, o sistema dá uma segunda chance antes de criar duplicata.

## Arquivos afetados

- **Investigação**: query SQL em `produtos_catalogo` e `sites_monitorados` para entender o estado atual
- `src/lib/produtoCatalogo.ts`: revisar filtro de exclusão em `findCatalogoSimilarByDim`
- `src/components/monitoramento/SugestoesCatalogoInline.tsx`: adicionar log de debug temporário
- **Novo** `src/components/monitoramento/ConfirmarNomeDialog.tsx`: diálogo de confirmação ao salvar
- `src/components/monitoramento/NovoSiteDialog.tsx`: integrar diálogo nas funções `handleSaveTiers` e `handleSaveAuto`

## Limitação honesta

Sem ver os dados reais não consigo afirmar 100% qual hipótese da Parte 1 é a verdadeira. O diálogo de confirmação (Parte 2) funciona como **rede de segurança** independente — se a sugestão inline falhar por qualquer motivo, o salvamento ainda pergunta.

