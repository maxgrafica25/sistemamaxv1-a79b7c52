CREATE TABLE public.cv_calc_acabamento_media_order (
  acabamento_id uuid NOT NULL REFERENCES public.cv_calc_acabamentos(id) ON DELETE CASCADE,
  tipo_midia text NOT NULL CHECK (tipo_midia IN ('lona','adesivo','chapa','outro')),
  sort_order integer NOT NULL DEFAULT 0,
  visivel boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (acabamento_id, tipo_midia)
);

CREATE INDEX idx_cv_media_order_midia ON public.cv_calc_acabamento_media_order(tipo_midia, sort_order);

ALTER TABLE public.cv_calc_acabamento_media_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY cv_media_order_select
  ON public.cv_calc_acabamento_media_order FOR SELECT
  TO authenticated USING (true);

CREATE POLICY cv_media_order_admin_all
  ON public.cv_calc_acabamento_media_order FOR ALL
  TO authenticated
  USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE TRIGGER trg_cv_media_order_updated
  BEFORE UPDATE ON public.cv_calc_acabamento_media_order
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();