
# Plano: Modelos Prontos de Orçamento

Renomear toda a nomenclatura "Template" para "Modelo Pronto" e adicionar um seletor explícito de modelos ao criar um novo orçamento, tornando a função autoexplicativa para qualquer usuário.

## 1. Renomear "Template" para "Modelo Pronto" na interface

Toda a terminologia visível ao usuário será atualizada (nada muda no banco — apenas textos da tela):

- **Lista de Orçamentos V2** (`OrcamentosV2.tsx`):
  - Filtro do dropdown: "Templates" → "Modelos Prontos"
  - Estatística no topo: "templates" → "modelos prontos"
  - Badge na linha do orçamento: "Template" → "Modelo"
  - Tooltip do ícone de bookmark: "Salvar como template" → "Salvar como modelo pronto" / "Remover template" → "Remover dos modelos"
  - Toasts: "Marcado como template" → "Salvo como modelo pronto" etc.

- Manter o campo `is_template` no banco (sem migração) — é apenas troca de rótulos.

## 2. Novo botão "Começar com um Modelo"

Na página `/orcamentos-v2`, ao lado do botão **"Novo Orçamento V2"**, adicionar um segundo botão:

```
[ Começar com um Modelo ]   [ + Novo Orçamento V2 ]
```

- Ícone: `BookmarkCheck` (Lucide), visual secundário (`variant="outline"`).
- Ao clicar, abre um diálogo **"Escolher Modelo Pronto"** listando todos os orçamentos com `is_template = true`.

### Diálogo de seleção
- Lista cada modelo com: nome do produto, cliente original (apenas referência), valor base, e botão **"Usar este modelo"**.
- Campo de busca no topo para filtrar por nome.
- Caso não haja modelos cadastrados, exibe mensagem amigável:
  > "Você ainda não tem modelos prontos. Marque qualquer orçamento existente com o ícone de marcador para transformá-lo em modelo reutilizável."

### Ao confirmar
- Reaproveita a lógica já existente em `CloneQuoteButton` (clona orçamento + materiais + mão-de-obra + terceirizados).
- O novo orçamento clonado é criado com `status = 'pending'` e `is_template = false`.
- Após clonar, redireciona automaticamente para a tela de edição do novo orçamento (`/orcamentos-v2/:id`), já com tudo preenchido — basta o usuário trocar o cliente e ajustar.

## 3. Pequena melhoria de descoberta

Na página de criação de orçamento (`NewQuoteFormV2`, passo 1 "Informações"), adicionar um link discreto no topo:

> "💡 Quer agilizar? **Comece com um modelo pronto** em vez de criar do zero." (link que volta à lista e abre o diálogo)

Isso garante que mesmo quem clicou direto em "Novo Orçamento" descubra a funcionalidade.

## Detalhes técnicos

- **Novo arquivo**: `src/components/orcamentos-v2/UseTemplateDialog.tsx` — diálogo de seleção de modelos. Reutiliza a query `supabase.from("quotes").select(...).eq("is_template", true)`.
- **Refatoração leve**: extrair a lógica de clonagem de `CloneQuoteButton.tsx` para uma função utilitária `cloneQuote(quoteId)` em `src/lib/quotes-v2/clone.ts`, para que o diálogo e o botão existente compartilhem o mesmo código.
- **`OrcamentosV2.tsx`**: adicionar estado `useTemplateOpen`, novo botão no header, montar `<UseTemplateDialog />`. Atualizar todos os textos visíveis.
- **`NewQuoteFormV2.tsx`**: adicionar o link de descoberta no passo 1.
- Nenhuma mudança no schema do banco; nenhuma migração.

## Resultado para o usuário

1. Botão grande e claro **"Começar com um Modelo"** na lista de orçamentos.
2. Em vez do termo técnico "Template", aparece **"Modelo Pronto"** em todos os lugares.
3. Fluxo guiado: escolher modelo → orçamento já preenchido → ajustar cliente → enviar.
