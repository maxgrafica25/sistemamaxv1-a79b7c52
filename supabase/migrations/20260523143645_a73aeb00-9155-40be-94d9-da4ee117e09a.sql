CREATE TABLE public.product_kit_presets (
  kit_id uuid NOT NULL REFERENCES public.product_kits(id) ON DELETE CASCADE,
  preset_id uuid NOT NULL REFERENCES public.quote_presets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kit_id, preset_id)
);

CREATE INDEX idx_product_kit_presets_preset ON public.product_kit_presets(preset_id);
CREATE INDEX idx_product_kit_presets_kit ON public.product_kit_presets(kit_id);

ALTER TABLE public.product_kit_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read product_kit_presets"
  ON public.product_kit_presets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert product_kit_presets"
  ON public.product_kit_presets FOR INSERT TO authenticated
  WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins can delete product_kit_presets"
  ON public.product_kit_presets FOR DELETE TO authenticated
  USING (public.is_profile_admin(auth.uid()));

-- Seed: mapeia product_kind dos kits existentes para o preset correspondente
INSERT INTO public.product_kit_presets (kit_id, preset_id)
SELECT k.id, p.id
FROM public.product_kits k
JOIN public.quote_presets p ON (
  (k.product_kind = 'cartao_visita' AND p.nome = 'Cartão de Visita') OR
  (k.product_kind = 'apostila'      AND p.nome = 'Apostila') OR
  (k.product_kind = 'etiqueta'      AND p.nome = 'Etiqueta') OR
  (k.product_kind IN ('folheto','flyer') AND p.nome = 'Folheto / Flyer') OR
  (k.product_kind = 'adesivo'      AND p.nome = 'Adesivo' AND p.modulo = 'impressao') OR
  (k.product_kind = 'banner'       AND p.nome = 'Banner') OR
  (k.product_kind = 'lona'         AND p.nome = 'Lona') OR
  (k.product_kind = 'faixa'        AND p.nome = 'Faixa')
)
ON CONFLICT DO NOTHING;