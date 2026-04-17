ALTER TABLE public.historico_precos DROP CONSTRAINT IF EXISTS historico_precos_site_id_fkey;
ALTER TABLE public.historico_precos ADD CONSTRAINT historico_precos_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites_monitorados(id) ON DELETE CASCADE;

ALTER TABLE public.alertas_precos DROP CONSTRAINT IF EXISTS alertas_precos_site_id_fkey;
ALTER TABLE public.alertas_precos ADD CONSTRAINT alertas_precos_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites_monitorados(id) ON DELETE CASCADE;