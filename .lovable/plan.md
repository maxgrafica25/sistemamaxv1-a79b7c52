## Configurações — remover rolagem e tornar responsivo

Hoje a página `Configuracoes.tsx` usa `max-w-3xl` em coluna única com cards empilhados e padding `p-8`, gerando rolagem vertical já em telas como 1067×680. Vou compactar e distribuir o conteúdo em colunas, mantendo responsividade.

### Mudanças em `src/pages/Configuracoes.tsx`

1. **Container**
   - Trocar `<div className="p-8">` por `<div className="p-4 md:p-6 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">`.
   - Header `mb-8` → `mb-4`, h1 `text-2xl` → `text-xl`.
   - `<Tabs … max-w-3xl>` → `<Tabs … className="flex-1 min-h-0 flex flex-col w-full max-w-none">`.
   - Cada `<TabsContent>` recebe `flex-1 min-h-0 overflow-y-auto pr-1` para que **apenas o conteúdo da aba** role internamente quando inevitável (telas muito pequenas), eliminando rolagem da página inteira.

2. **Aba "Geral" — layout em grid responsivo**
   - Wrapper: `grid gap-4 lg:grid-cols-2 xl:grid-cols-3` agrupando os 3 cards (Custos Operacionais, Composição do Preço, Fluxo de orçamentos).
   - Separar o bloco "Fluxo de orçamentos" do card "Composição do Preço" em **card próprio**, para caber bem na 3ª coluna em telas largas.
   - Cards: trocar `space-y-6` por `space-y-4`, `CardContent` interno `space-y-6` → `space-y-4`; grids internos `md:grid-cols-4` → `grid-cols-2 xl:grid-cols-4` (melhor em larguras médias).
   - Botão "Salvar Configurações": `size="lg"` → `size="default"`, posicionado fora do grid (rodapé fixo da aba) com `mt-2 flex justify-end`.

3. **Abas Backup / VPS / Conhecimento / Integrações**
   - Aplicar o mesmo padrão `flex-1 min-h-0 overflow-y-auto` por aba (a tabela do histórico de backups continua rolando dentro da própria aba quando muito longa).
   - Card "Gerar backup completo" e "Histórico de Backups" em `grid gap-4 xl:grid-cols-2` (lado a lado em telas largas).

4. **Responsividade**
   - Mobile (<768px): tudo em coluna única (grids colapsam para `grid-cols-1`).
   - Tablet (≥768px): grids de inputs em 2 colunas.
   - Desktop (≥1280px): cards lado a lado e inputs em 4 colunas.

Nenhuma mudança de lógica, estado, queries Supabase ou nas outras páginas — apenas layout/spacing/grid em `Configuracoes.tsx`.
