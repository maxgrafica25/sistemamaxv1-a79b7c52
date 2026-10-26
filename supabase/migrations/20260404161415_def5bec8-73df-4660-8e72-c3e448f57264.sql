-- A coluna existia no banco do Lovable mas nunca foi criada por migração.
-- 'color_only' = consumível que só gasta nas impressões coloridas; o resto é compartilhado.
ALTER TABLE public.equipment_consumables ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'shared';
