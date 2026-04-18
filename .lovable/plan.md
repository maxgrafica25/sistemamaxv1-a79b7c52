
Diagnóstico: os ajustes anteriores mexeram no regex, mas o problema real está antes disso. Pelos logs, a Atual Card entregou só `markdown=177 chars` e a Imprima Rápido `markdown=268 chars`, então o extrator textual simplesmente não está “vendo” a tabela completa. Já a FuturaIM entrega muito texto (`85894 chars`), então um fallback amplo demais tende a puxar números extras. Ou seja: não adianta continuar só afinando regex.

Plano de correção:

1. Manter o fluxo atual como etapa principal
- Continuar usando Firecrawl JSON + validação + regex para os sites que já funcionam bem (ANS e casos estáveis).
- Isso evita quebrar o que já está correto.

2. Adicionar uma checagem de confiança no `detect-price-tiers`
- Marcar o resultado como “baixa confiança” quando acontecer um destes sinais:
  - markdown muito curto
  - regex = 0
  - poucas faixas detectadas para páginas que visualmente têm mais
  - quantidades não monotônicas / inconsistentes
- Essa checagem decide quando ativar um fallback diferente.

3. Trocar o fallback de texto por fallback visual
- Para Atual Card e Imprima Rápido, pedir também screenshot da página no Firecrawl.
- Enviar a screenshot para um modelo multimodal via Lovable AI e extrair a tabela de quantidades/preços lendo a área visível da página.
- Usar schema rígido para retornar apenas:
  - quantidade
  - preco_total
  - preco_unitario
  - texto_original
- Isso resolve o caso em que a página renderiza no navegador, mas o markdown/html útil não vem completo.

4. Fazer merge conservador para evitar “faixas a mais”
- Não juntar tudo cegamente.
- Regra proposta:
  - se o resultado textual estiver com alta confiança, ele continua valendo
  - se estiver com baixa confiança, usar o resultado visual como fonte principal
  - só aceitar faixas extras se forem coerentes com a tabela (quantidades típicas, ordem crescente, sem duplicidade por quantidade)
- Assim a FuturaIM não volta a inflar com linhas indevidas.

5. Replicar a mesma lógica na sincronização automática
- Aplicar a mesma função auxiliar em:
  - `supabase/functions/detect-price-tiers/index.ts`
  - `supabase/functions/scheduled-sync-firecrawl/index.ts`
- Isso garante que o cadastro manual e a atualização automática tenham o mesmo comportamento.

6. Validação após implementação
- Reprocessar estes links e conferir contagem final:
  - Atual Card: 8 faixas
  - Imprima Rápido: 8 faixas
  - ANS: continuar correto
  - FuturaIM: sem faixas extras
- Também validar que a ordenação por quantidade continua correta e sem duplicatas.

Arquivos afetados:
- `supabase/functions/detect-price-tiers/index.ts`
- `supabase/functions/scheduled-sync-firecrawl/index.ts`

Sem mudança no banco. A principal mudança é de estratégia: sair de um fallback textual frágil para um fallback visual controlado, ativado só quando o scrape vier com baixa confiança.
