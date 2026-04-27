# Filtrar combobox para mostrar só clientes

Hoje o combobox de Cliente do Orçamento V2 lista também fornecedores e parceiros (todos os registros da tabela `clients`). No print aparecem "Bluebird", "Lunes3", "Maxipel" marcados como **fornecedor**, junto com os clientes reais.

## Mudança

No `ClientCombobox.tsx`, adicionar um filtro fixo `tipo = 'cliente'` na consulta ao Supabase. Assim a lista passa a mostrar apenas:

- Juliano Michelin (cliente)
- Marcelle Pinheiro (cliente)
- … demais cadastros marcados como cliente

E **esconde** Bluebird, Lunes3, Maxipel, Mercado Livre etc. (fornecedores).

## Onde mexer

- `src/components/orcamentos-v2/ClientCombobox.tsx` — adicionar `.eq("tipo", "cliente")` na query de busca.
- O cadastro rápido (botão "Cadastrar novo cliente") já cria com `tipo = "cliente"` por padrão, então segue funcionando.

## Observação

Se algum dia precisar vincular fornecedor a um orçamento, criamos um seletor separado. Aqui o campo é só "Cliente".