## Contexto

Hoje um acabamento tem dois modelos: **Por folha** e **Por unidade**. Você apontou duas coisas:

1. Existem acabamentos que **não cobram nada**, só consomem tempo de mão de obra (ex.: Intercalar, Montagem, Conferência).
2. "Por folha" e "Por unidade" soam redundantes — bastaria "unidade".

Antes de mexer eu preciso alinhar uma decisão importante, porque os dois modelos **não são puramente cosméticos** no motor de preço:

- `per_sheet` → o preço entra no cálculo da folha impressa (`src/lib/labels/sheet-pricing.ts`, `src/lib/finishings/catalog.ts`) e recebe os multiplicadores de formato (A3=2x, SRA3=2x, F/V=2x).
- `per_unit` → o preço é multiplicado direto pela quantidade final de peças, sem passar pelos multiplicadores de folha.

Ou seja, hoje "folha" e "unidade" definem **em que base o preço é aplicado**, não só o rótulo. Se unificarmos cegamente, perdemos os multiplicadores automáticos do recorte/laminação por SRA3.

## Proposta

### 1. Adicionar modo "Somente tempo" (sem mexer no motor)

Novo seletor com 3 opções no lugar do atual:

- **Por folha** — cobra preço por folha (mantém multiplicador A3/SRA3/F-V). Campos: preço + tamanho.
- **Por unidade** — cobra preço por peça final. Campo: preço.
- **Somente tempo** (novo) — não cobra nada, só lança minutos de mão de obra no cálculo. Campos: tempo (min). Esconde preço e tamanho. Salva `price_per_sheet = 0`, `pricing_model = 'per_unit'`, `unit_label = 'serviço'`.

Na tabela, esses itens aparecem com badge **"Tempo: 10m"** e preço "R$ 0,00 /serviço" (já é o comportamento atual quando o preço é zero).

Esse é o caminho **seguro** e resolve sua dúvida de cadastro imediatamente.

### 2. Sobre unificar "folha" e "unidade" em só "unidade"

Tecnicamente dá, mas exige decidir uma destas direções (preciso da sua escolha):

- **(A) Manter os dois modelos, só renomear na UI** — chamar ambos de "Por unidade" e mostrar um sub-toggle "a unidade é uma folha (aplica multiplicadores A3/SRA3/F-V)". Zero risco no motor, só muda label.
- **(B) Unificar de verdade** — todo acabamento passa a ser "por unidade" e o multiplicador de formato deixa de ser automático. Quem precisar de "2x em SRA3" cadastra **faixas** (`Tabela de preços por quantidade`, que já existe) ou um acabamento separado por tamanho. Mais limpo conceitualmente, mas exige migrar os acabamentos atuais que dependem do multiplicador automático e ajustar `sheet-pricing.ts` / `catalog.ts`.
- **(C) Não unificar** — manter os dois rótulos como estão (são funcionalmente diferentes no preço final).

### 3. Limpeza pequena junto

- Renomear o label do campo de preço de "Preço por folha (R$)" → "Preço (R$)" + sufixo dinâmico ("por folha A4", "por unidade", oculto em "Somente tempo").
- Esconder o seletor de Tamanho quando não for "Por folha".

## Arquivos afetados (somente passo 1, se aprovar agora)

- `src/pages/Acabamentos.tsx` — adicionar opção "Somente tempo" no `Select` de modelo, esconder campos de preço/tamanho condicionalmente, ajustar `save()` para gravar `price=0` + `unit_label='serviço'`.

## Pergunta para você

Implemento **só o passo 1 (modo "Somente tempo")** agora e deixamos a unificação dos dois modelos para depois? Ou você prefere já decidir entre A/B/C acima?
