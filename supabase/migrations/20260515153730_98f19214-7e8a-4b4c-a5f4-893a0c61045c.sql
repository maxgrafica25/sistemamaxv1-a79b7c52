-- Add cut-size flag and custom purchase sheet to papers
ALTER TABLE public.papers
  ADD COLUMN is_cut_size boolean NOT NULL DEFAULT false,
  ADD COLUMN purchase_sheet_width_mm numeric NULL,
  ADD COLUMN purchase_sheet_height_mm numeric NULL;

-- Migrate any existing flags from printing_price_items into papers (match by name+grammage)
UPDATE public.papers p
SET is_cut_size = true
WHERE EXISTS (
  SELECT 1 FROM public.printing_price_items i
  WHERE lower(trim(i.paper_type)) = lower(trim(p.name))
    AND COALESCE(lower(trim(i.grammage)), '') = COALESCE(lower(trim(p.grammage)), '')
    AND i.is_cut_size = true
);

UPDATE public.papers p
SET purchase_sheet_width_mm = sub.w,
    purchase_sheet_height_mm = sub.h
FROM (
  SELECT DISTINCT ON (lower(trim(paper_type)), COALESCE(lower(trim(grammage)),''))
    paper_type, grammage,
    purchase_sheet_width_mm AS w,
    purchase_sheet_height_mm AS h
  FROM public.printing_price_items
  WHERE purchase_sheet_width_mm IS NOT NULL AND purchase_sheet_height_mm IS NOT NULL
) sub
WHERE lower(trim(p.name)) = lower(trim(sub.paper_type))
  AND COALESCE(lower(trim(p.grammage)), '') = COALESCE(lower(trim(sub.grammage)), '');

-- Drop the misplaced columns from printing_price_items
ALTER TABLE public.printing_price_items
  DROP COLUMN IF EXISTS is_cut_size,
  DROP COLUMN IF EXISTS purchase_sheet_width_mm,
  DROP COLUMN IF EXISTS purchase_sheet_height_mm;