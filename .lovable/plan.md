# Melhorar feedback de salvamento em "Tipos de frete"

Manter o autosave ao sair do campo (padrão atual), mas deixar claro pro usuário que a alteração foi salva.

## Mudanças em `src/components/configuracoes/FreightTypesCard.tsx`

1. **Texto explicativo** abaixo da descrição do card:
   *"As alterações em itens existentes são salvas automaticamente ao sair do campo."*

2. **Toast de confirmação ao editar** linha existente (nome ou valor):
   - Hoje a função `update()` salva silenciosamente. Adicionar `toast.success("Alteração salva")` após sucesso.
   - Disparar apenas quando houve mudança real (já há checagem de `onBlur` comparando valor).

3. **Indicador sutil "Salvando..."** (opcional, leve):
   - Estado local `savingId: string | null` para destacar a linha em salvamento.
   - Aplicar uma classe sutil (ex.: `opacity-70`) enquanto a request roda.

## Resultado esperado

- Sem novo botão; fluxo continua de 1 clique fora do campo.
- Usuário entende imediatamente o comportamento (texto explicativo).
- Confirmação visual a cada edição (toast).

Não vou padronizar outros cards agora — aplico só aqui. Se gostar do resultado, replico em Acabamentos / Despesas / etc. depois.