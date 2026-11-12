-- Signstar ecosolvente (impressão de grande formato, 1,90 m): não tem contador, mas as trocas de cabeça,
-- dampers e manutenções que a Júlia recebe pelo WhatsApp passam a aparecer em Equipamentos.
-- Tipo "Outro"; os consumíveis (tinta, cabeça) podem ser cadastrados depois na tela.
INSERT INTO public.equipments (empresa_id, name, description, printer_type, sort_order)
SELECT e.id, 'Signstar Ecosolvente', 'Impressão ecosolvente 1,90 m (cabeça XP600). Sem contador.', 'other',
       COALESCE((SELECT max(sort_order) + 1 FROM public.equipments q WHERE q.empresa_id = e.id), 0)
FROM public.empresas e
WHERE e.nome = 'Max Gráfica'
  AND NOT EXISTS (
    SELECT 1 FROM public.equipments q WHERE q.empresa_id = e.id AND lower(q.name) LIKE '%signstar%'
  );
