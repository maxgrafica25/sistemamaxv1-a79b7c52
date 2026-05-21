
## Objetivo

Reduzir a sobrecarga cognitiva da sidebar de **7 grupos / ~20 itens** para **5 grupos / ~12 itens visíveis**, agrupando por verbos que combinam com a cabeça do usuário (vendedor, orçamentista, financeiro) em vez de espelhar tabelas do banco. Esconder ruído de versionamento (V2/V3) e mover Kits para onde ele realmente pertence: junto dos insumos que o compõem.

## Nova Arquitetura de Informação

```text
🏠 Hoje                            ← home unificada (híbrida)

VENDER
  • Pedidos
  • Orçamentos                     ← V3 entra como padrão; V2 vira /orcamentos?legacy=1
  • Chat Interno

CATÁLOGO
  • Insumos                        ← Matérias-Primas com abas internas:
                                       [Materiais] [Grupos] [Kits de Produto]
  • Contatos                       ← Clientes/Fornecedores renomeado
  • Equipamentos
  • Comunicação Visual

FINANCEIRO  (visível só p/ role financeiro)
  • Contas a Receber
  • Despesas Fixas

PRECIFICAÇÃO
  • Preço Impressão
  • Acabamentos
  • Cálculo Etiquetas
  • Processos de Produção

ADMINISTRAÇÃO  (compacta, no rodapé)
  • Configurações
  • Usuários (admin)
  • Auditoria (admin)
  • Monitoramento + Produtos Ref (admin, agrupados em "Inteligência")
```

**Itens REMOVIDOS da sidebar (mas rotas preservadas):**
- "Grupos de Materiais" — vira aba dentro de Insumos
- "Kits de Produto" — vira aba dentro de Insumos
- "Orçamentos V2" — substituído por "Orçamentos" (V3)
- "Orçamentos V3 (Beta)" — perde o badge Beta e vira o padrão

## Mudanças por arquivo

### 1. `src/components/Sidebar.tsx`
Reescrever a constante `NAV_GROUPS` seguindo o novo IA acima. Manter o sistema atual de:
- `adminOnly` / `financeiroOnly` por item
- Layout colapsável (mini-rail com tooltips)
- Highlight ativo com barra lateral roxa
- Footer com perfil + logout + recolher

Aplicar visual do protótipo escolhido (Linear minimal): grupos com label em uppercase tracking-wider, item ativo em `bg-primary/10` com borda `border-primary/20`, ícones em `lucide-react` mantidos, dot indicador no item "Hoje" quando há ações pendentes.

### 2. `src/App.tsx` — rotas
- Adicionar redirect: `/grupos-materiais` → `/materias-primas?tab=grupos`
- Adicionar redirect: `/kits-produto` → `/materias-primas?tab=kits`
- Manter `/orcamentos-v2` acessível diretamente (sem item na sidebar) para fallback durante a transição
- Rota `/orcamentos` aponta direto para V3 quando V3 ficar estável (decisão futura — por enquanto mantém V2 como padrão para não quebrar fluxo de vendas)

### 3. `src/pages/MateriasPrimas.tsx` — virar hub "Insumos"
- Adicionar `<Tabs>` no topo com três abas: **Materiais**, **Grupos**, **Kits de Produto**
- Cada aba renderiza o conteúdo existente das páginas atuais (extrair lógica de `GruposMateriais.tsx` e `KitsProduto.tsx` para componentes reutilizáveis se ainda não estiverem)
- Aba inicial via querystring `?tab=`
- Título da página vira "Insumos" com subtítulo "Materiais, grupos e kits prontos para orçamento"

### 4. `src/pages/Dashboard.tsx` — home híbrida "Hoje"
- Renomear título para **"Hoje"** com subtítulo "O que precisa da sua atenção agora"
- **Topo (novo)**: bloco "Ações pendentes" com cards clicáveis:
  - Orçamentos aguardando resposta do cliente (count + link)
  - Pedidos em produção hoje
  - Contas a receber vencendo nos próximos 3 dias (só p/ financeiro)
  - Alertas de estoque baixo (já existe — mover pra cá)
  - Manutenções de equipamento pendentes
- **Abaixo**: métricas resumidas atuais (Total/Aprovados/Aguardando) e Orçamentos Recentes — como já estão
- Respeitar regra da memória: dashboard sem botões de ação direta "agressivos" — cards são links contextuais, não CTAs financeiros

### 5. Renomeações cosméticas
- "Clientes/Fornecedores" → **"Contatos"**
- "Acabamentos (Etiquetas)" → **"Acabamentos"** (o contexto Etiquetas fica dentro da página)
- Badge "Beta" do V3 some

## Fora de escopo (deixar para depois)

- Reescrever Preço Impressão / Acabamentos / Calc Etiquetas / Processos em uma única tela "Precificação" (grande refactor — fica para fase 2)
- Mover edge cases de Auditoria/Monitoramento — só agrupar visualmente
- Mudar permissões de role — apenas reaplicar as flags atuais
- Mexer em lógica de negócio, cálculos ou banco

## Como o usuário percebe

| Antes | Depois |
|---|---|
| 7 grupos, "Cadastros" enorme, dois Orçamentos | 5 grupos por ação, um Orçamentos |
| Kit perdido em menu separado | Kit aparece junto com materiais que ele usa |
| Dashboard com métricas | "Hoje" com inbox de ações + métricas |
| Versionamento exposto (V2/V3/Beta) | Só "Orçamentos" |

## Riscos & mitigação

- **Usuários com links salvos para `/kits-produto` ou `/grupos-materiais`** → redirects preservam acesso
- **Quebra de muscle memory** → mudança é só visual/IA, todos os fluxos antigos continuam funcionando pelas mesmas URLs
- **V2 sumindo do menu** → V2 continua acessível via `/orcamentos-v2`, e podemos adicionar um toggle "Versão antiga" temporário se necessário
