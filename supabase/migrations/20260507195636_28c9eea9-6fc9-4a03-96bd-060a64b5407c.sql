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