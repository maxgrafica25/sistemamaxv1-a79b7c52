# Ajuste de contraste global

## Objetivo
Tornar a separação visual entre **fundo da página**, **cards/painéis** e **controles (inputs, botões, combobox)** mais forte em todo o sistema — tema claro e escuro — usando o /orcamentos-v2/novo como referência.

Os chips de "Acabamentos sugeridos" permanecem como já estão hoje (pill roxo com borda tracejada + ícone +).

## Escopo
- Editar **apenas tokens** em `src/index.css` (`:root` e `.dark`).
- Nenhuma alteração em componentes individuais, lógica de negócio, ou nos chips de acabamento.
- Como tudo o resto do sistema usa `bg-background`, `bg-card`, `bg-muted`, `border-border`, `bg-input`, etc., a mudança se propaga sozinha.

## Alterações

### Tema escuro (`.dark`) — referência principal
| Token | Atual | Novo | Motivo |
|---|---|---|---|
| `--background` | `0 0% 7%` | `270 18% 8%` | Fundo levemente roxo (tom da marca), mais profundo |
| `--card` | `0 0% 10%` | `270 14% 13%` | Card visivelmente acima do fundo |
| `--popover` | `0 0% 10%` | `270 14% 14%` | Igual ao card |
| `--secondary` | `0 0% 14%` | `270 12% 17%` | Mais distinto |
| `--muted` | `0 0% 16%` | `270 10% 18%` | Áreas suaves perceptíveis |
| `--muted-foreground` | `0 0% 65%` | `270 8% 72%` | Texto secundário mais legível |
| `--border` | `0 0% 18%` | `270 14% 22%` | Bordas visíveis mas discretas |
| `--input` | `0 0% 18%` | `270 14% 22%` | Inputs destacados do card |

### Tema claro (`:root`) — ajuste leve
| Token | Atual | Novo | Motivo |
|---|---|---|---|
| `--background` | `210 40% 98%` | `270 30% 97%` | Tom levemente roxo, mais coeso com a marca |
| `--muted` | `210 40% 94%` | `270 25% 94%` | Mantém suavidade com tom da marca |
| `--secondary` | `210 40% 96%` | `270 25% 95%` | Mesma família de cor |
| `--border` | `214 32% 91%` | `270 20% 89%` | Levemente mais escura → mais visível |
| `--input` | `214 32% 91%` | `270 20% 89%` | Igual border |

`--card` no claro permanece `0 0% 100%` (branco puro contrastando com o fundo levemente roxo).

## Fora de escopo
- Botões de acabamento e chips de sugestão (mantidos como hoje).
- Sidebar tokens (já estão coerentes; sem mudança).
- Qualquer override `text-gray-*` ou cor literal em componentes específicos — não vou caçar isso nesta passada.

## Validação
Após aplicar, abrir Dashboard, Estoque, Orçamentos V2/V3, Pedidos e Configurações em ambos os temas e conferir que cards/inputs/botões ficam visivelmente separados do fundo.
