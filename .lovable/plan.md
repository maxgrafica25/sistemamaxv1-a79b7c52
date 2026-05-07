## Corrigir erro "número não está no WhatsApp" ao abrir no app

### Causa

O número da gráfica salvo é `(51) 98484-1010`. O builder atual (`src/lib/quotes-v2/whatsapp.ts`) só remove caracteres não-numéricos e gera `https://wa.me/5198484101 0` — **sem o DDI `55`**. O WhatsApp interpreta `51` como código do Peru, encontra um número inválido e mostra "O número de telefone não está no WhatsApp".

O mesmo bug afeta o WhatsApp Web (`buildWaWebUrl`) — só não aparece visualmente porque na web a tela de erro é diferente.

### Correção

**`src/lib/quotes-v2/whatsapp.ts`** — adicionar helper `withCountryCode` que prefixa `55` quando o número tem 10 dígitos (fixo BR) ou 11 dígitos (celular BR). Se já vier com 12+ dígitos (já tem DDI), mantém como está. Aplicar em `buildWaUrl` e `buildWaWebUrl`.

```ts
const withCountryCode = (n: string): string => {
  const clean = sanitize(n);
  if (!clean) return "";
  if (clean.length === 10 || clean.length === 11) return `55${clean}`;
  return clean;
};
```

### Fora do escopo
- Validar/normalizar o número no momento de salvar em `company_settings` (fica para depois; a correção no builder já resolve todos os casos atuais sem alterar dado salvo).
- Outros builders WhatsApp (`src/lib/labels/whatsapp.ts`) — só corrigir se o usuário relatar o mesmo problema lá.