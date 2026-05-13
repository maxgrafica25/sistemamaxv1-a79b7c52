## Refino de Tokens de Cor — Light & Dark Mode

Edição pontual em `src/index.css` nas variáveis HSL do tema. Sem mudanças em componentes, lógica ou design system de marca (roxo permanece como `--primary`).

### 1. Light Mode (`:root`)

| Token | Antes | Depois | Motivo |
|---|---|---|---|
| `--background` | `0 0% 100%` (branco puro) | `210 40% 98%` (slate-50, gelo) | Fundo respirável, separa blocos por cor |
| `--card` | `0 0% 100%` | `0 0% 100%` (mantém branco puro) | Bloco "flutua" sobre o fundo gelo |
| `--popover` | `0 0% 100%` | `0 0% 100%` (mantém) | Idem |
| `--border` | `270 20% 88%` (tingido roxo) | `214 32% 91%` (slate-200, neutro) | Limite sutil sem peso |
| `--input` | `270 20% 88%` | `214 32% 91%` | Coerência com border |
| `--muted` | `270 20% 92%` | `210 40% 94%` | Neutralizar fundo de áreas mudas |
| `--secondary` | `270 20% 96%` | `210 40% 96%` | Neutralizar |

Foreground, primary (roxo), accent (laranja), success/warning/danger e sidebar permanecem inalterados.

### 2. Dark Mode (`.dark`)

Substituir o "tinte roxo" do fundo por preto/cinza chumbo neutro. Roxo continua só como acento (`--primary`, ring, sidebar-primary).

| Token | Antes | Depois |
|---|---|---|
| `--background` | `270 40% 10%` | `0 0% 7%` (quase preto neutro) |
| `--card` | `270 40% 13%` | `0 0% 10%` (cinza chumbo, destaca do fundo) |
| `--popover` | `270 40% 13%` | `0 0% 10%` |
| `--secondary` | `270 30% 18%` | `0 0% 14%` |
| `--muted` | `270 30% 20%` | `0 0% 16%` |
| `--muted-foreground` | `270 10% 60%` | `0 0% 65%` |
| `--border` | `270 30% 22%` | `0 0% 18%` |
| `--input` | `270 30% 22%` | `0 0% 18%` |

Mantidos no dark: `--primary` (roxo 270 70% 60%), `--ring`, `--accent` (laranja), success/warning/danger, sidebar (que já tem identidade própria slate + roxo).

### Arquivo afetado

- `src/index.css` — apenas tokens HSL nas duas blocos `:root` e `.dark`.

Sem alterações em Tailwind config, componentes, banco ou edge functions. Todos os componentes que já consomem `bg-background`, `bg-card`, `border`, etc. herdam automaticamente.