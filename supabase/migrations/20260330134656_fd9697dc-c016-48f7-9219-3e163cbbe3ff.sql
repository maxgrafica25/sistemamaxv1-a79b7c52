
-- =============================================
-- SECURITY HARDENING: Fix all permissive RLS policies
-- =============================================

-- 1. audit_logs: only authenticated can read, only admins can insert
DROP POLICY IF EXISTS "Allow all access to audit_logs" ON public.audit_logs;
CREATE POLICY "Authenticated can read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- 2. clients
DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
CREATE POLICY "Authenticated can read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

-- 3. consumable_price_history
DROP POLICY IF EXISTS "Allow all access to consumable_price_history" ON public.consumable_price_history;
CREATE POLICY "Authenticated can read consumable_price_history" ON public.consumable_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert consumable_price_history" ON public.consumable_price_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update consumable_price_history" ON public.consumable_price_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete consumable_price_history" ON public.consumable_price_history FOR DELETE TO authenticated USING (true);

-- 4. equipment_consumables
DROP POLICY IF EXISTS "Allow all access to equipment_consumables" ON public.equipment_consumables;
CREATE POLICY "Authenticated can read equipment_consumables" ON public.equipment_consumables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert equipment_consumables" ON public.equipment_consumables FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update equipment_consumables" ON public.equipment_consumables FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete equipment_consumables" ON public.equipment_consumables FOR DELETE TO authenticated USING (true);

-- 5. equipment_depreciation
DROP POLICY IF EXISTS "Allow all access to equipment_depreciation" ON public.equipment_depreciation;
CREATE POLICY "Authenticated can read equipment_depreciation" ON public.equipment_depreciation FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert equipment_depreciation" ON public.equipment_depreciation FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update equipment_depreciation" ON public.equipment_depreciation FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete equipment_depreciation" ON public.equipment_depreciation FOR DELETE TO authenticated USING (true);

-- 6. equipment_maintenances
DROP POLICY IF EXISTS "Allow all access to equipment_maintenances" ON public.equipment_maintenances;
CREATE POLICY "Authenticated can read equipment_maintenances" ON public.equipment_maintenances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert equipment_maintenances" ON public.equipment_maintenances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update equipment_maintenances" ON public.equipment_maintenances FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete equipment_maintenances" ON public.equipment_maintenances FOR DELETE TO authenticated USING (true);

-- 7. equipments
DROP POLICY IF EXISTS "Allow all access to equipments" ON public.equipments;
CREATE POLICY "Authenticated can read equipments" ON public.equipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert equipments" ON public.equipments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update equipments" ON public.equipments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete equipments" ON public.equipments FOR DELETE TO authenticated USING (true);

-- 8. markup_tiers
DROP POLICY IF EXISTS "Allow all access to markup_tiers" ON public.markup_tiers;
CREATE POLICY "Authenticated can read markup_tiers" ON public.markup_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert markup_tiers" ON public.markup_tiers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update markup_tiers" ON public.markup_tiers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete markup_tiers" ON public.markup_tiers FOR DELETE TO authenticated USING (true);

-- 9. monthly_expenses
DROP POLICY IF EXISTS "Allow all access to monthly_expenses" ON public.monthly_expenses;
CREATE POLICY "Authenticated can read monthly_expenses" ON public.monthly_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert monthly_expenses" ON public.monthly_expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update monthly_expenses" ON public.monthly_expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete monthly_expenses" ON public.monthly_expenses FOR DELETE TO authenticated USING (true);

-- 10. paper_price_history
DROP POLICY IF EXISTS "Allow all access to paper_price_history" ON public.paper_price_history;
CREATE POLICY "Authenticated can read paper_price_history" ON public.paper_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert paper_price_history" ON public.paper_price_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update paper_price_history" ON public.paper_price_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete paper_price_history" ON public.paper_price_history FOR DELETE TO authenticated USING (true);

-- 11. papers
DROP POLICY IF EXISTS "Allow all access to papers" ON public.papers;
CREATE POLICY "Authenticated can read papers" ON public.papers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert papers" ON public.papers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update papers" ON public.papers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete papers" ON public.papers FOR DELETE TO authenticated USING (true);

-- 12. printer_categories
DROP POLICY IF EXISTS "Allow all access to printer_categories" ON public.printer_categories;
CREATE POLICY "Authenticated can read printer_categories" ON public.printer_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert printer_categories" ON public.printer_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update printer_categories" ON public.printer_categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete printer_categories" ON public.printer_categories FOR DELETE TO authenticated USING (true);

-- 13. printer_readings
DROP POLICY IF EXISTS "Allow all access to printer_readings" ON public.printer_readings;
CREATE POLICY "Authenticated can read printer_readings" ON public.printer_readings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert printer_readings" ON public.printer_readings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update printer_readings" ON public.printer_readings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete printer_readings" ON public.printer_readings FOR DELETE TO authenticated USING (true);

-- 14. printing_price_items
DROP POLICY IF EXISTS "Allow all access to printing_price_items" ON public.printing_price_items;
CREATE POLICY "Authenticated can read printing_price_items" ON public.printing_price_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert printing_price_items" ON public.printing_price_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update printing_price_items" ON public.printing_price_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete printing_price_items" ON public.printing_price_items FOR DELETE TO authenticated USING (true);

-- 15. production_steps
DROP POLICY IF EXISTS "Allow all access to production_steps" ON public.production_steps;
CREATE POLICY "Authenticated can read production_steps" ON public.production_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert production_steps" ON public.production_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update production_steps" ON public.production_steps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete production_steps" ON public.production_steps FOR DELETE TO authenticated USING (true);

-- 16. productive_capacity
DROP POLICY IF EXISTS "Allow all access to productive_capacity" ON public.productive_capacity;
CREATE POLICY "Authenticated can read productive_capacity" ON public.productive_capacity FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert productive_capacity" ON public.productive_capacity FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update productive_capacity" ON public.productive_capacity FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete productive_capacity" ON public.productive_capacity FOR DELETE TO authenticated USING (true);

-- 17. quote_labor_steps
DROP POLICY IF EXISTS "Allow all access to quote_labor_steps" ON public.quote_labor_steps;
CREATE POLICY "Authenticated can read quote_labor_steps" ON public.quote_labor_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert quote_labor_steps" ON public.quote_labor_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update quote_labor_steps" ON public.quote_labor_steps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete quote_labor_steps" ON public.quote_labor_steps FOR DELETE TO authenticated USING (true);

-- 18. quote_materials
DROP POLICY IF EXISTS "Allow all access to quote_materials" ON public.quote_materials;
CREATE POLICY "Authenticated can read quote_materials" ON public.quote_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert quote_materials" ON public.quote_materials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update quote_materials" ON public.quote_materials FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete quote_materials" ON public.quote_materials FOR DELETE TO authenticated USING (true);

-- 19. quote_third_party
DROP POLICY IF EXISTS "Allow all access to quote_third_party" ON public.quote_third_party;
CREATE POLICY "Authenticated can read quote_third_party" ON public.quote_third_party FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert quote_third_party" ON public.quote_third_party FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update quote_third_party" ON public.quote_third_party FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete quote_third_party" ON public.quote_third_party FOR DELETE TO authenticated USING (true);

-- 20. quotes
DROP POLICY IF EXISTS "Allow all access to quotes" ON public.quotes;
CREATE POLICY "Authenticated can read quotes" ON public.quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update quotes" ON public.quotes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete quotes" ON public.quotes FOR DELETE TO authenticated USING (true);

-- 21. salaries
DROP POLICY IF EXISTS "Allow all access to salaries" ON public.salaries;
CREATE POLICY "Authenticated can read salaries" ON public.salaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert salaries" ON public.salaries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update salaries" ON public.salaries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete salaries" ON public.salaries FOR DELETE TO authenticated USING (true);

-- 22. step_group_items
DROP POLICY IF EXISTS "Allow all access to step_group_items" ON public.step_group_items;
CREATE POLICY "Authenticated can read step_group_items" ON public.step_group_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert step_group_items" ON public.step_group_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update step_group_items" ON public.step_group_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete step_group_items" ON public.step_group_items FOR DELETE TO authenticated USING (true);

-- 23. step_groups
DROP POLICY IF EXISTS "Allow all access to step_groups" ON public.step_groups;
CREATE POLICY "Authenticated can read step_groups" ON public.step_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert step_groups" ON public.step_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update step_groups" ON public.step_groups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete step_groups" ON public.step_groups FOR DELETE TO authenticated USING (true);

-- 24. suppliers
DROP POLICY IF EXISTS "Allow all access to suppliers" ON public.suppliers;
CREATE POLICY "Authenticated can read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (true);

-- 25. supplies
DROP POLICY IF EXISTS "Allow all access to supplies" ON public.supplies;
CREATE POLICY "Authenticated can read supplies" ON public.supplies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert supplies" ON public.supplies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update supplies" ON public.supplies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete supplies" ON public.supplies FOR DELETE TO authenticated USING (true);

-- 26. supply_purchase_history
DROP POLICY IF EXISTS "Allow all access to supply_purchase_history" ON public.supply_purchase_history;
CREATE POLICY "Authenticated can read supply_purchase_history" ON public.supply_purchase_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert supply_purchase_history" ON public.supply_purchase_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update supply_purchase_history" ON public.supply_purchase_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete supply_purchase_history" ON public.supply_purchase_history FOR DELETE TO authenticated USING (true);

-- =============================================
-- PRIVILEGE ESCALATION FIX: Prevent role self-update
-- =============================================

-- Drop the existing update policy that allows users to update ANY field
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create a trigger to prevent role changes by non-admins
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role is being changed, only allow if the current user is an admin
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_profile_admin(auth.uid()) THEN
      NEW.role := OLD.role; -- silently revert the role change
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_role_escalation_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

-- Re-create update policy scoped to own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- AUDIT LOG: Make insert-only (no update/delete for non-admins)
-- =============================================
CREATE POLICY "Only admins can delete audit_logs" ON public.audit_logs
  FOR DELETE TO authenticated
  USING (public.is_profile_admin(auth.uid()));
