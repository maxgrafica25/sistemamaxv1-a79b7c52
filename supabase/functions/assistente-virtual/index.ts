// Edge Function: assistente-virtual
// Recebe { pergunta, historico } e chama Lovable AI Gateway com:
//  - System prompt em 3 camadas (comportamento + base de conhecimento + dados ao vivo)
//  - Histórico recente (últimas 10 mensagens)
// JWT é validado em código via getClaims() (verify_jwt = true por padrão).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Cobertura de referência do fabricante (yield_pages cadastrado no banco) vs cobertura real da gráfica
const COVERAGE_REFERENCE = 5;    // % — valor de fábrica cadastrado em yield_pages
const COVERAGE_OPERATIONAL = 20; // % — cobertura real da gráfica

// Classificação estrita por nome: só é toner o que contém "toner".
// Exclusões explícitas evitam falso-positivo (ex.: "Revelador color").
const isTonerConsumable = (c: { name: string }): boolean => {
  const n = (c?.name || "").toLowerCase();
  if (/revelador|cilindro|belt|fusor|manuten|deprecia|ribbon|fita/i.test(n)) return false;
  return /toner/i.test(n);
};

const realYieldPages = (c: { name: string; yield_pages: number }): number => {
  const y = Number(c?.yield_pages || 0);
  if (!isTonerConsumable(c)) return y;
  return Math.floor(y * (COVERAGE_REFERENCE / COVERAGE_OPERATIONAL));
};

const BodySchema = z.object({
  pergunta: z.string().min(1).max(4000),
  historico: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .default([]),
});

function fmtBRL(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return "—";
  return "R$ " + Number(n).toFixed(2).replace(".", ",");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1) Autenticação via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Validar body
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Dados inválidos", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { pergunta, historico } = parsed.data;

    // 3) Buscar dados ao vivo (admin client - bypass RLS para leitura agregada)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [bcRes, eqRes, consRes, readingsRes, ppRes, catsRes, tiersRes, papersRes, gsRes, gcalRes] =
      await Promise.all([
        admin.from("base_conhecimento").select("titulo,categoria,conteudo").eq("ativo", true),
        admin.from("equipments").select("id,name,description,printer_type").order("sort_order"),
        admin.from("equipment_consumables").select("id,equipment_id,name,price,yield_pages,mode"),
        admin
          .from("printer_readings")
          .select("equipment_id,consumable_id,total_prints,type,reading_time")
          .order("reading_time", { ascending: false })
          .limit(500),
        admin
          .from("printing_price_items")
          .select(
            "id,printer_category_id,equipment_id,markup_group_id,paper_type,grammage,size,side,paper_cost,printing_cost,equipment_mode",
          )
          .eq("is_active", true),
        admin.from("printer_categories").select("id,name,default_markup_group_id").order("sort_order"),
        admin
          .from("markup_tiers")
          .select(
            "id,printer_category_id,markup_group_id,label,min_qty,max_qty,fixed_cost_pct,variable_cost_pct,margin_pct,sort_order",
          )
          .order("sort_order"),
        admin
          .from("papers")
          .select("name,grammage,sheet_qty,pack_price,freight_price")
          .eq("is_active", true)
          .order("sort_order"),
        admin.from("global_settings").select("*").limit(1).maybeSingle(),
        admin
          .from("user_google_tokens")
          .select("email_google")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
      ]);

    const gcalConnected = !!gcalRes?.data;
    const gcalEmail = (gcalRes?.data as any)?.email_google ?? null;

    const bc = bcRes.data ?? [];
    const equipments = eqRes.data ?? [];
    const consumables = consRes.data ?? [];
    const readings = readingsRes.data ?? [];
    const pp = ppRes.data ?? [];
    const cats = catsRes.data ?? [];
    const tiers = tiersRes.data ?? [];
    const papers = papersRes.data ?? [];
    const gs = gsRes.data;

    // 4) Calcular impressões desde a última troca de toner POR CONSUMÍVEL
    // Map: equipmentId → Map(consumableId | "__generic__" → total_prints na última troca)
    const lastReadingByEq = new Map<string, number>();
    const lastTonerChangeByConsumable = new Map<string, Map<string, number>>();
    for (const r of readings as any[]) {
      if (!r.equipment_id || r.total_prints == null) continue;
      if (!lastReadingByEq.has(r.equipment_id)) {
        lastReadingByEq.set(r.equipment_id, r.total_prints);
      }
      if (r.type === "toner_change") {
        const byEq = lastTonerChangeByConsumable.get(r.equipment_id) ?? new Map<string, number>();
        const key = r.consumable_id ?? "__generic__";
        if (!byEq.has(key)) byEq.set(key, r.total_prints);
        lastTonerChangeByConsumable.set(r.equipment_id, byEq);
      }
    }

    // 5) Montar system prompt em 3 camadas
    // Data/hora atual em America/Sao_Paulo para resolução de expressões temporais
    const nowIsoUtc = new Date().toISOString();
    const nowSP = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date());

    const camada1 = `IDENTIDADE: Você é a Júlia, assistente virtual da Max Gráfica.
Só se apresente ("Me chamo Júlia e trabalho na Max Gráfica.") se:
- O usuário fizer uma saudação ("oi", "olá", "bom dia", etc.), ou
- O usuário perguntar diretamente quem você é ou como se chama.
Em qualquer outra pergunta, responda diretamente sem se apresentar.

Responda SEMPRE em português do Brasil, direta, sem rodeios.

Use SOMENTE as seções "BASE DE CONHECIMENTO" e "DADOS OPERACIONAIS" como fonte de verdade. Valores em R$ com vírgula decimal.

PREÇOS DE VENDA
Os preços estão pré-calculados na seção PREÇOS DE IMPRESSÃO por item e por faixa.
Para responder:
1. Localize o item EXATO casando paper_type + grammage + size + side + equipment_mode (e equipamento, se houver mais de um).
2. Identifique a faixa cujo intervalo cobre a quantidade pedida.
3. Cite o PV listado. Se houver quantidade, multiplique PV × quantidade.

Você NUNCA calcula, estima, aproxima nem aplica percentuais. Apenas localiza e cita.
Se o item ou a faixa não existir, responda: "Não encontrei esse item na tabela de preços."

DESAMBIGUAÇÃO POR EQUIPAMENTO:
Quando houver mais de um item com o MESMO papel + gramatura + tamanho + lado + modo em equipamentos diferentes, pergunte qual equipamento ou liste as opções com [Equipamento] e o PV de cada. Nunca escolha sozinho.

CONTEXTO TEMPORAL:
Agora é ${nowSP} (timezone America/Sao_Paulo, equivalente UTC ${nowIsoUtc}).
Use esta referência para converter expressões relativas como "amanhã", "sexta", "daqui a 2 horas" em data/hora absoluta antes de chamar ferramentas. Sempre converta para ISO 8601 com offset (ex.: "2026-04-23T17:00:00-03:00").

FERRAMENTAS DISPONÍVEIS (lembretes):
- create_reminder({ title, remind_at, description?, recurrence? }): cria um lembrete pessoal do usuário.
  • title: descrição curta (ex.: "Dentista").
  • remind_at: ISO 8601 com offset; deve ser futuro.
  • recurrence: "none" | "daily" | "weekly" | "monthly" (padrão "none").
- list_reminders(): lista lembretes pendentes do usuário.
- delete_reminder({ id }): remove lembrete pelo id (use list_reminders antes para descobrir o id).
- check_reminder_conflict({ remind_at, window_minutes?, exclude_id? }): verifica se há lembretes pendentes em ±window_minutes do horário proposto. Padrão window_minutes=15. Retorna { conflicts: [...] }.

REGRAS PARA FERRAMENTAS:
- Se o usuário pedir para "me lembrar de", "agendar", "anotar compromisso", chame create_reminder.
- Antes de criar, chame list_reminders e verifique se já existe lembrete pendente com título parecido. Se existir, pergunte ao usuário se quer (a) substituir o existente, (b) adicionar um novo mantendo o anterior, ou (c) cancelar. Não crie duplicata silenciosamente.
- Se faltar a data/hora, NÃO invente — pergunte ao usuário.
- COMPROMISSO COM HORÁRIO MARCADO (consulta, reunião, viagem, prazo, dentista, médico, entrega):
    • Se o usuário NÃO disse com quanto tempo de antecedência quer ser avisado, NÃO crie ainda. Sua resposta DEVE ter EXATAMENTE 2 linhas, sem nada antes, no meio ou depois:
      Linha 1 (literal, palavra por palavra, sem abreviar, sem reformular): Quando quer ser avisado?
      Linha 2 (literal, exatamente este marcador): [JULIA_CHIPS:lead_time]
      ✅ CORRETO:
        Quando quer ser avisado?
        [JULIA_CHIPS:lead_time]
      ❌ ERRADO (quebra a interface — NUNCA faça assim): responder só "Quando", "Quando?", "Quando você quer?", "Me diga quando", ou mesmo "Quando quer ser avisado?" sem o marcador na linha de baixo.
      O frontend usa o marcador para mostrar botões (Na hora / 1 hora antes / 3 horas antes / Personalizar). Sem o marcador em linha separada, os botões não aparecem e o usuário fica travado. Espere a resposta do usuário.
    • Quando o usuário responder a antecedência (ex.: "1 hora antes", "na hora", "45min", "2h"), aplique:
        - "na hora" / "no horário": remind_at = horário do compromisso, title = só o assunto (ex.: "Dentista").
        - "X antes": remind_at = horário do compromisso − X; title DEVE incluir o horário real (ex.: "Dentista às 14h"); description DEVE registrar o contexto (ex.: "Aviso 1h antes do compromisso das 14h.").
    • Confirme mencionando AMBOS os horários quando houver antecedência: "Pronto! Vou te avisar amanhã às 13h sobre seu dentista das 14h."
- Para "me avise X antes de Y" dito de uma vez (ex.: "me avise 2h antes do dentista das 14h"): pule a pergunta, já aplique as regras de título/descrição/remind_at acima.
- TAREFA AVULSA sem compromisso marcado ("me lembra de tomar água às 16h", "me lembra de comprar leite amanhã"): crie direto, remind_at = horário pedido, sem perguntar antecedência, sem mostrar chips.
- DETECÇÃO DE CONFLITO (obrigatório): IMEDIATAMENTE antes de chamar create_reminder com um remind_at já calculado, chame check_reminder_conflict com esse mesmo remind_at e window_minutes=15.
    • Se conflicts vier vazio: prossiga e chame create_reminder normalmente.
    • Se conflicts tiver itens: NÃO chame create_reminder ainda. Liste o(s) conflito(s) com título e horário em pt-BR e pergunte: "Quer marcar mesmo assim ou prefere outro horário?". Aguarde resposta.
        - Se o usuário confirmar (ex.: "pode marcar", "sim", "mesmo assim"): chame create_reminder com o remind_at original (sem checar conflito de novo).
        - Se pedir outro horário: peça/calcule o novo remind_at e refaça check_reminder_conflict antes de criar.
- Após executar, confirme em pt-BR repetindo título + data/hora amigável.
- Para excluir, se houver mais de um lembrete que casa, peça confirmação listando os candidatos com horário e descrição. Se o usuário pedir "apaga todos os X", liste e remova um a um chamando delete_reminder em sequência.
- Para "quais meus lembretes", chame list_reminders e formate em lista curta incluindo título, horário e descrição quando houver.
- INTEGRAÇÃO GOOGLE CALENDAR (one-way, Júlia → Google):
    • Os lembretes que você cria SEMPRE vão para o sistema interno (sininho de notificações).
    • Se o usuário tiver conectado a conta Google em Configurações → Integrações, eles também são enviados automaticamente para a agenda Google dele em até 1 minuto. Você NÃO lê eventos do Google Calendar — só envia.
    • Status atual da conexão deste usuário aparece em DADOS OPERACIONAIS na seção "GOOGLE CALENDAR DO USUÁRIO". Use esse dado para responder com a verdade:
        - Se conectado=true: "Sim, já mandei pra sua agenda do Google (conta <email>)." Nunca diga que não tem acesso.
        - Se conectado=false e o usuário perguntar sobre Google Calendar / agenda: "Salvei aqui no sistema. Pra também aparecer no seu Google Calendar, conecta sua conta em Configurações → Integrações. Depois disso, todo lembrete que eu criar pra você vira evento automaticamente." NUNCA responda só "não tenho acesso ao Google Calendar" sem explicar o caminho.
    • Ao confirmar a criação de um lembrete, se o usuário NÃO estiver conectado, acrescente UMA linha curta no fim da confirmação: "💡 Pra também salvar no seu Google Calendar, conecta em Configurações → Integrações." (apenas uma vez por sessão — se o histórico recente já mostra essa frase sua, não repita).
- NUNCA mencione o marcador [JULIA_CHIPS:...] em texto explicativo — ele é só uma diretiva técnica para o frontend.
- REGRA FINAL DE INTEGRIDADE: se a sua resposta for emitir um marcador [JULIA_CHIPS:...], ele é OBRIGATÓRIO em uma linha separada. Uma resposta que pergunta "Quando quer ser avisado?" SEM o marcador [JULIA_CHIPS:lead_time] na linha de baixo é considerada INCORRETA e quebra a interface do usuário. Sempre revise mentalmente antes de responder: "estou pedindo a antecedência? então preciso do marcador embaixo".`;

    const camada2 =
      bc.length > 0
        ? "## BASE DE CONHECIMENTO\n\n" +
          bc
            .map(
              (b: any) =>
                `### ${b.titulo}${b.categoria ? ` [${b.categoria}]` : ""}\n${b.conteudo}`,
            )
            .join("\n\n")
        : "## BASE DE CONHECIMENTO\n(vazia)";

    // Equipamentos + consumíveis com rendimento real (toner = yield × 5/20)
    // Trocas de toner são rastreadas por consumível específico (cor) com fallback genérico.
    const eqLines: string[] = [];
    const fmtNum = (n: number) => n.toLocaleString("pt-BR");
    for (const eq of equipments) {
      const tipo = eq.printer_type;
      const lastTotal = lastReadingByEq.get(eq.id);
      const byEqMap = lastTonerChangeByConsumable.get(eq.id);
      eqLines.push(
        `- **${eq.name}** (${tipo})${eq.description ? ` — ${eq.description}` : ""}` +
          (lastTotal != null ? ` | Contador atual: ${fmtNum(lastTotal)}` : ""),
      );

      const cons = consumables.filter((c: any) => c.equipment_id === eq.id);
      for (const c of cons) {
        const yFab = Number(c.yield_pages || 0);
        if (isTonerConsumable(c)) {
          const yReal = realYieldPages(c);
          let line = `    • ${c.name}: rendimento fabricante ${fmtNum(yFab)} pgs (${COVERAGE_REFERENCE}%) → rendimento real a ${COVERAGE_OPERATIONAL}%: ${fmtNum(yReal)} pgs`;

          // Buscar troca específica deste consumível; se não houver, fallback para troca genérica.
          const specificTotal = byEqMap?.get(c.id);
          const genericTotal = byEqMap?.get("__generic__");
          const lastTonerTotal = specificTotal ?? genericTotal;
          const isFallback = specificTotal == null && genericTotal != null;

          if (lastTotal != null && lastTonerTotal != null) {
            const desde = lastTotal - lastTonerTotal;
            const restante = Math.max(0, yReal - desde);
            if (isFallback) {
              line += `\n        Estimativa restante: ~${fmtNum(restante)} pgs (baseado na última troca registrada sem especificar cor)`;
            } else {
              line += `\n        Impressões desde troca deste toner: ${fmtNum(desde)} | Estimativa restante: ~${fmtNum(restante)} pgs`;
            }
          } else {
            line += `\n        Nenhuma troca registrada — estimativa indisponível`;
          }
          eqLines.push(line);
        } else {
          eqLines.push(`    • ${c.name}: rendimento ${fmtNum(yFab)} pgs (independe de cobertura)`);
        }
      }
    }

    const papLines = papers.map(
      (p: any) => `- ${p.name}${p.grammage ? ` ${p.grammage}` : ""}`,
    );

    // Preços agrupados por categoria + pré-cálculo de PV por faixa (mesma fórmula da página Preço de Impressão)
    const ppByCat = new Map<string, any[]>();
    for (const item of pp) {
      const arr = ppByCat.get(item.printer_category_id) ?? [];
      arr.push(item);
      ppByCat.set(item.printer_category_id, arr);
    }

    // Mapa de grupo padrão por categoria (igual a activeGroupId da página)
    const defaultGroupByCat = new Map<string, string | null>();
    for (const c of cats) defaultGroupByCat.set(c.id, c.default_markup_group_id ?? null);

    // Mapa de nome de equipamento por id (para desambiguar itens duplicados)
    const equipmentNameById = new Map<string, string>();
    for (const eq of equipments) equipmentNameById.set(eq.id, eq.name);

    const isLargerThanA4 = (size: string) => /^(A3|SRA3|A2|A1|A0)/i.test(size || "");
    // Mesmo arredondamento da página: para cima ao próximo R$ 0,05 (usado em printCost)
    const roundUp5 = (v: number) => Math.ceil(v * 20 - 1e-9) / 20;
    // Detecção de cobertura (igual à página)
    const isColorCategory = (name: string) => /color/i.test(name || "");
    const getCategoryCoverage = (name: string) => (isColorCategory(name) ? 20 : 5);

    // Mapa de categoria por id para descobrir o nome
    const categoryNameById = new Map<string, string>();
    for (const c of cats) categoryNameById.set(c.id, c.name);

    // Replica getEquipmentCostPerPage da página (linhas 215-233)
    const getEquipmentCostPerPage = (equipmentId: string, categoryCoverage = 20, forcePB?: boolean): number => {
      const eq = equipments.find((e: any) => e.id === equipmentId);
      const isRibbonPrinter = eq?.printer_type === "ribbon";
      if (isRibbonPrinter) {
        const cons = consumables.filter((c: any) => c.equipment_id === equipmentId);
        return cons.reduce((sum: number, c: any) => (c.yield_pages <= 0 ? sum : sum + Number(c.price) / Number(c.yield_pages)), 0);
      }
      const isColorPrinter = eq?.printer_type === "color";
      const usePB = forcePB ?? categoryCoverage <= 5;
      const coverage = isColorPrinter ? 20 : 5;
      const cons = consumables.filter((c: any) =>
        c.equipment_id === equipmentId && (usePB ? c.mode === "shared" : true)
      );
      const baseCost = cons.reduce((sum: number, c: any) => (c.yield_pages <= 0 ? sum : sum + Number(c.price) / Number(c.yield_pages)), 0);
      return baseCost * (coverage / 5);
    };

    // Replica getEffectivePrintingCost da página (linhas 237-240)
    const getEffectivePrintingCost = (item: any): number => {
      if (item.equipment_id) {
        const catName = categoryNameById.get(item.printer_category_id) || "";
        const coverage = getCategoryCoverage(catName);
        return getEquipmentCostPerPage(item.equipment_id, coverage, item.equipment_mode === "pb");
      }
      return Number(item.printing_cost || 0);
    };

    // Replica calcSellingPriceWithGlobals da página (linhas 83-88)
    const calcPV = (item: any, tier: any): number => {
      const printCostA4 = getEffectivePrintingCost(item);
      const sizeMult = isLargerThanA4(item.size) ? 2 : 1;
      const sideMult = item.side === "F/V" ? 2 : 1;
      const printCost = roundUp5(printCostA4 * sizeMult * sideMult);
      const baseCost = Number(item.paper_cost || 0) + printCost;
      const soma = (Number(tier.fixed_cost_pct || 0) + Number(tier.variable_cost_pct || 0) + Number(tier.margin_pct || 0)) / 100;
      const divisor = 1 - soma;
      if (divisor <= 0) return 0;
      return Math.round((baseCost / divisor) * 10) / 10;
    };

    // Replica getItemTiers da página: groupId = item.markup_group_id || default da categoria
    const tiersForItem = (item: any): any[] => {
      const groupId = item.markup_group_id || defaultGroupByCat.get(item.printer_category_id) || null;
      return tiers
        .filter((t: any) => (t.markup_group_id ?? null) === groupId && t.printer_category_id === item.printer_category_id)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.min_qty ?? 0) - (b.min_qty ?? 0));
    };

    const precoLines: string[] = [];
    for (const cat of cats) {
      const items = ppByCat.get(cat.id) ?? [];
      if (items.length === 0) continue;
      precoLines.push(`### Categoria: ${cat.name}`);
      for (const it of items.slice(0, 120)) {
        const itemTiers = tiersForItem(it);
        const eqName = it.equipment_id ? equipmentNameById.get(it.equipment_id) : null;
        const eqTag = eqName ? `${eqName} | ` : "";
        const label = `[${eqTag}${it.equipment_mode}] ${it.paper_type}${it.grammage ? ` ${it.grammage}` : ""} | ${it.size} | ${it.side}`;
        if (itemTiers.length === 0) {
          precoLines.push(`- ${label}: (sem faixas de markup cadastradas)`);
          continue;
        }
        precoLines.push(`- ${label}:`);
        for (const t of itemTiers) {
          const range = t.max_qty ? `${t.min_qty}–${t.max_qty} un` : `${t.min_qty}+ un`;
          const pv = calcPV(it, t);
          precoLines.push(`    ${t.label} (${range}) → ${fmtBRL(pv)}/un`);
        }

        // Log de validação: Couche 210 A4 F color
        if (
          /couch[eê]/i.test(it.paper_type) &&
          /210/.test(it.grammage || "") &&
          /^A4$/i.test(it.size) &&
          it.side === "F" &&
          it.equipment_mode === "color"
        ) {
          const pvs = itemTiers.map((t: any) => `${t.label}=${fmtBRL(calcPV(it, t))}`).join(" | ");
          console.log(`[validação PV] ${label} → ${pvs}`);
        }
      }
      if (items.length > 120) precoLines.push(`  ... (+${items.length - 120} itens)`);
    }

    const gcalStatusLine = gcalConnected
      ? `conectado=true | email=${gcalEmail ?? "(desconhecido)"}`
      : `conectado=false`;

    const camada3 = `## DADOS OPERACIONAIS

### GOOGLE CALENDAR DO USUÁRIO
${gcalStatusLine}

### EQUIPAMENTOS E CONSUMÍVEIS
${eqLines.length > 0 ? eqLines.join("\n") : "(nenhum equipamento cadastrado)"}

### PAPÉIS DISPONÍVEIS
${papLines.length > 0 ? papLines.join("\n") : "(nenhum papel ativo)"}

### PREÇOS DE IMPRESSÃO (preço de venda já calculado por faixa de quantidade)
${precoLines.length > 0 ? precoLines.join("\n") : "(nenhum preço cadastrado)"}`;

    const systemPrompt = `${camada1}\n\n${camada2}\n\n${camada3}`;

    // 6) Tool calling — definir ferramentas disponíveis (lembretes)
    const tools = [
      {
        type: "function",
        function: {
          name: "create_reminder",
          description: "Cria um lembrete pessoal do usuário autenticado.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Descrição curta do lembrete." },
              remind_at: {
                type: "string",
                description: "Data/hora ISO 8601 com offset (ex.: 2026-04-23T17:00:00-03:00). Deve ser futuro.",
              },
              description: { type: "string", description: "Detalhe opcional." },
              recurrence: {
                type: "string",
                enum: ["none", "daily", "weekly", "monthly"],
                description: "Recorrência. Padrão: none.",
              },
            },
            required: ["title", "remind_at"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "list_reminders",
          description: "Lista os lembretes pendentes (não concluídos) do usuário.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "delete_reminder",
          description: "Remove um lembrete pelo seu id (UUID).",
          parameters: {
            type: "object",
            properties: { id: { type: "string", description: "UUID do lembrete." } },
            required: ["id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "check_reminder_conflict",
          description:
            "Verifica se há lembretes pendentes do usuário próximos a um horário proposto (±window_minutes). Use SEMPRE antes de create_reminder com remind_at definido.",
          parameters: {
            type: "object",
            properties: {
              remind_at: {
                type: "string",
                description: "Horário proposto em ISO 8601 com offset.",
              },
              window_minutes: {
                type: "number",
                description: "Janela em minutos para considerar conflito. Padrão 15.",
              },
              exclude_id: {
                type: "string",
                description: "UUID de lembrete a ignorar (para futuras edições).",
              },
            },
            required: ["remind_at"],
          },
        },
      },
    ];

    const REMINDERS_URL = `${SUPABASE_URL}/functions/v1/reminders-api`;

    async function callRemindersApi(
      method: "GET" | "POST" | "DELETE",
      args: Record<string, unknown>,
      pathSuffix = "",
    ): Promise<unknown> {
      let url = REMINDERS_URL + pathSuffix;
      let body: string | undefined;
      if (method === "POST") {
        body = JSON.stringify(args);
      } else if (method === "DELETE") {
        const id = String(args.id ?? "");
        url += `?id=${encodeURIComponent(id)}`;
      } else if (method === "GET" && Object.keys(args).length > 0) {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(args)) {
          if (v !== undefined && v !== null) qs.set(k, String(v));
        }
        const q = qs.toString();
        if (q) url += (url.includes("?") ? "&" : "?") + q;
      }
      const resp = await fetch(url, {
        method,
        headers: {
          Authorization: authHeader!,
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body,
      });
      if (resp.status === 204) return { ok: true };
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        if (!resp.ok) return { error: json?.error ?? `HTTP ${resp.status}` };
        return json;
      } catch {
        return resp.ok ? { ok: true } : { error: text || `HTTP ${resp.status}` };
      }
    }

    async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      try {
        if (name === "create_reminder") return await callRemindersApi("POST", args);
        if (name === "list_reminders") return await callRemindersApi("GET", {});
        if (name === "delete_reminder") return await callRemindersApi("DELETE", args);
        if (name === "check_reminder_conflict")
          return await callRemindersApi("GET", args, "/conflicts");
        return { error: `Ferramenta desconhecida: ${name}` };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Erro ao executar ferramenta" };
      }
    }

    // 7) Loop de chat com tool calling (máx 3 iterações)
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...historico.slice(-10),
      { role: "user", content: pergunta },
    ];

    let resposta = "";
    for (let iter = 0; iter < 3; iter++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools,
          tool_choice: "auto",
        }),
      });

      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Muitas perguntas em pouco tempo. Aguarde alguns segundos e tente novamente.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Créditos do assistente esgotados. Adicione créditos em Settings > Workspace > Usage.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!aiResp.ok) {
        const text = await aiResp.text();
        console.error("[assistente-virtual] AI gateway error:", aiResp.status, text);
        return new Response(JSON.stringify({ error: "Falha no serviço de IA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiJson = await aiResp.json();
      const choice = aiJson?.choices?.[0];
      const msg = choice?.message;
      const toolCalls = msg?.tool_calls as
        | Array<{ id: string; function: { name: string; arguments: string } }>
        | undefined;

      if (toolCalls && toolCalls.length > 0) {
        // Adiciona a mensagem do assistente com tool_calls
        messages.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: toolCalls,
        });
        // Executa cada tool e adiciona resposta
        for (const tc of toolCalls) {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || "{}");
          } catch {
            parsedArgs = {};
          }
          const result = await executeTool(tc.function.name, parsedArgs);
          console.log(`[assistente-virtual] tool ${tc.function.name} →`, JSON.stringify(result));
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        continue; // próxima iteração para o modelo formatar resposta
      }

      resposta = (msg?.content ?? "").trim() || "Não consegui gerar uma resposta.";
      break;
    }

    if (!resposta) resposta = "Não consegui finalizar a resposta. Tente novamente.";

    return new Response(JSON.stringify({ resposta }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[assistente-virtual] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
