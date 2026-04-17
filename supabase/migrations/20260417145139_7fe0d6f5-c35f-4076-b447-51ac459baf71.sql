
CREATE TABLE public.produtos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_canonico text NOT NULL,
  categoria text,
  dimensoes text,
  gramatura text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth all produtos_catalogo"
ON public.produtos_catalogo
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_produtos_catalogo_updated_at
BEFORE UPDATE ON public.produtos_catalogo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sites_monitorados
ADD COLUMN produto_catalogo_id uuid REFERENCES public.produtos_catalogo(id) ON DELETE SET NULL;

CREATE INDEX idx_sites_monitorados_produto_catalogo
ON public.sites_monitorados(produto_catalogo_id);
