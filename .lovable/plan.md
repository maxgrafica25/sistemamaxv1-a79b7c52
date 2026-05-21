# Presets de quantidade — novos valores + UI mais visível

## Objetivo
No painel "Faixas adicionais" (`TierFaixasPanel.tsx`), trocar os presets atuais (×2, ×5, ×10, +50%, Limpar) por **−5, +5, +10, +15**, manter o campo livre para quantidade personalizada e **redesenhar a área de presets** para ficar muito mais clara e fácil de usar.

## Novos presets
Relativos à quantidade atual (`currentQty`):
- **−5** → `currentQty − 5`
- **+5** → `currentQty + 5`
- **+10** → `currentQty + 10`
- **+15** → `currentQty + 15`

`addQty` já ignora valores ≤ 0 e duplicatas, então `−5` em quantidades pequenas é seguro. Ainda assim, vamos **desabilitar visualmente** o botão `−5` quando `currentQty − 5 < 1`, para deixar claro que ele não se aplica.

## Redesign da área de presets

### Estado atual
- Linha discreta com label "Presets:" minúsculo e botões pill cinza pequenos (h-6, text-[10px]) — passam despercebidos.
- "Limpar" misturado com os presets, sem hierarquia.
- O campo "Adicionar quantidade" fica acima dos presets, separado.

### Proposta
Reagrupar tudo em um único bloco "Adicionar faixa" mais destacado:

```text
┌─ Adicionar uma faixa para comparar ───────────────┐
│                                                   │
│  Atalhos (a partir de {currentQty} un)            │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │
│  │ −5  │ │ +5  │ │ +10 │ │ +15 │                  │
│  │ 45  │ │ 55  │ │ 60  │ │ 65  │  ← qty resultante│
│  └─────┘ └─────┘ └─────┘ └─────┘                  │
│                                                   │
│  ou digite outra quantidade                       │
│  [ 100        ] [ + Adicionar ]                   │
│                                                   │
│                              [ Limpar todas ]     │
└───────────────────────────────────────────────────┘
```

Detalhes visuais:
- Botões de atalho maiores (`h-12`, conteúdo em 2 linhas: rótulo grande em cima `−5/+5/+10/+15`, número resultante embaixo em `text-[10px] text-muted-foreground tabular-nums`).
- Borda mais visível (`border-border` sólida em vez de pill discreto) + hover com `bg-primary/5` e `border-primary/40`.
- Largura igual (`flex-1` em grid de 4 colunas) para alinhamento limpo.
- Label "Atalhos (a partir de N un)" em `text-xs` para o usuário entender que são relativos.
- Separador sutil antes do campo de quantidade livre, com label próprio "ou digite outra quantidade".
- Botão "Limpar todas" movido para a direita, em `ghost` pequeno, separado dos presets — só aparece quando `sortedExtras.length > 0`.
- Botão `−5` recebe `disabled` + `opacity-40 cursor-not-allowed` quando o resultado seria < 1.

## Mudanças

**Arquivo único:** `src/components/orcamentos-v3/shared/TierFaixasPanel.tsx`

1. Trocar o array de presets atual pela lista nova `[-5, +5, +10, +15]` (deltas).
2. Remover o helper `applyPreset` (não é mais usado).
3. Substituir as duas seções "Adicionar quantidade" e "Presets" por um bloco unificado conforme o esboço acima.
4. Mover "Limpar" para um botão `ghost` separado, condicionalmente renderizado.

## Fora do escopo
- Nada de lógica de precificação, cálculo ou outros formulários.
- Não mexer no resumo da quantidade solicitada nem na lista de sugestões já adicionadas.
