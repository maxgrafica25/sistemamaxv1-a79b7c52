

# Adicionar chip "15 minutos antes" nas opções de antecedência

## Mudança

Em `src/components/AssistenteMensagem.tsx`, adicionar um novo botão de chip **"15 min antes"** na lista de opções rápidas de antecedência da Júlia, antes do "1 hora antes".

## Ordem final dos chips

1. Na hora
2. **15 min antes** ← novo
3. 1 hora antes
4. 3 horas antes
5. Personalizar

## Arquivo alterado

- `src/components/assistente/AssistenteMensagem.tsx` — adicionar 1 botão `<Button>` no bloco de chips (linhas ~92-104).

## Fora do escopo

- Não mexer no system prompt da Júlia (`assistente-virtual/index.ts`) — ela já interpreta qualquer texto livre de antecedência (ex.: "15min", "30 minutos"), então o novo chip funcionará sem ajuste no backend.
- Sem mudança em schema, ferramentas ou fluxo de criação de lembretes.

