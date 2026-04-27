# Integrar Cadastro de Clientes ao Orçamento V2

Hoje o campo **Cliente** no Novo Orçamento V2 é apenas um `<Input>` de texto livre — ele não busca nada na tabela `clients`. Quem digita "Maxipel" gera uma string solta sem vínculo com o cadastro.

## O que vai mudar

Substituir o campo de texto por um **combobox inteligente** que:

1. **Busca em tempo real** na tabela `clients` (nome, empresa, telefone, e-mail).
2. **Mostra sugestões** com nome principal + empresa/telefone abaixo.
3. **Vincula o orçamento ao cliente** (id) ao selecionar — não apenas o nome.
4. **Permite cadastrar na hora** quando o cliente ainda não existe, sem sair do orçamento (mini-formulário em diálogo: nome, telefone, e-mail, empresa, tipo).
5. **Pré-preenche dados úteis** ao selecionar (telefone fica disponível para o WhatsApp e o link público).

## Estrutura visual

```text
┌─ Cliente ─────────────────────────────────────┐
│ 🔍 Digite o nome, empresa ou telefone...   ▼ │
├───────────────────────────────────────────────┤
│ Maxipel                                       │
│   Maxipel Distribuidora · (51) 3337-7800     │
│ ───                                           │
│ Marcelle Pinheiro                             │
│   marcelle@max.com.br · 5199999999            │
│ ───                                           │
│ + Cadastrar novo cliente "max..."             │
└───────────────────────────────────────────────┘
```

Quando selecionado, mostra um chip compacto com nome + telefone e botão "Trocar".

## Mudanças técnicas

- **Banco:** adicionar coluna `client_id uuid` em `quotes` (nullable, sem FK rígida para preservar histórico). O texto `client` continua sendo gravado para compatibilidade e para orçamentos antigos.
- **Componente novo:** `src/components/orcamentos-v2/ClientCombobox.tsx` — usa `cmdk` (já instalado via shadcn) com debounce de 200ms na busca.
- **Diálogo de cadastro rápido:** reaproveita campos do `Clientes.tsx` (nome, telefone obrigatórios; empresa, e-mail, tipo opcionais). Insere em `clients` e seleciona automaticamente.
- **NewQuoteFormV2.tsx:** troca `<Input>` Cliente pelo `ClientCombobox`, persiste `client_id` junto com `client` no save, e carrega o cliente vinculado na edição.
- **Edição de orçamentos antigos:** se houver só `client` (texto) sem `client_id`, mostra como "texto livre" com opção de vincular a um cliente existente.

## Onde **não** mudo (por enquanto)

- Visualização pública do orçamento (`/view-quote/:id`) — segue mostrando o nome.
- Geração de OP / WhatsApp — já usa o campo `client`.
- Outros lugares que tenham campo cliente (cobrança, produção): podem ser migrados depois.

## Resultado esperado

Vendedor digita "max" → vê Maxipel, Marcelle, etc. Clica → orçamento amarrado ao cadastro. Se for cliente novo, cadastra em 5 segundos sem perder o que já preencheu.