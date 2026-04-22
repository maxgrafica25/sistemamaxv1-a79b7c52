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

    const [bcRes, eqRes, consRes, readingsRes, ppRes, catsRes, tiersRes, papersRes, gsRes] =
      await Promise.all([
        admin.from("base_conhecimento").select("titulo,categoria,conteudo").eq("ativo", true),
        admin.from("equipments").select("id,name,description,printer_type").order("sort_order"),
        admin.from("equipment_consumables").select("id,equipment_id,name,price,yield_pages,mode"),
        admin
          .from("printer_readings")
          .select("equipment_id,total_prints,type,reading_time")
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
      ]);

    const bc = bcRes.data ?? [];
    const equipments = eqRes.data ?? [];
    const consumables = consRes.data ?? [];
    const readings = readingsRes.data ?? [];
    const pp = ppRes.data ?? [];
    const cats = catsRes.data ?? [];
    const tiers = tiersRes.data ?? [];
    const papers = papersRes.data ?? [];
    const gs = gsRes.data;

    // 4) Calcular impressões desde o último toner por equipamento
    const lastReadingByEq = new Map<string, number>();
    const lastTonerChangeByEq = new Map<string, number>();
    for (const r of readings) {
      if (!r.equipment_id || r.total_prints == null) continue;
      if (!lastReadingByEq.has(r.equipment_id)) {
        lastReadingByEq.set(r.equipment_id, r.total_prints);
      }
      if (r.type === "toner_change" && !lastTonerChangeByEq.has(r.equipment_id)) {
        lastTonerChangeByEq.set(r.equipment_id, r.total_prints);
      }
    }

    // 5) Montar system prompt em 3 camadas
    const camada1 = `Você é a Júlia, assistente virtual da Max Gráfica. Quando se apresentar ou for perguntada seu nome, responda que se chama Júlia e que trabalha na Max Gráfica. Responda SEMPRE em português do Brasil, de forma direta, sem rodeios e sem floreios.

REGRA CRÍTICA — NÃO INVENTE:
- Use SOMENTE as informações nas seções "BASE DE CONHECIMENTO" e "DADOS OPERACIONAIS" abaixo como fonte de verdade.
- Se a informação não existir nos dados, diga claramente: "Não consegui localizar essa informação no sistema." e liste o que faltou.
- Valores monetários sempre em R$ com vírgula decimal. Seja conciso.

REGRA CRÍTICA — PREÇO DE VENDA:
Os preços de venda JÁ ESTÃO CALCULADOS na seção "PREÇOS DE IMPRESSÃO" por item e por faixa de quantidade (TP1, TP2, ...). Você NUNCA deve calcular markup, custo, fórmulas ou aplicar percentuais. Sua tarefa é APENAS:

1. Localizar o item EXATO combinando paper_type + grammage + size + side + equipment_mode.
2. Localizar a faixa (TP) cuja quantidade pedida cai entre min e max da faixa.
3. Responder com o PV unitário JÁ LISTADO ali, no formato: "Preço de venda: R$ X,XX por folha (faixa TPn)".
4. Se a quantidade foi informada, multiplicar PV × quantidade e informar o total: "Total para N un: R$ Y,YY".

REGRAS:
- Se o item não existir, responda exatamente: "Não consegui localizar essa informação no sistema." e diga o que procurou (ex.: "não encontrei Couchê 210 A4 F color").
- Se nenhuma faixa cobrir a quantidade pedida, responda exatamente: "Não consegui localizar essa informação no sistema." e diga que não há faixa cadastrada para aquela quantidade.
- Se a pergunta for ambígua (ex.: "quanto custa um folder?" sem papel/tamanho/lado/modo/quantidade), peça os dados que faltam antes de responder.

PROIBIÇÕES ABSOLUTAS:
- Nunca calcular, estimar, aproximar ou "dar uma ideia" de preço.
- Nunca aplicar percentuais, margens, fórmulas ou markup — os preços vêm prontos.
- Nunca informar custo como se fosse preço de venda.

DESAMBIGUAÇÃO POR EQUIPAMENTO:
Quando houver mais de um item com o MESMO papel + gramatura + tamanho + lado + modo, mas em equipamentos diferentes (ex.: dois Xerox C70 com custos distintos), você DEVE:
- Perguntar ao usuário em qual equipamento ele quer imprimir, OU
- Listar todas as opções com o nome do equipamento entre colchetes [Equipamento] e o PV de cada uma, deixando o usuário escolher.
Nunca escolha sozinho um dos itens duplicados.`;


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

    // Equipamentos + consumíveis + estimativa de toner
    const eqLines: string[] = [];
    for (const eq of equipments) {
      const tipo = eq.printer_type;
      const lastTotal = lastReadingByEq.get(eq.id);
      const lastTonerTotal = lastTonerChangeByEq.get(eq.id);
      const desdeToner =
        lastTotal != null && lastTonerTotal != null ? lastTotal - lastTonerTotal : null;
      eqLines.push(
        `- **${eq.name}** (${tipo})${eq.description ? ` — ${eq.description}` : ""}` +
          (lastTotal != null ? ` | Contador atual: ${lastTotal.toLocaleString("pt-BR")}` : "") +
          (desdeToner != null
            ? ` | Impressões desde última troca de toner registrada: ${desdeToner.toLocaleString("pt-BR")}`
            : ""),
      );
      const eqCons = consumables.filter((c: any) => c.equipment_id === eq.id);
      if (eqCons.length > 0) {
        eqLines.push("  Consumíveis:");
        for (const c of eqCons) {
          const restante =
            desdeToner != null && c.yield_pages > 0
              ? Math.max(0, c.yield_pages - desdeToner)
              : null;
          eqLines.push(
            `    - ${c.name} (${c.mode}): ${fmtBRL(c.price)} | rendimento ${c.yield_pages.toLocaleString("pt-BR")} pgs` +
              (restante != null
                ? ` | estimativa restante (compartilhada): ~${restante.toLocaleString("pt-BR")} pgs`
                : ""),
          );
        }
      }
    }

    const papLines = papers.map(
      (p: any) =>
        `- ${p.name}${p.grammage ? ` ${p.grammage}` : ""}: ${p.sheet_qty} fls/pacote, pacote ${fmtBRL(p.pack_price)} + frete ${fmtBRL(p.freight_price)}`,
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
        const eqTag = eqName ? ` [${eqName}]` : "";
        const label = `${it.paper_type}${it.grammage ? ` ${it.grammage}` : ""} ${it.size} ${it.side} (${it.equipment_mode})${eqTag}`;
        if (itemTiers.length === 0) {
          precoLines.push(`  - ${label}: (sem faixas de markup cadastradas)`);
          continue;
        }
        const tierStrs = itemTiers.map((t: any) => {
          const range = t.max_qty ? `${t.min_qty}-${t.max_qty} un` : `${t.min_qty}+ un`;
          const pv = calcPV(it, t);
          return `${t.label} (${range}) → ${fmtBRL(pv)}/un`;
        });
        precoLines.push(`  - ${label}: ${tierStrs.join(" | ")}`);
      }
      if (items.length > 120) precoLines.push(`  ... (+${items.length - 120} itens)`);
    }

    const camada3 = `## DADOS OPERACIONAIS

### EQUIPAMENTOS E CONSUMÍVEIS
${eqLines.length > 0 ? eqLines.join("\n") : "(nenhum equipamento cadastrado)"}

### PAPÉIS DISPONÍVEIS
${papLines.length > 0 ? papLines.join("\n") : "(nenhum papel ativo)"}

### PREÇOS DE IMPRESSÃO (preço de venda já calculado por faixa de quantidade)
${precoLines.length > 0 ? precoLines.join("\n") : "(nenhum preço cadastrado)"}`;

    const systemPrompt = `${camada1}\n\n${camada2}\n\n${camada3}`;

    // 6) Chamar Lovable AI Gateway
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...historico.slice(-10),
          { role: "user", content: pergunta },
        ],
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
    const resposta: string =
      aiJson?.choices?.[0]?.message?.content?.trim() ?? "Não consegui gerar uma resposta.";

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
