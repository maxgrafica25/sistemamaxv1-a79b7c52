

# Refinar UX da aba Monitoramento (revisado)

## 1. ProductPicker — clarificar dupla função

- **Trigger label**: `"Buscar ou cadastrar produto..."`
- **Placeholder do CommandInput**: `"Digite para buscar ou cadastrar..."`
- **Cabeçalho do popover** (linha curta `text-xs text-muted-foreground` acima do input): **"Selecione um produto existente ou cadastre um novo abaixo"**
- Botão "Cadastrar" mantém estilo ghost atual; quando habilitado, ícone `Plus` em `text-primary` e a palavra "Cadastrar" em `font-medium`.

## 2. Renomear "Testar scraping" → "Buscar preços"

Em `NovoSiteDialog.tsx`:
- Texto do botão: **"Buscar preços"**, ícone trocado de `FlaskConical` para `Search`.
- Toasts: `"Erro ao testar scraping"` → `"Erro ao buscar preços"`; `'Clique em "Testar scraping" antes de salvar'` → `'Clique em "Buscar preços" antes de salvar'`.

## 3. Renomear abas

| Atual | Nova |
|---|---|
| Oportunidades | Oportunidades |
| Comparativo | **Comparar fornecedores** |
| Tabela completa | **Gerenciar sites** |
| Alertas | Alertas |

"Gerenciar sites" mantida — é a única view com CRUD (ativar/desativar, excluir, sync manual) e mostra inclusive sites sem preço coletado.

## 4. Botão "Gerar alerta de teste" na aba Alertas (Opção B confirmada viável)

**Constraint verificada:** `alertas_precos.site_id` é NOT NULL com FK para `sites_monitorados` (ON DELETE CASCADE). A inserção direta funciona desde que use um `site_id` real.

**Implementação:**
1. Pequeno botão `variant="outline" size="sm"` no rodapé da aba Alertas: **"Gerar alerta de teste"**.
2. Ao clicar:
   - Buscar 1 site qualquer ativo: `supabase.from("sites_monitorados").select("id, nome_produto, fornecedor_nome").eq("ativo", true).limit(1)`.
   - Se não houver site ativo: toast `"Cadastre ao menos um site ativo para testar alertas"` e aborta.
   - Se houver: insere em `alertas_precos`:
     ```ts
     {
       site_id: <id do site>,
       mensagem: "[TESTE] Alerta sintético — pode marcar como lido",
       prioridade: "baixa",
       produto_nome: "[TESTE]",
       fornecedor_nome: site.fornecedor_nome,
     }
     ```
3. Realtime existente já propaga para a UI; usuário valida exibição + "marcar como lido" + remoção da lista.
4. **Não toca em `site_precos_tiers`** → não polui histórico, não dispara trigger, não precisa reverter.

## Arquivos afetados

- `src/components/monitoramento/ProductPicker.tsx`
- `src/components/monitoramento/NovoSiteDialog.tsx`
- `src/pages/Monitoramento.tsx`

## Fora de escopo

Scraping, schema, RLS, triggers, layout/cores globais.

## Risco

Mínimo. Mudanças textuais + 1 botão isolado que insere uma linha descartável em `alertas_precos` referenciando um site existente.

