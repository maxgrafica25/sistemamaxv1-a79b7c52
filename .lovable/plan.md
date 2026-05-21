# Tutorial inline na tela de Kits de Produto

Adicionar um banner "Como funciona" recolhível no topo do editor de kits, para deixar o fluxo óbvio sem precisar perguntar.

## O que será criado

**Novo componente:** `src/components/kits/KitHowItWorks.tsx`
- Banner colapsável (usa `Collapsible` do shadcn) com cabeçalho "Como funciona este kit" + ícone `HelpCircle` e chevron.
- Estado persistido em `localStorage` (`kits.howItWorks.open`) — abre por padrão na primeira visita, lembra preferência depois.
- Conteúdo em 4 passos curtos com ícones Lucide:
  1. **Adicionar acabamentos** — botão `+ Adicionar acabamentos` abre o picker com abas Suprimentos/Processos para seleção em massa.
  2. **Definir papel de cada item** — `Obrigatório` (sempre entra), `Opcional` (cliente escolhe), `Alternativo` (agrupado, escolhe 1).
  3. **Espiral por nº de folhas** — botão `Espiral por folhas` cria item com 12 faixas; clique em `variante · N faixas` para mapear cada faixa ao suprimento certo.
  4. **Ajustes finos** — `⋯` por linha abre fórmulas (×N por unidade / por folha), grupos de alternativos, pré-seleção e notas.
- Linguagem curta, em PT-BR, exemplos práticos ("ex.: capa LINE vs CAMURCA = alternativos no grupo `capa`").

## Onde integrar

**`src/pages/KitsProduto.tsx`**
- Importar `KitHowItWorks` e renderizar logo abaixo do cabeçalho do kit (nome/tipo/ativo), antes da lista de itens.
- Aparece tanto na criação quanto na edição.

## Fora de escopo

- Sem mudanças no engine, no `ProductKitPanel`, no picker, no `VariantsDialog` ou em qualquer lógica de negócio.
- Sem migrations.
- Sem mudanças no modelo de dados.
