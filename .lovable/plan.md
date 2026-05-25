# Padronizar títulos dentro do editor de orçamento

Você tem razão — olhando a tela `/orcamentos-v3/novo`, a hierarquia de títulos está bagunçada. Hoje convivem **três estilos diferentes** sendo usados sem critério:

- `text-sm font-medium` → "Produtos favoritos" (no meio do form)
- `text-xs uppercase tracking-wide text-muted-foreground` → "DESCRIÇÃO (OPCIONAL)", "PAPEL", "QUANTIDADE", "PREÇO UNITÁRIO"
- `text-[11px] uppercase tracking-wider font-semibold` → "FAIXAS DE QUANTIDADE", "ITENS DO ORÇAMENTO"

O problema é que **uppercase está sendo usado para duas coisas diferentes**: tanto para *rótulo de campo* (DESCRIÇÃO) quanto para *cabeçalho de seção* (PAPEL, FAIXAS DE QUANTIDADE). O olho não consegue separar "isto é uma seção" de "isto é o label do input abaixo".

## Padrão único (alinhado com o resto do sistema)

A regra já registrada na memória do projeto:

| Nível | Quando usar | Estilo |
|---|---|---|
| **Section header** | Marca um bloco/seção dentro da página ("Produtos favoritos", "Papel", "Faixas de quantidade", "Itens do orçamento") | `text-sm font-semibold text-foreground` + ícone opcional pequeno em `text-muted-foreground` |
| **Field label** | Rótulo de um único campo de input ("Descrição", "Quantidade", "Preço unitário") | `text-xs uppercase tracking-wide text-muted-foreground font-medium` |

**Diferença visual chave:** section header é **sentence-case + bold normal**, field label é **UPPERCASE + muted**. Assim o usuário aprende uma vez e reconhece em qualquer tela.

## O que muda no editor

1. **"Produtos favoritos"** (`PrintAndProductForm.tsx` linha 169)
   `text-sm font-medium` → `text-sm font-semibold text-foreground`

2. **"PAPEL"** (com ícone) — hoje aparece como label uppercase
   Vira section header: **"Papel"** em `text-sm font-semibold text-foreground` com ícone pequeno à esquerda em muted

3. **"FAIXAS DE QUANTIDADE"** (`TierFaixasPanel.tsx` linha 69)
   `text-[11px] uppercase font-medium` → `text-sm font-semibold text-foreground` (vira **"Faixas de quantidade"**)

4. **"ITENS DO ORÇAMENTO"** (carrinho lateral, `NewQuoteFormV3.tsx` linha 446)
   `text-[11px] uppercase font-semibold` → `text-sm font-semibold text-foreground` (vira **"Itens do orçamento"**)

5. **Descrição da aba ativa** ("Itens impressos no parque próprio...") — hoje é um `<p>` cinza solto logo abaixo das tabs. Fica como está (é descrição auxiliar, não título), só ajusto o espaçamento se necessário para respirar.

6. **Field labels** ("DESCRIÇÃO (OPCIONAL)", "QUANTIDADE (FOLHAS)", "PREÇO UNITÁRIO", "MARGEM") — **permanecem como estão**. Já estão no padrão correto.

## Fora de escopo

- Toolbar do topo (Voltar / Cliente / Assunto / Salvar) — é editor, não módulo, fica como está.
- Cards de item no carrinho ("100 un. — Etiquetas 5×5 cm", "CUSTOS E LUCRO") — são dados, não títulos de seção; ficam.
- Card de sugestão de preset ("Parece um Apostila — aplicar preset?") — é call-to-action, não título.
- Cores, espaçamentos gerais e layout — só os títulos.

## Aplicação em outros forms do editor

Os mesmos quatro forms compartilham os componentes `TierFaixasPanel`, `PaperAutocomplete`, etc. Mexer nesses componentes compartilhados já corrige automaticamente:

- `PrintAndProductForm` (Impressão)
- `CVForm` (Comunicação Visual)
- `SupplyForm` (Suprimentos)
- `ThirdPartyForm` (Terceirizados)

Vou varrer os 4 e garantir que qualquer outro título solto também siga a regra.

## Passos técnicos

1. Editar `PrintAndProductForm.tsx`, `TierFaixasPanel.tsx`, `NewQuoteFormV3.tsx` aplicando a regra acima.
2. Conferir `CVForm`, `SupplyForm`, `ThirdPartyForm`, `LabelEmbeddedForm` em busca de títulos fora do padrão e corrigir.
3. Atualizar `mem://style/design` reforçando a distinção *section header (sentence-case bold)* × *field label (uppercase muted)* para evitar regressão futura.
4. Revisar no preview em `/orcamentos-v3/novo` que a hierarquia ficou legível e consistente com as páginas de módulo.
