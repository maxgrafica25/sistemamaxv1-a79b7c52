

# Data/hora discreta nas mensagens da Júlia

## O que muda para você

Cada balão de mensagem (seu e da Júlia) ganha um **timestamp pequeno e discreto** logo abaixo do texto, alinhado à borda do balão. Formato curto e inteligente:

- Mensagem de **hoje**: só a hora — `14:32`
- Mensagem de **ontem**: `ontem 14:32`
- Mensagem **mais antiga**: `22/04 14:32`

Visual:
- Tamanho `text-[10px]` (bem pequeno)
- Cor `text-muted-foreground/60` (apagado)
- Aparece embaixo do balão, alinhado à direita nas suas mensagens e à esquerda nas da Júlia
- Não quebra layout dos chips de "lembrar antes" — fica acima deles

## Mudanças técnicas

**1. `src/components/assistente/AssistenteButton.tsx`**
- Tipo `MSG` ganha campo `timestamp: number` (epoch ms).
- Ao adicionar mensagem (usuário ou assistente), incluir `timestamp: Date.now()`.
- Passar `timestamp` como prop para `<AssistenteMensagem>`.

**2. `src/components/assistente/AssistenteMensagem.tsx`**
- Nova prop opcional `timestamp?: number`.
- Helper `formatTimestamp(ts)` que decide entre `HH:mm`, `ontem HH:mm` ou `dd/MM HH:mm` usando `date-fns` (`isToday`, `isYesterday`, `format` com locale `ptBR`) — já são dependências do projeto.
- Renderizar `<span className="text-[10px] text-muted-foreground/60 mt-0.5">{formatted}</span>` dentro do mesmo container do balão, depois do conteúdo e antes dos chips.

**Sem persistência:** as conversas com a Júlia já são em memória (resetam ao recarregar). O timestamp é só visual, não precisa salvar em lugar nenhum.

## Fora deste escopo

- Histórico persistente das conversas com a Júlia (continua em memória).
- Separadores de data tipo "Hoje" / "Ontem" entre grupos de mensagens (manteve estilo minimal — só carimbo no balão).

