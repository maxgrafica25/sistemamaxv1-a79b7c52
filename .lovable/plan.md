

# Trocas de toner por consumível + apresentação contextual da Júlia

## O que muda

Três alterações isoladas, sem tocar em fórmula de preços, autenticação, Zod ou Camada 2 da Edge Function.

### 1. Migration de banco

Novo arquivo `supabase/migrations/<timestamp>_printer_readings_consumable_id.sql`:

```sql
ALTER TABLE public.printer_readings
  ADD COLUMN IF NOT EXISTS consumable_id uuid REFERENCES public.equipment_consumables(id);
```

Coluna nullable — leituras antigas continuam válidas como "troca genérica".

### 2. Edge Function `assistente-virtual/index.ts` — Camada 1 (apresentação)

Substituir o bloco atual de identidade ("Você é a Júlia... Quando se apresentar...") por:

> **IDENTIDADE:** Você é a Júlia, assistente virtual da Max Gráfica.  
> Só se apresente ("Me chamo Júlia e trabalho na Max Gráfica.") se:  
> - O usuário fizer uma saudação ("oi", "olá", "bom dia", etc.), ou  
> - O usuário perguntar diretamente quem você é ou como se chama.  
> Em qualquer outra pergunta, responda diretamente sem se apresentar.

Resto da Camada 1 (regras de PV, desambiguação por equipamento) permanece intacto.

### 3. Edge Function — cálculo de troca por consumível

**a) Adicionar `consumable_id` ao SELECT de `printer_readings`:**

```ts
admin
  .from("printer_readings")
  .select("equipment_id,consumable_id,total_prints,type,reading_time")
  .order("reading_time", { ascending: false })
  .limit(500)
```

**b) Substituir `lastTonerChangeByEq` por `Map<equipmentId, Map<consumableId|"__generic__", total_prints>>`:**

```ts
const lastTonerChangeByConsumable = new Map<string, Map<string, number>>();
for (const r of readings) {
  if (!r.equipment_id || r.total_prints == null) continue;
  if (!lastReadingByEq.has(r.equipment_id)) lastReadingByEq.set(r.equipment_id, r.total_prints);
  if (r.type === "toner_change") {
    const byEq = lastTonerChangeByConsumable.get(r.equipment_id) ?? new Map();
    const key = r.consumable_id ?? "__generic__";
    if (!byEq.has(key)) byEq.set(key, r.total_prints);
    lastTonerChangeByConsumable.set(r.equipment_id, byEq);
  }
}
```

**c) No loop de consumíveis, buscar troca específica → fallback genérico → nada, e formatar conforme o caso:**

```
• Toner Ciano: rendimento real a 20%: 8.750 pgs
    Impressões desde troca deste toner: 320 | Estimativa restante: ~8.430 pgs
```

```
• Toner Ciano: rendimento real a 20%: 8.750 pgs
    Estimativa restante: ~8.730 pgs (baseado na última troca registrada sem especificar cor)
```

```
• Toner Ciano: rendimento real a 20%: 8.750 pgs
    Nenhuma troca registrada — estimativa indisponível
```

Não-toners (revelador/cilindro/belt/fusor) seguem inalterados — não dependem de troca.

## Não muda
- Fórmula `calcPV` / `getEffectivePrintingCost` / `getEquipmentCostPerPage`
- Camada 2 (base de conhecimento) e seções de papéis/preços da Camada 3
- Auth, Zod, CORS
- UI da `PrinterReadingsTab` (gravar `consumable_id` nas trocas fica para uma próxima iteração — coluna nullable garante compatibilidade)

## Validação após deploy

1. Abrir Júlia sem mandar mensagem → ela não se apresenta.
2. "oi" → apresenta-se.
3. "quanto falta no toner ciano da C70?" → responde direto, sem apresentação, citando estimativa.
4. Inserir manualmente em `printer_readings` uma linha `type='toner_change'` com `consumable_id` do ciano e outra do magenta → perguntar de cada cor → estimativas distintas.
5. Trocas antigas (sem `consumable_id`) seguem aparecendo como fallback genérico.

## Risco

Baixo. Coluna nova é nullable, formatação textual é aditiva, apresentação fica condicional via prompt.

