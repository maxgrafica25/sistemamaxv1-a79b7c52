
-- Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_name text,
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to audit_logs" ON public.audit_logs FOR ALL TO public USING (true) WITH CHECK (true);

-- Add type column to clients table (cliente/fornecedor)
ALTER TABLE public.clients ADD COLUMN tipo text NOT NULL DEFAULT 'cliente';
ALTER TABLE public.clients ADD COLUMN cnpj text;
ALTER TABLE public.clients ADD COLUMN endereco text;

-- Migrate suppliers data into clients table
INSERT INTO public.clients (nome, email, telefone, cnpj, endereco, tipo)
SELECT nome, email, telefone, cnpj, endereco, 'fornecedor' FROM public.suppliers;
