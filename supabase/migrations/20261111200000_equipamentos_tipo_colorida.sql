-- Equipamentos (11/11/2026): toda máquina colorida também imprime preto e branco, e o custo P&B
-- não pode incluir as cores. A Epson 5710 estava com tipo "Outro" e aparecia só com um custo
-- (todas as tintas somadas, rotulado como P&B). Correção dos cadastros:
-- 1) máquina que não é colorida/ribbon mas tem consumível só de cor (ou tinta/toner ciano, magenta,
--    amarelo pelo nome) passa a ser colorida;
-- 2) nas coloridas, consumível com nome de cor que ainda entra no P&B passa a "só colorida".
UPDATE public.equipments e
SET printer_type = 'color'
WHERE e.printer_type NOT IN ('color', 'ribbon')
  AND EXISTS (
    SELECT 1 FROM public.equipment_consumables c
    WHERE c.equipment_id = e.id
      AND (c.mode = 'color_only' OR c.name ~* '\m(ciano|cyan|magenta|amarel[oa]|yellow)\M')
  );

UPDATE public.equipment_consumables c
SET mode = 'color_only'
FROM public.equipments e
WHERE e.id = c.equipment_id
  AND e.printer_type = 'color'
  AND c.mode IS DISTINCT FROM 'color_only'
  AND c.name ~* '\m(ciano|cyan|magenta|amarel[oa]|yellow)\M';
