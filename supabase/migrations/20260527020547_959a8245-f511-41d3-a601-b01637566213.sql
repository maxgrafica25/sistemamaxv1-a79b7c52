ALTER TABLE public.cv_quote_items DROP CONSTRAINT IF EXISTS cv_quote_items_material_id_fkey;
ALTER TABLE public.cv_quote_items DROP CONSTRAINT IF EXISTS cv_quote_items_printer_id_fkey;

ALTER TABLE public.cv_quote_items
  ADD CONSTRAINT cv_quote_items_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES public.cv_calc_midias(id) ON DELETE SET NULL;

ALTER TABLE public.cv_quote_items
  ADD CONSTRAINT cv_quote_items_printer_id_fkey
  FOREIGN KEY (printer_id) REFERENCES public.cv_calc_impressoes(id) ON DELETE SET NULL;