# Modo Dark — Implementação Completa

O sistema já tem `next-themes` instalado e tokens HSL light/dark definidos no `index.css`, mas falta o **provider**, o **toggle** e a integração com o `Ctrl+K`. Vamos finalizar.

## O que será entregue

**3 modos de tema:**
- ☀️ Claro (light)
- 🌙 Escuro (dark)
- 💻 Sistema (segue o SO automaticamente)

**3 formas de alternar:**
1. **Toggle no header** — ícone sol/lua ao lado do sino de notificações, com dropdown (Claro / Escuro / Sistema)
2. **Atalho de teclado** — `Ctrl + Shift + L` alterna instantaneamente entre Claro ↔ Escuro
3. **Paleta de Comandos** — novo grupo "🎨 Aparência" no `Ctrl+K` com as 3 opções

**Polimento UX (nível sênior):**
- **Anti-flash (FOUC)** — script bloqueante no `index.html` aplica o tema correto **antes** do React montar, eliminando o "piscar branco" ao recarregar em modo escuro
- **Persistência** — escolha salva em `localStorage['max-theme']`
- **Transição suave** — 200ms em `background-color` e `color` no body, sem deixar lento
- **Tokens já existentes** — usa o `.dark` já definido em `src/index.css` (sem reinventar paleta)
- **Ícone animado** — sol/lua faz crossfade ao trocar (estilo shadcn padrão)
- **Sincronização entre abas** — se o usuário trocar o tema em outra aba, esta atualiza

## Arquivos

**Criar:**
- `src/components/ThemeProvider.tsx` — wrapper do `next-themes` com config (`attribute="class"`, `defaultTheme="system"`, `storageKey="max-theme"`)
- `src/components/ThemeToggle.tsx` — botão sol/lua + dropdown com 3 opções

**Modificar:**
- `index.html` — script inline anti-FOUC (lê localStorage e aplica `.dark` no `<html>` antes do paint)
- `src/App.tsx` — envolver app com `<ThemeProvider>`
- `src/components/Layout.tsx` — adicionar `<ThemeToggle />` no header, antes do `<NotificationBell />`
- `src/components/CommandPalette.tsx` — novo grupo "Aparência" com 3 itens + handler do atalho `Ctrl+Shift+L`
- `src/index.css` — adicionar `transition: background-color 200ms, color 200ms` no `body`

## Detalhes técnicos

- **Sem nova dependência** — `next-themes@0.3.0` já está no `package.json`
- **Hook `useTheme()`** do `next-themes` para ler/escrever tema nos componentes
- **Atalho** registrado dentro do `CommandPalette.tsx` (já tem listener global de teclado), evitando duplicação
- **Paleta de cores `.dark`** atual do projeto já é grafite sóbrio (slate-900 base) — sem roxo saturado, alinhado ao pedido anterior
- **Acessibilidade** — `aria-label` no toggle, foco visível, navegável por teclado

## Resultado

Ao aprovar, em ~10s o usuário poderá:
1. Clicar no ícone sol/lua no header → escolher tema
2. Pressionar `Ctrl+Shift+L` em qualquer tela → alternar instantâneo
3. Abrir `Ctrl+K` → digitar "escuro" / "claro" / "sistema" → Enter

A escolha persiste entre sessões e respeita o sistema operacional por padrão.
