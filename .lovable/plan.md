# Correção: Tela branca + Links amigáveis das propostas

## Problema 1 — Tela branca ao abrir o link da proposta

A página `ClientViewer` (rota `/view-quote/:id`) declara hooks (`useRef`, `useEffect`) **depois** dos `return` condicionais de "carregando" e "não encontrado". Isso viola as Rules of Hooks do React: na 1ª renderização (loading) menos hooks são executados que na 2ª (quando o orçamento carrega), o React aborta o render e mostra tela branca.

**Linhas afetadas em `src/pages/orcamentos-v2/ClientViewer.tsx`:**
- L175-190: `if (loading)` e `if (notFound)` retornam cedo
- L212-213: `useRef` declarados depois disso
- L215-220: `useEffect` de cleanup declarado depois disso

**Correção:** mover os 2 `useRef` e o `useEffect` de cleanup para perto dos outros hooks (acima dos `return` condicionais, junto da linha ~145).

## Problema 2 — Links amigáveis para propostas

Hoje: `https://sistema.../view-quote/8f3c1a92-7b6e-4d18-9f0a-2e5b7c4a1d83`
Proposta: `https://sistema.../p/2026-018`

Como `quote_number` já é único e legível (formato `AAAA-NNN`), vamos usá-lo no link público.

### Mudanças

1. **Nova rota em `src/App.tsx`:**
   - Adicionar `<Route path="/p/:quoteNumber" element={<ClientViewer />} />`
   - **Manter** `/view-quote/:id` como fallback para não quebrar links já enviados a clientes.

2. **`ClientViewer.tsx`:**
   - Ler tanto `id` (UUID) quanto `quoteNumber` via `useParams`.
   - Se vier `quoteNumber`, buscar o orçamento por `.eq("quote_number", quoteNumber)` em vez de `.eq("id", id)`.
   - Restante do fluxo (eventos de tracking, RPCs) continua usando o `quote.id` interno.

3. **Geração de links (3 lugares):** trocar `/view-quote/${id}` por `/p/${quoteNumber}`:
   - `src/pages/orcamentos-v2/OrcamentosV2.tsx` (L117) — botão "Copiar link" da listagem
   - `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (L508) — após salvar
   - `src/components/orcamentos-v2/EngagementPopover.tsx` (L126) — popover de engajamento

4. **Versões do orçamento:** quando `version > 1`, o `quote_number` permanece igual entre versões? Vou verificar; se houver colisão, o link aponta para a versão mais recente (ordenar por `version desc` na query do viewer). Comportamento já desejado para o cliente.

## Detalhes técnicos

- Não exige migration de banco — `quote_number` já existe e é único.
- O fallback `/view-quote/:id` continua funcionando indefinidamente; pode ser removido no futuro.
- Tracking continua identificando o orçamento por `quote.id` (UUID), então a tabela `quote_engagement_events` não muda.
- Compartilhamento por WhatsApp passa a enviar URL curta e profissional (`/p/2026-018`), mais fácil de digitar/lembrar.

## Arquivos a editar

- `src/pages/orcamentos-v2/ClientViewer.tsx` — corrigir ordem dos hooks + suportar lookup por `quote_number`
- `src/App.tsx` — adicionar rota `/p/:quoteNumber`
- `src/pages/orcamentos-v2/OrcamentosV2.tsx` — gerar URL curta
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — gerar URL curta
- `src/components/orcamentos-v2/EngagementPopover.tsx` — gerar URL curta

Posso prosseguir com a implementação?
