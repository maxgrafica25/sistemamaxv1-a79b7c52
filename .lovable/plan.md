## Problema

No mobile (e em qualquer viewport) não existe um botão claro de **Sair** do sistema. Quando o usuário cai numa tela de "Acesso restrito" (como Usuários sem ser admin), fica sem saída — precisa fechar a aba.

Hoje:
- O `Layout` mostra só ThemeToggle, sino de notificações e nome do usuário.
- A `Sidebar` não tem ação de logout no rodapé.
- O hook `useAuth` já expõe `signOut()` — está pronto para uso.

## Solução

Adicionar um **menu de usuário** (avatar/nome → dropdown) no header, com ação de **Sair**, e replicar a mesma ação no rodapé da sidebar mobile (mais visível com o dedo).

### 1. Menu de usuário no header (`src/components/Layout.tsx`)

Substituir o texto plano `{profile.display_name}` por um `DropdownMenu` (shadcn) acionado por avatar + nome:

- **Trigger:** avatar circular com inicial do nome + nome (oculto em telas muito pequenas, igual hoje).
- **Conteúdo do dropdown:**
  - Cabeçalho: nome completo + e-mail + badge do perfil (Admin/Colaborador).
  - Item "Configurações" → navega para `/configuracoes`.
  - Separador.
  - Item "Sair" (ícone `LogOut`, em vermelho) → chama `signOut()` e redireciona para `/auth`.

Visível em todos os tamanhos de tela (desktop e mobile).

### 2. Botão "Sair" no rodapé da Sidebar (`src/components/Sidebar.tsx`)

Adicionar, **acima** do botão "Recolher" (e visível também no mobile, onde "Recolher" está oculto):

- Bloco com avatar + nome do usuário + perfil (apenas quando expandido).
- Botão **Sair** (ícone `LogOut`) abaixo, ocupando largura total, estilo destrutivo sutil.
- Quando colapsado no desktop, vira só ícone com tooltip "Sair".

Isso garante que mesmo em mobile, com a sidebar aberta como drawer, o usuário tenha um logout óbvio.

### 3. Saída na tela "Acesso restrito" (`src/pages/Usuarios.tsx`)

Na Card de bloqueio, adicionar dois botões abaixo da mensagem:
- **Voltar ao Dashboard** (`navigate("/")`) — primário.
- **Sair** (`signOut()` + navigate `/auth`) — variante outline.

Cobre o caso específico do usuário ficar preso nessa tela.

### Detalhes técnicos

- Usar `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator` de `@/components/ui/dropdown-menu` (já existe).
- Avatar via `@/components/ui/avatar` (já existe) — fallback com inicial do `display_name`.
- `signOut` vem de `useAuth()`. Após chamar, usar `useNavigate()` para `/auth`.
- Ícone `LogOut` do `lucide-react`.
- Sem mudanças de banco, sem mudanças em rotas.

### Não incluído

- Não mexer em fluxo de autenticação, RLS ou roles.
- Não adicionar tela de perfil/edição — apenas link para Configurações existente.
