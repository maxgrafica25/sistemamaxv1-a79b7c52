ALTER TABLE public.equipment_consumables
ADD COLUMN mode text NOT NULL DEFAULT 'shared';

COMMENT ON COLUMN public.equipment_consumables.mode IS 'shared = used in both BW and Color; color_only = used only in Color printing';