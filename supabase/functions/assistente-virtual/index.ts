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
            "printer_category_id,equipment_id,paper_type,grammage,size,side,paper_cost,printing_cost,equipment_mode",
          )
          .eq("is_active", true),
        admin.from("printer_categories").select("id,name").order("sort_order"),
        admin
          .from("markup_tiers")
          .select(
            "printer_category_id,label,min_qty,max_qty,fixed_cost_pct,variable_cost_pct,margin_pct",
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
- Se a pergunta estiver incompleta para uma resposta precisa (ex: "quanto custa uma impressão?" sem especificar tamanho/papel/quantidade), NÃO chute. Liste as opções disponíveis nos dados e peça ao usuário que escolha.
- Se a informação simplesmente não existir nos dados, diga claramente: "Essa informação não está cadastrada no sistema."
- Valores monetários sempre em R$ com vírgula decimal. Seja conciso.

REGRA CRÍTICA — PREÇO DE VENDA (calcule, não chute):
Quando perguntarem preço, valor, "quanto cobrar", "quanto custa para o cliente" etc., você DEVE calcular o preço de venda (PV) seguindo EXATAMENTE estes passos. Se faltar qualquer dado, NÃO chute — responda "Não consegui localizar essa informação no sistema." e liste o que faltou.

PASSOS OBRIGATÓRIOS:
1. Identifique o item EXATO em "PREÇOS DE IMPRESSÃO" combinando: paper_type + grammage + size + side + equipment_mode. Se não existir item idêntico, pare e diga que não localizou (cite o que procurou).
2. Some custo unitário = paper_cost + printing_cost (valores já mostrados no item).
3. Identifique a categoria do item e, dentro das "Faixas" dessa categoria, a faixa (TP) cuja quantidade pedida cai entre min_qty e max_qty. Se nenhuma faixa cobrir a quantidade, pare e diga que não localizou.
4. Pegue os 3 percentuais da faixa: fixed_cost_pct, variable_cost_pct, margin_pct. Se algum estiver ausente, pare e diga que não localizou. NUNCA use a "Margem padrão" global como substituto.
5. Calcule: PV_unitario = custo / (1 - (fixed_cost_pct + variable_cost_pct + margin_pct) / 100).
6. Arredonde PV_unitario PARA CIMA ao próximo múltiplo de R$ 0,05 (ex.: 3,67 → 3,70; 3,71 → 3,75).
7. Se a quantidade foi informada, calcule total = PV_unitario_arredondado × quantidade.

FORMATO DA RESPOSTA quando o cálculo é possível:
- "Preço de venda: R$ X,XX por folha (faixa TPn)" + "Total para N un: R$ Y,YY" quando aplicável. Sem mostrar o custo, sem explicar a fórmula a menos que pedido.

PROIBIÇÕES ABSOLUTAS:
- Nunca aproximar, estimar ou "dar uma ideia" de preço.
- Nunca usar margem padrão global, percentuais de outra faixa, ou multiplicar custo por fator inventado.
- Nunca informar o custo como se fosse preço de venda.
- Se a pergunta for ambígua (ex.: "quanto custa um folder?" sem papel/tamanho/lado/quantidade), peça os dados que faltam antes de calcular.`;


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

    // Preços agrupados por categoria
    const ppByCat = new Map<string, any[]>();
    for (const item of pp) {
      const arr = ppByCat.get(item.printer_category_id) ?? [];
      arr.push(item);
      ppByCat.set(item.printer_category_id, arr);
    }
    const tiersByCat = new Map<string, any[]>();
    for (const t of tiers) {
      const arr = tiersByCat.get(t.printer_category_id) ?? [];
      arr.push(t);
      tiersByCat.set(t.printer_category_id, arr);
    }

    const precoLines: string[] = [];
    for (const cat of cats) {
      const items = ppByCat.get(cat.id) ?? [];
      const cTiers = tiersByCat.get(cat.id) ?? [];
      if (items.length === 0 && cTiers.length === 0) continue;
      precoLines.push(`### Categoria: ${cat.name}`);
      if (cTiers.length > 0) {
        precoLines.push(
          "  Faixas: " +
            cTiers
              .map(
                (t: any) =>
                  `${t.label} (${t.min_qty}${t.max_qty ? `-${t.max_qty}` : "+"}; margem ${t.margin_pct}%, fixo ${t.fixed_cost_pct}%, variável ${t.variable_cost_pct}%)`,
              )
              .join(", "),
        );
      }
      if (items.length > 0) {
        precoLines.push("  Itens:");
        for (const it of items.slice(0, 50)) {
          const total = Number(it.paper_cost || 0) + Number(it.printing_cost || 0);
          precoLines.push(
            `    - ${it.paper_type}${it.grammage ? ` ${it.grammage}` : ""} ${it.size} ${it.side} (${it.equipment_mode}): papel ${fmtBRL(it.paper_cost)} + impressão ${fmtBRL(it.printing_cost)} = custo ${fmtBRL(total)}`,
          );
        }
        if (items.length > 50) precoLines.push(`    ... (+${items.length - 50} itens)`);
      }
    }

    const gsLine = gs
      ? `Imposto: ${gs.tax_pct}% | Nota fiscal: ${gs.invoice_pct}% | Comissão: ${gs.collection_pct}% | Taxa cobrança: ${gs.collection_fee_pct}% | Cartão: ${gs.credit_card_pct}% | Perda: ${gs.waste_pct}% | Margem padrão: ${gs.default_margin_pct}%`
      : "(não cadastrado)";

    const camada3 = `## DADOS OPERACIONAIS

### EQUIPAMENTOS E CONSUMÍVEIS
${eqLines.length > 0 ? eqLines.join("\n") : "(nenhum equipamento cadastrado)"}

### PAPÉIS DISPONÍVEIS
${papLines.length > 0 ? papLines.join("\n") : "(nenhum papel ativo)"}

### PREÇOS DE IMPRESSÃO
${precoLines.length > 0 ? precoLines.join("\n") : "(nenhum preço cadastrado)"}

### CONFIGURAÇÕES GLOBAIS DE PREÇO
${gsLine}`;

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
