-- Add printer_type to equipments (pb, color, other)
ALTER TABLE equipments ADD COLUMN printer_type text NOT NULL DEFAULT 'pb';

-- Update existing equipment types based on description
UPDATE equipments SET printer_type = 'color' WHERE name ILIKE '%C70%' OR description ILIKE '%color%';
UPDATE equipments SET printer_type = 'other' WHERE name ILIKE '%Fargo%' OR description ILIKE '%crachá%' OR description ILIKE '%ribbon%';

-- Enhance printer_readings: link to equipment, add operator, copies_bw, reading_time
ALTER TABLE printer_readings ADD COLUMN equipment_id uuid REFERENCES equipments(id) ON DELETE CASCADE;
ALTER TABLE printer_readings ADD COLUMN operator_name text;
ALTER TABLE printer_readings ADD COLUMN copies_bw integer;
ALTER TABLE printer_readings ADD COLUMN reading_time timestamptz DEFAULT now();

-- Create consumable_price_history table
CREATE TABLE consumable_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_id uuid NOT NULL REFERENCES equipment_consumables(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  yield_pages integer NOT NULL DEFAULT 0,
  change_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE consumable_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to consumable_price_history"
  ON consumable_price_history FOR ALL TO public
  USING (true) WITH CHECK (true);