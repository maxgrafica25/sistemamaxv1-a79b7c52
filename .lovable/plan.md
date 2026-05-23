## Adicionar descrições explicativas nas abas de Produção

Cada aba do módulo Produção ganhará uma linha curta de descrição logo abaixo do `DotTabs`, padronizada visualmente para orientar o usuário sem poluir.

### Padrão visual
- Componente: um único `<p>` com ícone Lucide pequeno + texto.
- Classes: `mb-4 flex items-center gap-2 text-xs text-muted-foreground`
- Ícone: `h-3.5 w-3.5` (mesmo tom muted).
- Renderiza condicionalmente conforme `activeTab`.

### Textos por aba

| Aba | Ícone | Texto |
|---|---|---|
| Etapas | `Clock` | "Cadastre cada etapa do processo de produção e o tempo estimado (em minutos) que ela leva para ser executada." |
| Acabamentos | `Sparkles` | "Acabamentos aplicáveis aos produtos (laminação, verniz, corte especial, etc.) com seu custo e tempo." |
| Grupos de Etapas | `Layers` | "Agrupe várias etapas em uma sequência reutilizável — útil para detalhar o passo-a-passo de uma etapa no orçamento." |
| Grupos de Materiais | `Layers` | "Conjuntos de materiais (papéis, insumos) que podem ser referenciados em conjunto nos orçamentos." |
| Kits de Produto | `Sparkles` | "Combinações pré-montadas de etapas + materiais que viram atalhos para criar orçamentos rapidamente." |

### Implementação
1. Em `src/pages/ProcessosProducao.tsx`, criar um pequeno mapa `tabDescriptions: Record<TabKey, { icon: LucideIcon; text: string }>`.
2. Renderizar a linha de descrição imediatamente após `<DotTabs />` e antes do conteúdo da aba ativa.
3. Sem alterações em lógica, rotas, dados ou nos componentes das abas — apenas frontend/UI no arquivo `ProcessosProducao.tsx`.