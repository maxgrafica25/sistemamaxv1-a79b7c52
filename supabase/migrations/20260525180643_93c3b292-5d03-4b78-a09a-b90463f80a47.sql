
ALTER TABLE public.papers
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'comum';

ALTER TABLE public.papers
  DROP CONSTRAINT IF EXISTS papers_category_check;
ALTER TABLE public.papers
  ADD CONSTRAINT papers_category_check
  CHECK (category IN ('comum','especial','adesivo'));

UPDATE public.papers
   SET category = CASE
     WHEN lower(translate(name, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                                'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) ~ 'adesiv' THEN 'adesivo'
     WHEN lower(translate(name, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                                'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) ~ 'crach|pvc|cartao|couche|supremo|triplex' THEN 'especial'
     ELSE 'comum'
   END
 WHERE category = 'comum';

CREATE INDEX IF NOT EXISTS idx_papers_category ON public.papers(category);
