## Problema
O orçamento `2026-010` (id `b23e4d0f...`) ficou com `is_locked = true` após a versão filha ter sido criada e depois excluída. Sem destravar, o sistema não permite editar nem gerar nova versão.

## Correção pontual
Rodar UPDATE destravando este orçamento específico:

```sql
UPDATE public.quotes
   SET is_locked = false, updated_at = now()
 WHERE id = 'b23e4d0f-19b7-4840-978c-5e988fe6744a';
```

## Correção estrutural (para não acontecer de novo)
Adicionar trigger em `public.quotes`: quando uma versão filha for DELETADA, destravar automaticamente o `parent_quote_id` se ele não tiver mais nenhuma versão filha existente.

```sql
CREATE OR REPLACE FUNCTION public.unlock_parent_on_version_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.parent_quote_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.quotes
       WHERE parent_quote_id = OLD.parent_quote_id AND id <> OLD.id
    ) THEN
      UPDATE public.quotes
         SET is_locked = false, updated_at = now()
       WHERE id = OLD.parent_quote_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_unlock_parent_on_version_delete ON public.quotes;
CREATE TRIGGER trg_unlock_parent_on_version_delete
AFTER DELETE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.unlock_parent_on_version_delete();
```

Sem alterações de código frontend.