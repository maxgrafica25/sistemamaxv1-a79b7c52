
-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===== CORE TABLES =====

CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL, email TEXT NOT NULL, telefone TEXT NOT NULL, empresa TEXT,
  tipo text NOT NULL DEFAULT 'cliente', cnpj text, endereco text, numero text,
  complemento text, cep text, municipio text, estado text, observacoes text,
  tags text[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL, email TEXT NOT NULL, telefone TEXT NOT NULL, cnpj TEXT, endereco TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.monthly_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.monthly_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to monthly_expenses" ON public.monthly_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_monthly_expenses_updated_at BEFORE UPDATE ON public.monthly_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, salary NUMERIC NOT NULL DEFAULT 0, is_production BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to salaries" ON public.salaries FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_salaries_updated_at BEFORE UPDATE ON public.salaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.equipment_depreciation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, purchase_value NUMERIC NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL DEFAULT 60, residual_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_depreciation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to equipment_depreciation" ON public.equipment_depreciation FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_equipment_depreciation_updated_at BEFORE UPDATE ON public.equipment_depreciation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.productive_capacity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_employees INTEGER NOT NULL DEFAULT 0, hours_per_month NUMERIC NOT NULL DEFAULT 147,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.productive_capacity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to productive_capacity" ON public.productive_capacity FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_productive_capacity_updated_at BEFORE UPDATE ON public.productive_capacity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.productive_capacity (production_employees, hours_per_month) VALUES (0, 147);

-- ===== EQUIPMENT =====

CREATE TABLE public.equipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, description TEXT, printer_type text NOT NULL DEFAULT 'pb',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to equipments" ON public.equipments FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_equipments_updated_at BEFORE UPDATE ON public.equipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.equipment_consumables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  name TEXT NOT NULL, price NUMERIC NOT NULL DEFAULT 0, yield_pages INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_consumables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to equipment_consumables" ON public.equipment_consumables FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_equipment_consumables_updated_at BEFORE UPDATE ON public.equipment_consumables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.consumable_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_id uuid NOT NULL REFERENCES public.equipment_consumables(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0, yield_pages integer NOT NULL DEFAULT 0,
  change_date date DEFAULT CURRENT_DATE, notes text, created_at timestamptz DEFAULT now()
);
ALTER TABLE public.consumable_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to consumable_price_history" ON public.consumable_price_history FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.equipment_maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE, maintenance_type text NOT NULL DEFAULT 'preventiva',
  technician text NOT NULL DEFAULT '', total_counter integer,
  hours_spent numeric NOT NULL DEFAULT 0, cost numeric NOT NULL DEFAULT 0,
  replaced_parts text, service_description text NOT NULL DEFAULT '', notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_maintenances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to equipment_maintenances" ON public.equipment_maintenances FOR ALL USING (true) WITH CHECK (true);

-- ===== PAPERS =====

CREATE TABLE public.papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, grammage TEXT, sheet_qty INTEGER NOT NULL DEFAULT 0,
  pack_price NUMERIC NOT NULL DEFAULT 0, freight_price NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT, contact TEXT, quote_date DATE, is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to papers" ON public.papers FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_papers_updated_at BEFORE UPDATE ON public.papers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.paper_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  sheet_qty INTEGER NOT NULL DEFAULT 0, pack_price NUMERIC NOT NULL DEFAULT 0,
  freight_price NUMERIC NOT NULL DEFAULT 0, supplier TEXT, contact TEXT, quote_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.paper_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to paper_price_history" ON public.paper_price_history FOR ALL USING (true) WITH CHECK (true);

-- ===== PRINTER CATEGORIES =====

CREATE TABLE public.printer_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, description TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.printer_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to printer_categories" ON public.printer_categories FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_printer_categories_updated_at BEFORE UPDATE ON public.printer_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.markup_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_category_id UUID NOT NULL REFERENCES public.printer_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL, min_qty INTEGER NOT NULL DEFAULT 1, max_qty INTEGER,
  fixed_cost_pct NUMERIC NOT NULL DEFAULT 40, variable_cost_pct NUMERIC NOT NULL DEFAULT 13,
  margin_pct NUMERIC NOT NULL DEFAULT 33, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.markup_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to markup_tiers" ON public.markup_tiers FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_markup_tiers_updated_at BEFORE UPDATE ON public.markup_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.printing_price_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_category_id UUID NOT NULL REFERENCES public.printer_categories(id) ON DELETE CASCADE,
  code TEXT, paper_type TEXT NOT NULL, grammage TEXT,
  size TEXT NOT NULL DEFAULT 'A4', side TEXT NOT NULL DEFAULT 'F',
  paper_cost NUMERIC NOT NULL DEFAULT 0, printing_cost NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true, sort_order INTEGER NOT NULL DEFAULT 0,
  equipment_id UUID REFERENCES public.equipments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.printing_price_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to printing_price_items" ON public.printing_price_items FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_printing_price_items_updated_at BEFORE UPDATE ON public.printing_price_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== PRODUCTION =====

CREATE TABLE public.production_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL, time_minutes NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.production_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to production_steps" ON public.production_steps FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_production_steps_updated_at BEFORE UPDATE ON public.production_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.step_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.step_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to step_groups" ON public.step_groups FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_step_groups_updated_at BEFORE UPDATE ON public.step_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.step_group_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_group_id UUID NOT NULL REFERENCES public.step_groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL, time_minutes NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.step_group_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to step_group_items" ON public.step_group_items FOR ALL USING (true) WITH CHECK (true);

-- ===== QUOTES =====

CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL, client TEXT NOT NULL, product TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending',
  date DATE NOT NULL DEFAULT CURRENT_DATE, rejection_reason TEXT, validity TEXT, profit_margin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to quotes" ON public.quotes FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quote_labor_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL, time_minutes NUMERIC NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.quote_labor_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to quote_labor_steps" ON public.quote_labor_steps FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.quote_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL, quantity NUMERIC NOT NULL DEFAULT 0, unit_price NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.quote_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to quote_materials" ON public.quote_materials FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.quote_third_party (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL, supplier TEXT NOT NULL DEFAULT '', cost NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.quote_third_party ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to quote_third_party" ON public.quote_third_party FOR ALL USING (true) WITH CHECK (true);

-- ===== PRINTER READINGS =====

CREATE TABLE public.printer_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_model TEXT NOT NULL, date DATE NOT NULL DEFAULT CURRENT_DATE,
  counter INTEGER NOT NULL DEFAULT 0, color_prints INTEGER, bw_prints INTEGER, total_prints INTEGER,
  type TEXT NOT NULL DEFAULT 'daily', notes TEXT,
  equipment_id uuid REFERENCES public.equipments(id) ON DELETE CASCADE,
  operator_name text, copies_bw integer, reading_time timestamptz DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.printer_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to printer_readings" ON public.printer_readings FOR ALL USING (true) WITH CHECK (true);

-- ===== SUPPLIES =====

CREATE TABLE public.supplies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto TEXT NOT NULL, finalidade TEXT NOT NULL DEFAULT '',
  quantidade NUMERIC NOT NULL DEFAULT 0, valor NUMERIC NOT NULL DEFAULT 0,
  fornecedor TEXT NOT NULL DEFAULT '', valor_unitario NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE, contato TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to supplies" ON public.supplies FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_supplies_updated_at BEFORE UPDATE ON public.supplies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.supply_purchase_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
  produto TEXT NOT NULL, quantidade NUMERIC NOT NULL DEFAULT 0, valor NUMERIC NOT NULL DEFAULT 0,
  valor_unitario NUMERIC NOT NULL DEFAULT 0, fornecedor TEXT NOT NULL DEFAULT '',
  contato TEXT NOT NULL DEFAULT '', data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.supply_purchase_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to supply_purchase_history" ON public.supply_purchase_history FOR ALL USING (true) WITH CHECK (true);

-- ===== AUDIT LOGS =====

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL, entity_type text NOT NULL, entity_id text, entity_name text, details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to audit_logs" ON public.audit_logs FOR ALL TO public USING (true) WITH CHECK (true);

-- ===== AUTH PROFILES =====

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text NOT NULL, avatar_url text, role text NOT NULL DEFAULT 'colaborador',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_profile_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = 'admin')
$$;

-- ===== CHANNELS (created BEFORE policies that reference channel_members) =====

CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text, type text NOT NULL DEFAULT 'public',
  sector text, is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  linked_quote_id uuid REFERENCES public.quotes(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

-- NOW add policies that reference channel_members
CREATE OR REPLACE FUNCTION public.is_channel_creator(_user_id uuid, _channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.channels WHERE id = _channel_id AND created_by = _user_id)
$$;

CREATE POLICY "View channels" ON public.channels FOR SELECT TO authenticated USING (
  type = 'public'
  OR (type = 'direct' AND id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()))
  OR (type = 'private' AND id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Create channels" ON public.channels FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update channels" ON public.channels FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Delete channels" ON public.channels FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "View channel members" ON public.channel_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Add channel members" ON public.channel_members FOR INSERT TO authenticated
  WITH CHECK (public.is_profile_admin(auth.uid()) OR public.is_channel_creator(auth.uid(), channel_id));
CREATE POLICY "Remove channel members" ON public.channel_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_profile_admin(auth.uid()) OR is_channel_creator(auth.uid(), channel_id));

-- ===== MESSAGES =====

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL DEFAULT '', parent_message_id uuid REFERENCES public.messages(id),
  attachment_url text, attachment_name text, is_edited boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Edit own messages" ON public.messages FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View reactions" ON public.message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Add reactions" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Remove own reactions" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own reads" ON public.message_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert reads" ON public.message_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update reads" ON public.message_reads FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  pinned_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id)
);
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View pinned" ON public.pinned_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Pin messages" ON public.pinned_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Unpin messages" ON public.pinned_messages FOR DELETE TO authenticated USING (true);

-- ===== NOTIFICATIONS =====

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, title text NOT NULL, message text NOT NULL,
  type text NOT NULL DEFAULT 'info', source_type text, source_id uuid,
  is_read boolean NOT NULL DEFAULT false, due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.quote_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, interval_days integer NOT NULL DEFAULT 3,
  next_reminder_at timestamptz NOT NULL, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reminders" ON public.quote_reminders FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== REALTIME =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ===== STORAGE =====
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true);
CREATE POLICY "Auth upload chat attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');
CREATE POLICY "Auth view chat attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-attachments');

-- ===== DEFAULT DATA =====
INSERT INTO public.channels (name, description, type, sector) VALUES
  ('geral', 'Canal geral da empresa', 'public', null),
  ('atendimento', 'Equipe de atendimento ao cliente', 'public', 'Atendimento'),
  ('producao', 'Equipe de produção', 'public', 'Produção'),
  ('acabamento', 'Equipe de acabamento', 'public', 'Acabamento'),
  ('financeiro', 'Equipe financeira', 'public', 'Financeiro'),
  ('comercial', 'Equipe comercial', 'public', 'Comercial');
