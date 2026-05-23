## Auditoria

Mapeei todos os consumidores de `production_steps.time_minutes` no V3 e **todos já convertem `minutos × Valor da Hora de Trabalho`**:

| Consumidor | Arquivo | Conversão |
|---|---|---|
| Mão-de-obra avulsa | `forms/LaborForm.tsx` | `(time/60) × hourlyRate` |
| Acabamentos de Cartão de Visita | `forms/BusinessCardForm.tsx` (`procCost`) | `(min/60) × hourRate` |
| Acabamentos de Impressão | `forms/PrintForm.tsx` (gera `V3LaborItem` por etapa vinculada) | via `priceOfLabor` → `(min/60) × hourly_rate` |
| Acabamentos CV | `forms/CVForm.tsx` + `cv-calc/AcabamentosTab.tsx` | `(min/60) × cat.hourRate` |
| Kit de Produto | `shared/productKit.ts` | `(totalMin/60) × hourlyRate` |
| Kit Booklet/Apostila | `shared/bookletKit.ts` | `(totalMin/60) × hourlyRate` |
| Arte interna (tiers) | `shared/artStatus.ts` (implementado agora) | `(min/60) × hourRate` |
| Totalização final | `shared/pricing.ts → priceOfLabor` | `(min/60) × hourly_rate` |

**Logo, todo item cadastrado em Etapas que entrar em qualquer fluxo do orçamento gera custo em R$.** O risco residual é uma etapa ser salva com `time_minutes` zero ou nulo — aí ela aparece, mas não soma. O cadastro em `ProcessosProducao.tsx` já bloqueia (`time <= 0 → toast.error`), mas não há proteção no banco para inserções por outras vias.

## Mudanças propostas (proteção definitiva)

### 1. Trigger no banco para garantir `time_minutes > 0`

Migration: adicionar trigger `BEFORE INSERT OR UPDATE` em `production_steps` que falha quando `time_minutes IS NULL OR time_minutes <= 0`. (Trigger em vez de CHECK por conformidade com a memória do projeto.)

Mesma proteção em `cv_acabamento_labor.time_minutes` (somente quando `production_step_id IS NOT NULL` — entradas livres podem ter snapshot zero? — vou confirmar e ajustar.)

### 2. Backfill / aviso para dados existentes

Query opcional para listar (sem alterar) etapas atuais com `time_minutes = 0` para o usuário corrigir manualmente:
```
SELECT id, description FROM production_steps WHERE time_minutes IS NULL OR time_minutes <= 0;
```
Mostro o resultado no chat depois de aplicar a migration; se houver registros, o usuário decide se edita ou remove.

### 3. Reforço de UI

Em `ProcessosProducao.tsx` a validação já existe; nenhuma alteração necessária. Apenas remover qualquer caminho que permitisse `0` em `cv-calc/AcabamentosTab.tsx` (`patchLaborRow({time_minutes: +e.target.value || 0})` aceita zero) — exigir `> 0` antes de salvar (linha 310 já filtra, então não há risco em produção, mas o input aceita zero visualmente; deixar um aviso inline).

## Fora do escopo

- Não mexer nos cálculos já validados.
- Não alterar persistência de orçamentos antigos.

Confirma seguir com a migration + auditoria, ou prefere só o aviso visual?
