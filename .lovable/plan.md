Aplicar a migração `supabase/migrations/20260507200000_fix_create_quote_version_client_id.sql` que atualiza a função RPC `create_quote_version` para copiar todos os campos de metadados ao criar nova versão:

- client_id
- client_phone
- notes
- attention_to
- hidden_extras_value
- freight_value
- freight_type_id
- tags
- main_quantity

Sem alterações de código frontend — somente migração SQL.