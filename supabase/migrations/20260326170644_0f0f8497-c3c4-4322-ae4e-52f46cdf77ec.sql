
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text NOT NULL,
  avatar_url text,
  role text NOT NULL DEFAULT 'colaborador',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Channels
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'public',
  sector text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  linked_quote_id uuid REFERENCES public.quotes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Channel members
CREATE TABLE public.channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL DEFAULT '',
  parent_message_id uuid REFERENCES public.messages(id),
  attachment_url text,
  attachment_name text,
  is_edited boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Message reactions
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Message reads
CREATE TABLE public.message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Pinned messages
CREATE TABLE public.pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  pinned_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id)
);

-- Trigger for auto profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "View channels" ON public.channels FOR SELECT TO authenticated USING (
  type = 'public' OR type = 'direct' AND id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())
  OR type = 'private' AND id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())
);
CREATE POLICY "Create channels" ON public.channels FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update channels" ON public.channels FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Delete channels" ON public.channels FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "View channel members" ON public.channel_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Add channel members" ON public.channel_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Remove channel members" ON public.channel_members FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR channel_id IN (SELECT id FROM public.channels WHERE created_by = auth.uid())
);

CREATE POLICY "View messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Edit own messages" ON public.messages FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "View reactions" ON public.message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Add reactions" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Remove own reactions" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "View own reads" ON public.message_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert reads" ON public.message_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update reads" ON public.message_reads FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "View pinned" ON public.pinned_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Pin messages" ON public.pinned_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Unpin messages" ON public.pinned_messages FOR DELETE TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true);
CREATE POLICY "Auth upload chat attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');
CREATE POLICY "Auth view chat attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-attachments');

-- Default channels
INSERT INTO public.channels (name, description, type, sector) VALUES
  ('geral', 'Canal geral da empresa', 'public', null),
  ('atendimento', 'Equipe de atendimento ao cliente', 'public', 'Atendimento'),
  ('producao', 'Equipe de produção', 'public', 'Produção'),
  ('acabamento', 'Equipe de acabamento', 'public', 'Acabamento'),
  ('financeiro', 'Equipe financeira', 'public', 'Financeiro'),
  ('comercial', 'Equipe comercial', 'public', 'Comercial');
