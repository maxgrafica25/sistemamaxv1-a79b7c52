
# Lado da impressão sempre antes do papel + filtro recíproco

## Comportamento alvo

1. **Em todos os forms de impressão** (Personalizado e presets), o toggle **Frente / F/V** aparece **sempre antes** do seletor de papel, visível desde a abertura do form.
2. Quando o usuário seleciona um lado, o catálogo é filtrado:
   - **Frente** → esconde papéis cadastrados como **F/V** (já é o comportamento atual).
   - **F/V** → esconde papéis cadastrados como **Frente** (novo), **exceto** papéis marcados como "exceção F/V" (ex.: Sulfite 75g A4, que tecnicamente é frente mas é comumente usado em F/V).
3. Quando o form é aberto a partir de um **preset** (Produto Favorito), o lado vem pré-selecionado conforme `side_default`, mas continua editável no mesmo toggle.
4. Trocar o lado depois de já ter um papel selecionado: se o papel atual deixar de ser compatível com o novo filtro, o papel é limpo e o usuário escolhe outro.

## Forms afetados

- `PrintForm.tsx` (Tags, Etiqueta, Adesivo, Folheto, Personalizado de papel)
- `BookletForm.tsx` (Apostila — miolo)
- `BusinessCardForm.tsx` (Cartão de visita)
- `CertificateForm.tsx` (Certificado)
- `PrintAndProductForm.tsx`

CV/Mídia, Mão-de-obra, Suprimentos, etc. ficam **fora de escopo**.

## Mudanças por arquivo

### Banco de dados
- **Migration**: adicionar coluna `fv_exception boolean NOT NULL DEFAULT false` em `printing_catalog_items` (ou tabela equivalente do catálogo de papéis V3 — vou confirmar o nome ao implementar lendo `useV3Catalog`).
- O tipo `PrintingCatalogItem` ganha o campo `fv_exception?: boolean`.

### Cadastro do papel (módulo Preço de Impressão)
- `PrecoImpressao.tsx` (ou o componente de edição de item do catálogo de impressão): adicionar um checkbox **"Permitir uso em F/V mesmo sendo papel só frente"** (ativo apenas quando o item está cadastrado como `side = "Frente"`). Salva em `fv_exception`.

### Forms de orçamento (padrão repetido)

Em cada um dos 5 forms:

1. **Mover o toggle Frente/F/V para fora do bloco condicional `!catalog`** — ele fica sempre no topo, antes do seletor/header de papel.
2. Remover a duplicação do toggle que hoje aparece no header "com papel selecionado" (passa a ser um único toggle, sempre visível).
3. **Filtro do catálogo** ao passar para `PrintingItemSearch`:
   ```
   items.filter((it) => {
     if (sideChoice === "Frente") return it.side !== "F/V";
     // sideChoice === "F/V"
     return it.side === "F/V" || it.fv_exception === true;
   })
   ```
4. **Ao alternar `sideChoice`** com papel já selecionado: se o papel atual não passar mais no filtro, `setCatalog(null)`.
5. Manter `defaultPaperHint.side` como seed do `sideChoice` (presets continuam pré-configurando o toggle).
6. `BookletForm`: remover a inicialização forçada `"F/V"` quando o hint diz "Frente" (linha 71 — bug atual: usa `"F/V"` como fallback mesmo quando o hint é "Frente").

### PrintForm — ajuste extra

A iteração anterior colocou o picker dentro de um Dialog/modal. O toggle Frente/F/V sai do header e da DialogContent e passa a ficar **acima do bloco "Selecionar papel"**, sempre visível na página. O modal segue existindo apenas para a busca de papel; o toggle não duplica mais.

## Não incluso (a confirmar depois)

- Melhoria do editor de Produtos Favoritos (`QuotePresets.tsx`) para o campo `side_default` — você mencionou "podemos melhorar" mas não definimos o quê. Sugestão futura: substituir o dropdown atual por um toggle visual igual ao do orçamento + checkbox "deixar usuário escolher". Posso fazer em uma próxima rodada.
- Pré-cadastro de papéis exceção (Sulfite 75g A4) — depois da migration, você marca manualmente no módulo Preço de Impressão os papéis que devem ser permitidos em F/V.
