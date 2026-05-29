-- 1. Permissoes_Disponiveis (Permissions Catalog)
-- Adding it with empresa_id to satisfy tenant enforcement if it's not global
CREATE TABLE IF NOT EXISTS public.permissoes_disponiveis (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    chave TEXT NOT NULL UNIQUE,
    descricao_amigavel TEXT NOT NULL,
    categoria TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Grupos (Groups/Roles)
CREATE TABLE IF NOT EXISTS public.grupos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Usuario_Grupos (User-Group Relationship)
CREATE TABLE IF NOT EXISTS public.usuario_grupos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, grupo_id)
);

-- 4. Permissoes_Grupo (Group-Level Permissions)
CREATE TABLE IF NOT EXISTS public.permissoes_grupo (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    permissao_chave TEXT NOT NULL REFERENCES public.permissoes_disponiveis(chave) ON DELETE CASCADE,
    habilitada BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(grupo_id, permissao_chave)
);

-- 5. Permissoes_Usuario (Individual Overrides)
CREATE TABLE IF NOT EXISTS public.permissoes_usuario (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    permissao_chave TEXT NOT NULL REFERENCES public.permissoes_disponiveis(chave) ON DELETE CASCADE,
    habilitada BOOLEAN DEFAULT false,
    origem TEXT DEFAULT 'individual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, permissao_chave)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_grupos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_disponiveis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_grupo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_usuario TO authenticated;

GRANT ALL ON public.grupos TO service_role;
GRANT ALL ON public.usuario_grupos TO service_role;
GRANT ALL ON public.permissoes_disponiveis TO service_role;
GRANT ALL ON public.permissoes_grupo TO service_role;
GRANT ALL ON public.permissoes_usuario TO service_role;

-- Enable RLS
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissoes_disponiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissoes_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissoes_usuario ENABLE ROW LEVEL SECURITY;

-- Create function to resolve permissions
CREATE OR REPLACE FUNCTION public.verificar_permissao(p_user_id UUID, p_permissao_chave TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_individual_habilitada BOOLEAN;
    v_grupo_habilitada BOOLEAN;
BEGIN
    -- 1. Check individual override
    SELECT habilitada INTO v_individual_habilitada
    FROM public.permissoes_usuario
    WHERE user_id = p_user_id AND permissao_chave = p_permissao_chave;

    IF v_individual_habilitada IS NOT NULL THEN
        RETURN v_individual_habilitada;
    END IF;

    -- 2. Check group permissions
    SELECT EXISTS (
        SELECT 1
        FROM public.permissoes_grupo pg
        JOIN public.usuario_grupos ug ON pg.grupo_id = ug.grupo_id
        WHERE ug.user_id = p_user_id 
        AND pg.permissao_chave = p_permissao_chave
        AND pg.habilitada = true
    ) INTO v_grupo_habilitada;

    RETURN v_grupo_habilitada;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
CREATE POLICY "Admins can manage grupos" ON public.grupos
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage usuario_grupos" ON public.usuario_grupos
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage permissoes_disponiveis" ON public.permissoes_disponiveis
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage permissoes_grupo" ON public.permissoes_grupo
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage permissoes_usuario" ON public.permissoes_usuario
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed data for permissions catalog
-- Using current_empresa_id() if available, else NULL (if RLS allows)
DO $$
DECLARE
    v_empresa_id UUID;
BEGIN
    -- Try to get one empresa_id to populate initial data, or it might need to be done per-company
    SELECT id INTO v_empresa_id FROM public.empresas LIMIT 1;
    
    INSERT INTO public.permissoes_disponiveis (chave, descricao_amigavel, categoria, empresa_id) VALUES
    ('ver_lista_usuarios', 'Ver lista de usuários', 'Usuários', v_empresa_id),
    ('gerenciar_usuarios', 'Criar, editar e excluir usuários', 'Usuários', v_empresa_id),
    ('acessar_financeiro', 'Acessar painel financeiro', 'Financeiro', v_empresa_id),
    ('exportar_relatorios_financeiros', 'Exportar relatórios financeiros', 'Financeiro', v_empresa_id),
    ('criar_orcamento', 'Criar novos orçamentos', 'Orçamentos', v_empresa_id),
    ('editar_orcamento', 'Editar orçamentos existentes', 'Orçamentos', v_empresa_id),
    ('aprovar_orcamento', 'Aprovar orçamentos', 'Orçamentos', v_empresa_id),
    ('excluir_orcamento', 'Excluir orçamentos', 'Orçamentos', v_empresa_id),
    ('acessar_configuracoes', 'Acessar configurações do sistema', 'Configurações', v_empresa_id)
    ON CONFLICT (chave) DO NOTHING;
END $$;
