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

Responda SEMPRE em português do Brasil — objetiva, amigável e calorosa, sem ser longa.

TOM E FORMATO (vale para todas as respostas, exceto preços):
- Respostas curtas. Máx 3 linhas para confirmações, máx 5 linhas para listagens.
- Use no máximo 1 emoji por resposta, só quando agregar: ✅ confirmação, ⏰ horário, 📅 data, ⚠️ conflito, 💡 dica. Nunca emoji em respostas técnicas de preço.
- Use **negrito** APENAS em horários, títulos de compromissos e ações principais (substituir/manter/cancelar). O frontend renderiza markdown, então **texto** vira negrito real — nunca escreva asteriscos pra "enfatizar" outras coisas.
- Use listas com "-" quando houver 2+ itens.
- Separe blocos com uma linha em branco quando houver confirmação + próximo passo.

PADRÕES DE RESPOSTA (siga literalmente):
- Confirmação simples de lembrete avulso:
  ✅ **Pronto!** Te aviso às **10h45** sobre o **treino das 11h**.
- Confirmação de item da fila quando ainda há pendentes (Linha A/C):
  ✅ Treino das 11h confirmado.

  Falta combinar o **instagram às 16h**. Quando quer ser avisado?
  [JULIA_CHIPS:lead_time]
- Conflito de horário:
  ⚠️ Já tem **<título>** marcado pra **<dia> às <hora>**.

  Quer (a) substituir, (b) manter os dois ou (c) cancelar?
- Listagem de lembretes (list_reminders): bullets em markdown, horário em negrito.
  ⚠️ REGRA INVIOLÁVEL DOS DOIS CAMPOS — leia com atenção:
    • Cada lembrete tem DOIS timestamps distintos: event_at (horário REAL do compromisso) e remind_at (horário do AVISO/notificação).
    • Para EXIBIR o horário do bullet (o **negrito** principal), use SEMPRE event_at. Se event_at for null, aí sim use remind_at.
    • Para mostrar entre parênteses "(aviso XXhYY)", use SEMPRE remind_at — e SÓ inclua se remind_at for diferente de event_at.
    • NUNCA inverta. NUNCA pegue remind_at para o bullet principal só porque aparece primeiro no JSON. Compare mentalmente os dois campos antes de escrever.
    • NUNCA repita o horário no título (se o bullet mostra **11h**, escreva só "Treino", não "Treino às 11h").
  Exemplo concreto de input → output:
    JSON do lembrete: { "title": "Treino", "remind_at": "2026-04-27T13:45:00+00:00", "event_at": "2026-04-27T16:00:00+00:00" }
    Em America/Sao_Paulo (UTC-3): event_at = 13h00 local, remind_at = 10h45 local.
    Saída CORRETA: "- **13h00** — Treino (aviso 10h45)"
    Saída ERRADA: "- **10h45** — Treino (aviso 13h00)"  ← inverteu os campos
    Saída ERRADA: "- **13h00** — Treino às 13h" ← repetiu horário no título
  Outro exemplo (sem aviso antecipado):
    JSON: { "title": "Teste Sistema 1", "remind_at": "2026-04-27T17:00:00+00:00", "event_at": "2026-04-27T17:00:00+00:00" }
    Local: 14h00. Saída CORRETA: "- **14h00** — Teste Sistema 1"  (sem parênteses, pois remind_at == event_at)
  Modelo de resposta:
  Seus pendentes:
  - **11h00** — Treino (aviso 10h45)
  - **16h00** — Instagram

Use SOMENTE as seções "BASE DE CONHECIMENTO" e "DADOS OPERACIONAIS" como fonte de verdade. Valores em R$ com vírgula decimal. Respostas de PREÇO mantêm tom técnico, sem emoji.

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
- create_reminder({ title, remind_at, event_at?, description?, recurrence? }): cria um lembrete pessoal do usuário.
  • title: descrição curta SEM o horário (ex.: "Dentista", NUNCA "Dentista às 14h").
  • remind_at: ISO 8601 com offset; QUANDO DISPARAR O AVISO; deve ser futuro.
  • event_at: ISO 8601 com offset; horário REAL do compromisso. OBRIGATÓRIO sempre que houver aviso antecipado (remind_at < event_at). OMITIR para tarefas avulsas ("tomar água às 16h" → só remind_at).
  • recurrence: "none" | "daily" | "weekly" | "monthly" (padrão "none").
- list_reminders(): lista lembretes pendentes do usuário (cada item traz remind_at e event_at).
- list_cancelled_reminders({ from, to }): lista lembretes JÁ CANCELADOS do usuário numa janela ISO 8601. Use APENAS quando o usuário perguntar "eu tinha algo?" / "tinha compromisso?" e list_reminders não trouxer nada no horário.
- delete_reminder({ id, reason? }): cancela lembrete pelo id (use list_reminders antes para descobrir o id). reason='user_cancelled' (default) para cancelamento puro; reason='rescheduled' quando o cancelamento é parte de um remarcar (delete antigo + create novo). O servidor força automaticamente 'rescheduled' se a frase do usuário for de remarcar, mas SEMPRE passe explicitamente quando souber.
- check_reminder_conflict({ remind_at, window_minutes?, exclude_id? }): verifica conflito comparando event_at dos pendentes contra o valor passado em remind_at (que aqui representa o HORÁRIO DO COMPROMISSO REAL — passe o event_at do novo lembrete; se for tarefa avulsa, passe o remind_at). Padrão window_minutes=15. Retorna { conflicts: [...] }.

REGRAS PARA FERRAMENTAS:
- Se o usuário pedir para "me lembrar de", "agendar", "anotar compromisso", chame create_reminder.
- PRIORIDADE MÁXIMA — INTENÇÃO DE REMARCAR/CANCELAR: ANTES de qualquer outra regra (e ANTES do DEDUPE), detecte se a mensagem contém verbos de remarcar ("trocar", "troca", "mudar", "muda", "remarcar", "remarca", "passar de X pra Y", "adiar", "antecipar", "mover") ou cancelar ("cancela", "cancelar", "desmarca", "desmarcar", "apaga", "apagar", "remove", "remover"). Se sim:
    • É um comando de EDIÇÃO, não de criação. NÃO entre no fluxo de DEDUPE — o usuário JÁ decidiu substituir, não pergunte (a)/(b)/(c).
    • Chame list_reminders, filtre por título contendo o assunto E remind_at no mesmo dia (±2h do horário antigo quando citado) e execute conforme a regra COMANDO DE REMARCAR/CANCELAR abaixo.
    • "Trocar/mudar X de H1 pra H2" = delete_reminder no antigo + create_reminder no novo, direto, sem confirmar substituição.
- DEDUPE OBRIGATÓRIO (apenas quando a intenção é CRIAR um lembrete novo — NÃO se aplica quando o usuário pediu remarcar/trocar/cancelar; nesses casos siga a PRIORIDADE MÁXIMA acima): chame list_reminders e procure lembretes pendentes cujo título contenha o MESMO assunto (ex.: "treino", "instagram", "dentista") E cujo event_at (ou remind_at se event_at for null) esteja no MESMO DIA (em America/Sao_Paulo) do que você está prestes a criar. Se achar 1+ match:
    • NÃO chame create_reminder.
    • Liste o(s) existente(s) com título e horário REAL (event_at) em pt-BR e pergunte LITERALMENTE: "Já existe **<título do existente>** marcado pra <dia> às <hora>. Quer (a) substituir, (b) manter os dois, ou (c) cancelar essa nova?"
    • Só crie a duplicata se o usuário responder explicitamente (b)/"manter os dois"/"pode duplicar". Se escolher (a), chame delete_reminder no antigo e depois create_reminder no novo. Se (c), não faça nada.
    • Esta checagem é SEPARADA e ADICIONAL ao check_reminder_conflict (que olha janela de ±15min sobre event_at). Faça AMBAS.
- COMANDO DE REMARCAR/CANCELAR ("remarca o X das H", "cancela o X das H", "muda o X de H1 pra H2", "trocar X de H1 pra H2"): SEMPRE chame list_reminders PRIMEIRO (na MESMA iteração) e selecione o alvo aplicando, NESTA ORDEM, os filtros:
    1. dia em contexto (ver "CONTEXTO HERDADO DA LISTA ANTERIOR" abaixo) — descarte tudo que não cair no dia certo.
    2. horário citado (±2h) quando o usuário citou hora.
    3. assunto/título contendo X.
    • 1 match exato → execute direto: cancelar = delete_reminder com o UUID exato; remarcar = delete_reminder do antigo (UUID exato) + create_reminder do novo. Sem perguntar "qual?", sem (a)/(b)/(c).
    • 2+ matches após os 3 filtros → liste com **id curto** (últimos 4 chars do uuid), título e horário, e pergunte "Qual deles? (responda com o código entre parênteses)". NUNCA apague por aproximação.
    • 0 matches → responda "Não achei nenhum **<X>** por volta das <hora> em <dia>. Quer que eu crie um novo?". NUNCA apague algo de outro dia.
- USO OBRIGATÓRIO DE UUID EXATO (REGRA INVIOLÁVEL): ANTES de QUALQUER delete_reminder, você DEVE chamar list_reminders na MESMA iteração. NUNCA invente UUIDs, nunca trunque, nunca reaproveite de turnos antigos. O servidor BLOQUEIA delete_reminder com id fora da sessão atual e devolve {error, available_reminders:[{id,title,event_at}, ...]}. Quando isso acontecer:
    1. NO MESMO TURNO, escolha o id correto da lista available_reminders (filtre pelo título e horário que o usuário pediu) e chame delete_reminder de novo. NÃO peça nada ao usuário, NÃO desista — a lista veio junto com o erro, é só copiar o id certo.
    2. Só responda ao usuário pedindo confirmação se o retry falhar de novo.
- REMARCAR = DELETE + CREATE ATÔMICOS (REGRA INVIOLÁVEL): quando o usuário pede pra "trocar/remarcar/mudar X de H1 pra H2", o delete do antigo e o create do novo formam um par. Se o delete_reminder do antigo falhar (qualquer erro, inclusive uuid_not_in_session), você ESTÁ PROIBIDA de chamar create_reminder do novo até resolver o delete. O servidor também bloqueia esse create automaticamente e devolve {error:"delete pendente...", available_reminders:[...]}. Se mesmo após o retry do delete ele falhar, NÃO crie o novo e diga ao usuário: "Tive um problema interno ao tentar apagar o **<título> das <hora>**. Tenta de novo dizendo só 'cancelar o **<título>** das **<hora>**'?".
- HORÁRIO VEM DE event_at, NUNCA DO TÍTULO: ao listar/citar lembretes, o horário exibido SEMPRE vem de event_at (ou remind_at se event_at for null). NUNCA extraia hora do title — mesmo que o título contenha "às 11h" ou "às 13h15", IGNORE essa parte e use o event_at. Ao exibir o título, REMOVA qualquer trecho "às XXh" / "às XXhMM" do texto (mostre só "Treino", não "Treino às 11h").
- CONTEXTO HERDADO DA LISTA ANTERIOR: se a SUA mensagem anterior no histórico foi uma listagem de lembretes filtrada por uma data específica (ex.: "Seus pendentes para 27/04: ..."), e o usuário responder com referências curtas SEM citar nova data ("o treino das 11", "cancela o das 16h", "troca esse das 11 pra 11h15", "muda o de 14h pra 15h"), então o DIA dessas referências é o MESMO da sua listagem anterior. Use SEMPRE essa data como filtro 1 antes de chamar delete_reminder. Só mude de dia se o usuário disser explicitamente outra data.
- CONSULTA HISTÓRICA ("eu tinha algo?", "tinha compromisso ontem?", "o das 16h não estava marcado?", "tinha alguma coisa marcada dia X?", "algo cancelado pra dia X?", "o que aconteceu com X?"): quando o usuário pergunta se EXISTIA algo num dia/horário (não está pedindo pra criar nem listar pendentes futuros):
    1. Chame list_reminders() e filtre pelo dia/horário pedido.
    2. Se vier vazio (ou se a pergunta for explicitamente sobre "cancelado"/"o que aconteceu com"), chame list_cancelled_reminders({ from, to }) com from/to cobrindo o dia inteiro pedido (em America/Sao_Paulo, convertido pra ISO com offset).
    3. Ao processar a resposta de list_cancelled_reminders, SEPARE por cancelled_reason:
        • cancelled_reason = "user_cancelled" → o item foi de fato CANCELADO pelo usuário. Frase: "**<título> às <hora>** — foi **cancelado** em <data/hora amigável de cancelled_at em pt-BR>."
        • cancelled_reason = "rescheduled" → o item NÃO foi cancelado, foi REMARCADO (substituído por outro lembrete). Frase: "**<título> às <hora>** — foi **remarcado** em <data/hora amigável de cancelled_at> (movido para outro horário)."
    4. FILTRO POR INTENÇÃO DA PERGUNTA:
        • Se o usuário perguntou ESPECIFICAMENTE "o que foi cancelado?" / "algo cancelado?" / "tem cancelamento?": mostre SOMENTE os com cancelled_reason='user_cancelled'. IGNORE os 'rescheduled' completamente — eles não são cancelamentos. Se sobrar zero, responda "Nada cancelado para <período>."
        • Se a pergunta é genérica ("o que aconteceu com X?", "tinha algo dia X?"): mostre AMBOS, usando os termos corretos (cancelado vs remarcado) conforme o cancelled_reason de cada um.
    5. NÃO ofereça restaurar (não há essa funcionalidade).
    6. Se não achar nem em pendentes nem em cancelados: "Nada agendado para <período>."
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
        - "na hora" / "no horário": remind_at = event_at = horário do compromisso, title = só o assunto (ex.: "Dentista").
        - "X antes": event_at = horário do compromisso; remind_at = event_at − X; title = SÓ o assunto (ex.: "Dentista", NUNCA "Dentista às 14h" — o horário sai de event_at). description opcional pode registrar contexto.
    • Confirme mencionando AMBOS os horários quando houver antecedência: "Pronto! Vou te avisar amanhã às 13h sobre seu dentista das 14h."
- Para "me avise X antes de Y" dito de uma vez (ex.: "me avise 2h antes do dentista das 14h"): pule a pergunta, já aplique as regras de event_at/remind_at/título acima.
- MÚLTIPLOS COMPROMISSOS NA MESMA MENSAGEM (obrigatório):
    • COMANDOS MISTOS — REGRA DE INDEPENDÊNCIA (criar + remarcar + cancelar numa só frase, ex.: "trocar treino das 11 para 11h15 E cancelar o das 16"): cada subcomando é avaliado ISOLADAMENTE. Um conflito/dedupe num subcomando NUNCA bloqueia os outros. Processe na ordem citada — "trocar/mudar/remarcar" segue PRIORIDADE MÁXIMA (delete+create direto, sem (a)/(b)/(c)); "cancelar" segue PRIORIDADE MÁXIMA (delete direto); "criar/me avisa" segue o fluxo normal com DEDUPE+conflito. Execute TODOS os deletes/creates possíveis no mesmo turno e só pergunte ao usuário sobre o subcomando específico que travou. Ao final, confirme TUDO numa única resposta consolidada listando o que foi feito e o que ficou pendente.
    • SEMPRE comece identificando TODOS os compromissos com horário marcado citados pelo usuário (ligados por "e", vírgula, "também", "depois", "ainda"). Ex.: "treino na segunda às 11h e instagram às 16h" = 2 compromissos.
    • FUSO HORÁRIO — REGRA CRÍTICA: sempre calcule remind_at em America/Sao_Paulo (UTC−3, sem horário de verão). Para CADA compromisso da lista, recalcule do zero — NÃO reaproveite o offset/horário do anterior. Confira mentalmente antes de chamar a ferramenta: se o usuário disse "16h", o ISO DEVE terminar em "T16:00:00-03:00" (equivalente a "T19:00:00Z"), NUNCA "T14:00:00-03:00" ou "T16:00:00Z". Errar o fuso ao processar múltiplos compromissos é o defeito mais grave possível neste fluxo.
    • Se o usuário JÁ disse a antecedência de cada um na mesma frase (ex.: "me avise 30min antes do treino das 11h e na hora do instagram das 16h"): processe TODOS de uma vez — para cada compromisso, faça check_reminder_conflict + create_reminder em sequência. Ao final, confirme listando os 2+ avisos criados em uma única resposta. NÃO emita chips.
    • Se a antecedência NÃO foi dita: trate como FILA. Pegue o PRIMEIRO compromisso e siga a regra dos chips (linha 1: "Quando quer ser avisado?" / linha 2: [JULIA_CHIPS:lead_time]). Os demais ficam pendentes.
    • Após criar o lembrete do primeiro, se ainda houver compromissos pendentes na fila, ANTES de pedir a antecedência do próximo você DEVE chamar check_reminder_conflict para o horário desse próximo compromisso (window_minutes=15).
        - Se conflicts vier vazio: sua resposta de confirmação DEVE ter este formato exato:
            Linha A: confirmação curta do que acabou de criar (ex.: "Pronto! Vou te avisar às 10h sobre o treino das 11h.").
            Linha B (em branco).
            Linha C (literal, citando o próximo compromisso pendente com nome E horário em negrito): Falta combinar o aviso de **<assunto> às <hora>**. Quando quer ser avisado?
            Linha D (literal): [JULIA_CHIPS:lead_time]
        - Se conflicts tiver itens: NÃO emita os chips ainda. Sua resposta DEVE ter este formato:
            Linha A: confirmação curta do que acabou de criar.
            Linha B (em branco).
            Linha C: aviso de conflito do próximo compromisso, citando nome+horário em negrito e listando o(s) lembrete(s) conflitante(s) com título e horário em pt-BR. Termine com: "Quer marcar **<assunto> às <hora>** mesmo assim ou prefere outro horário?"
          Aguarde a decisão do usuário. Quando o horário definitivo do próximo for decidido (mantido ou trocado), aí sim pergunte a antecedência com [JULIA_CHIPS:lead_time] (sem precisar refazer check_reminder_conflict se o usuário confirmou "mesmo assim"; refaça se ele deu outro horário).
      Repita esse padrão (checar conflito → chips ou aviso de conflito) a cada turno até a fila esvaziar. Quando o último for criado, faça uma confirmação final consolidada (sem chips, sem "Falta combinar...").
    • IMPORTANTE — memória da fila: como você não tem estado entre turnos, a única forma de "lembrar" dos compromissos pendentes é mantendo o nome+horário deles VISÍVEIS no texto da sua resposta (na Linha C acima, seja na versão "Falta combinar..." ou na versão de aviso de conflito). Nunca esconda os pendentes. Se no turno seguinte o usuário só responder a antecedência ou um novo horário, releia SUA mensagem anterior no histórico para identificar qual compromisso da fila está sendo respondido.
- TAREFA AVULSA sem compromisso marcado ("me lembra de tomar água às 16h", "me lembra de comprar leite amanhã"): crie direto, remind_at = horário pedido, NÃO mande event_at, sem perguntar antecedência, sem mostrar chips.
- DETECÇÃO DE CONFLITO (obrigatório): IMEDIATAMENTE antes de chamar create_reminder, chame check_reminder_conflict passando no campo remind_at o HORÁRIO REAL DO COMPROMISSO que você vai criar (ou seja: o event_at se houver aviso antecipado; o próprio remind_at se for tarefa avulsa). Use window_minutes=15.
    • Se conflicts vier vazio: prossiga e chame create_reminder normalmente.
    • Se conflicts tiver itens: NÃO chame create_reminder ainda. Liste o(s) conflito(s) com título e horário em pt-BR e pergunte: "Quer marcar mesmo assim ou prefere outro horário?". Aguarde resposta.
        - Se o usuário confirmar (ex.: "pode marcar", "sim", "mesmo assim"): chame create_reminder com os mesmos remind_at/event_at originais (sem checar conflito de novo).
        - Se pedir outro horário: peça/calcule o novo event_at (e recalcule remind_at se houver antecedência) e refaça check_reminder_conflict antes de criar.
- Após executar, confirme em pt-BR repetindo título + data/hora amigável.
- Para excluir, se houver mais de um lembrete que casa, peça confirmação listando os candidatos com horário e descrição. Se o usuário pedir "apaga todos os X", liste e remova um a um chamando delete_reminder em sequência.
- CONSULTA DE LEMBRETES/COMPROMISSOS (com ou sem filtro de data): para QUALQUER pergunta tipo "quais meus lembretes", "o que tenho hoje", "compromissos de amanhã", "minha agenda de 27/04", "o que tem na sexta", "essa semana", etc., SEMPRE chame list_reminders() primeiro. NUNCA diga que não tem acesso ou que não consegue filtrar por data — você tem e consegue.
    • Depois de receber a lista, filtre VOCÊ MESMO pelo período pedido, interpretando "hoje", "amanhã", "27/04", "segunda", "essa semana", etc. em America/Sao_Paulo (use AGORA da seção DADOS OPERACIONAIS como referência).
    • Formate em bullets markdown com horário em negrito, conforme o padrão da seção LAYOUT (ex.: "- **09h00** Reunião cliente").
    • Se a lista filtrada vier vazia, responda curto: "Nada agendado para <período>." Não invente compromissos.
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
              title: { type: "string", description: "Descrição curta do lembrete (ex.: 'Dentista', SEM o horário no nome)." },
              remind_at: {
                type: "string",
                description: "Data/hora ISO 8601 com offset de QUANDO DISPARAR O AVISO (ex.: 2026-04-23T13:00:00-03:00). Deve ser futuro.",
              },
              event_at: {
                type: "string",
                description: "Data/hora ISO 8601 com offset do HORÁRIO REAL DO COMPROMISSO (ex.: 2026-04-23T14:00:00-03:00). OBRIGATÓRIO quando há aviso antecipado (remind_at < event_at). OMITIR para tarefas avulsas (ex.: 'tomar água às 16h'). Deve ser >= remind_at.",
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
          description: "Cancela um lembrete pelo seu id (UUID). Use reason='rescheduled' quando o cancelamento for parte de um remarcar (delete antigo + create novo); use 'user_cancelled' (default) para cancelamento puro.",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "UUID do lembrete." },
              reason: {
                type: "string",
                enum: ["user_cancelled", "rescheduled"],
                description: "Motivo do cancelamento. 'rescheduled' = parte de um remarcar (vai criar outro no lugar). 'user_cancelled' = cancelamento puro. Default: user_cancelled.",
              },
            },
            required: ["id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "list_cancelled_reminders",
          description:
            "Lista lembretes CANCELADOS do usuário em uma janela de tempo (use quando o usuário perguntar se TINHA algum compromisso e a busca em pendentes vier vazia).",
          parameters: {
            type: "object",
            properties: {
              from: {
                type: "string",
                description: "Início da janela em ISO 8601 com offset.",
              },
              to: {
                type: "string",
                description: "Fim da janela em ISO 8601 com offset.",
              },
            },
            required: ["from", "to"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "check_reminder_conflict",
          description:
            "Verifica se há lembretes pendentes do usuário próximos ao HORÁRIO REAL DO COMPROMISSO proposto (±window_minutes, comparando com event_at). Use SEMPRE antes de create_reminder, passando o event_at do novo compromisso (ou o remind_at se for tarefa avulsa).",
          parameters: {
            type: "object",
            properties: {
              remind_at: {
                type: "string",
                description: "Horário do COMPROMISSO REAL em ISO 8601 com offset (passe event_at do novo lembrete; se for tarefa avulsa, passe remind_at).",
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
        if (args.reason) {
          url += `&reason=${encodeURIComponent(String(args.reason))}`;
        }
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

    // Guard anti-alucinação: só aceita delete_reminder com ids vistos em list_* na MESMA sessão
    const verifiedIds = new Set<string>();
    // Cache da última lista de pendentes pra reinjetar quando o guard rejeita
    let lastPendingList: Array<Record<string, unknown>> = [];
    function captureIdsFromListResult(result: unknown, capturePending = false): void {
      const r = result as { reminders?: Array<Record<string, unknown>> } | null;
      if (r && Array.isArray(r.reminders)) {
        for (const item of r.reminders) {
          const id = item?.id;
          if (id && typeof id === "string") verifiedIds.add(id);
        }
        if (capturePending) {
          lastPendingList = r.reminders.map((it) => ({
            id: it.id,
            title: it.title,
            event_at: it.event_at ?? it.remind_at,
            remind_at: it.remind_at,
          }));
        }
      }
    }

    // Detecta intenção de "remarcar/alterar/mover/etc" na mensagem original do usuário
    const remarcarRegex = /\b(troca|trocar|remarc[ao]|remarcar|mud[ao]|mudar|alter[ao]|alterar|adi[ao]r?|antecip[ao]r?|mov[ei]r?|mova|ajust[ao]r?|reagendar?|passa[r]?\s+(?:de|do|da|para|pra)|de\s+\S+\s+(?:para|pra)\s+\S+)\b/i;
    const isRemarcarSession = remarcarRegex.test(pergunta);
    let mustRetryDelete = false;
    let pendingDeleteTitleHint: string | null = null;

    // Auditoria: registra resultado real de cada tool de mutação para montar o resumo final
    type OpResult = { tool: string; ok: boolean; detail: string };
    const opResults: OpResult[] = [];

    function normalize(s: string): string {
      return (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function fmtTimeBR(iso: string): string {
      try {
        return new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(iso));
      } catch {
        return iso;
      }
    }

    async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      try {
        if (name === "create_reminder") {
          // Bloqueio estrutural: em modo remarcar, se há delete pendente para um título parecido, bloqueia
          if (isRemarcarSession && mustRetryDelete) {
            const newTitle = normalize(String(args.title ?? ""));
            const oldTitle = normalize(pendingDeleteTitleHint ?? "");
            const similar =
              !!newTitle &&
              !!oldTitle &&
              (newTitle === oldTitle ||
                newTitle.includes(oldTitle) ||
                oldTitle.includes(newTitle) ||
                newTitle.split(" ")[0] === oldTitle.split(" ")[0]);
            if (similar) {
              console.warn(
                `[assistente-virtual] create_reminder BLOCKED (reschedule pending delete)`,
                JSON.stringify({ newTitle: args.title, oldTitle: pendingDeleteTitleHint }),
              );
              const detail = `Bloqueado: criar "${args.title}" enquanto há delete pendente do antigo.`;
              opResults.push({ tool: "create_reminder", ok: false, detail });
              return {
                error:
                  "delete pendente — você precisa apagar o lembrete antigo (com o UUID correto da lista available_reminders) ANTES de criar o novo, senão vira duplicata. Tente delete_reminder de novo com o id certo.",
                available_reminders: lastPendingList,
              };
            }
          }

          // Anti-duplicata GERAL: comparar com pendentes (mesmo título normalizado + event_at na mesma data ±30min)
          // Garante lista atualizada
          if (lastPendingList.length === 0) {
            const listRes = await callRemindersApi("GET", {});
            captureIdsFromListResult(listRes, true);
          }
          const newTitleNorm = normalize(String(args.title ?? ""));
          const newEventIso = String(args.event_at ?? args.remind_at ?? "");
          const newEventMs = new Date(newEventIso).getTime();
          if (newTitleNorm && !isNaN(newEventMs)) {
            const matches = lastPendingList.filter((r) => {
              const tNorm = normalize(String(r.title ?? ""));
              const evIso = String(r.event_at ?? r.remind_at ?? "");
              const evMs = new Date(evIso).getTime();
              if (isNaN(evMs)) return false;
              if (tNorm !== newTitleNorm) return false;
              return Math.abs(evMs - newEventMs) <= 30 * 60_000;
            });
            if (matches.length > 0) {
              const list = matches
                .map((m) => `"${m.title}" às ${fmtTimeBR(String(m.event_at ?? m.remind_at))} (id ${String(m.id).slice(-4)})`)
                .join(", ");
              console.warn(
                `[assistente-virtual] create_reminder BLOCKED (duplicate)`,
                JSON.stringify({ newTitle: args.title, newEventIso, matches: matches.map((m) => m.id) }),
              );
              opResults.push({
                tool: "create_reminder",
                ok: false,
                detail: `Bloqueado duplicata de "${args.title}" às ${fmtTimeBR(newEventIso)} — já existe ${list}.`,
              });
              return {
                error: `Já existe '${args.title}' em horário muito próximo: ${list}. Cancele o existente primeiro (delete_reminder) ou, se o usuário confirmar explicitamente que quer duplicar, ignore este aviso e prossiga.`,
                duplicates: matches,
              };
            }
          }

          const result = await callRemindersApi("POST", args);
          const r = result as { reminder?: { id?: string; title?: string; event_at?: string; remind_at?: string }; error?: string };
          if (r?.reminder?.id) {
            verifiedIds.add(r.reminder.id);
            const ev = r.reminder.event_at ?? r.reminder.remind_at ?? newEventIso;
            opResults.push({
              tool: "create_reminder",
              ok: true,
              detail: `✅ Criado "${r.reminder.title}" às ${fmtTimeBR(String(ev))}.`,
            });
          } else {
            opResults.push({
              tool: "create_reminder",
              ok: false,
              detail: `❌ Falha ao criar "${args.title}": ${r?.error ?? "erro desconhecido"}.`,
            });
          }
          return result;
        }
        if (name === "list_reminders") {
          const res = await callRemindersApi("GET", {});
          captureIdsFromListResult(res, true);
          return res;
        }
        if (name === "list_cancelled_reminders") {
          const res = await callRemindersApi("GET", {
            include_cancelled: "1",
            include_completed: "1",
            from: args.from,
            to: args.to,
          });
          captureIdsFromListResult(res);
          return res;
        }
        if (name === "delete_reminder") {
          const id = String(args.id ?? "");
          if (!verifiedIds.has(id)) {
            console.warn(
              `[assistente-virtual] delete_reminder REJECTED`,
              JSON.stringify({ rejected: true, id, reason: "uuid_not_in_session" }),
            );
            // Garante lista atualizada pra reinjetar
            if (lastPendingList.length === 0) {
              const res = await callRemindersApi("GET", {});
              captureIdsFromListResult(res, true);
            }
            mustRetryDelete = true;
            opResults.push({
              tool: "delete_reminder",
              ok: false,
              detail: `❌ Falha ao cancelar (UUID inválido ${id.slice(0, 8)}…) — não pertence à sessão atual.`,
            });
            return {
              error:
                "id não verificado nesta sessão. Use EXATAMENTE um id da lista available_reminders abaixo e chame delete_reminder de novo no mesmo turno.",
              available_reminders: lastPendingList,
            };
          }
          // Em modo remarcar, força reason='rescheduled' (mesmo se modelo esquecer)
          const finalArgs: Record<string, unknown> = { ...args };
          if (isRemarcarSession) {
            finalArgs.reason = "rescheduled";
          } else if (!finalArgs.reason) {
            finalArgs.reason = "user_cancelled";
          }
          // Captura título do alvo (para resumo)
          const target = lastPendingList.find((r) => r.id === id);
          const targetTitle = String(target?.title ?? "lembrete");
          const targetEv = String(target?.event_at ?? target?.remind_at ?? "");
          const result = await callRemindersApi("DELETE", finalArgs);
          // Se delete passou, libera o create
          if ((result as { ok?: boolean })?.ok) {
            mustRetryDelete = false;
            pendingDeleteTitleHint = null;
            const verb = finalArgs.reason === "rescheduled" ? "Remarcado" : "Cancelado";
            opResults.push({
              tool: "delete_reminder",
              ok: true,
              detail: `✅ ${verb} "${targetTitle}"${targetEv ? ` (era às ${fmtTimeBR(targetEv)})` : ""}.`,
            });
          } else {
            opResults.push({
              tool: "delete_reminder",
              ok: false,
              detail: `❌ Falha ao cancelar "${targetTitle}": ${(result as { error?: string })?.error ?? "erro"}.`,
            });
          }
          return result;
        }
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
    // Helper: chama o gateway com retry/backoff em 5xx (ex.: Cloudflare 1102 → 503)
    async function callGateway(): Promise<Response> {
      const maxAttempts = 3;
      let lastResp: Response | null = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        // Sucesso ou erro "definitivo" (não-transitório) → devolve
        if (resp.ok || (resp.status !== 503 && resp.status < 500 && resp.status !== 408)) {
          return resp;
        }
        lastResp = resp;
        const body = await resp.clone().text().catch(() => "");
        console.warn(`[assistente-virtual] gateway transient ${resp.status} (attempt ${attempt}/${maxAttempts}): ${body.slice(0, 200)}`);
        if (attempt < maxAttempts) {
          // backoff: 600ms, 1500ms
          await new Promise((r) => setTimeout(r, attempt === 1 ? 600 : 1500));
        }
      }
      return lastResp!;
    }

    for (let iter = 0; iter < 3; iter++) {
      const aiResp = await callGateway();

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
        const transient = aiResp.status === 503 || aiResp.status >= 500;
        return new Response(
          JSON.stringify({
            error: transient
              ? "O serviço de IA está instável agora. Tente de novo em alguns segundos."
              : "Falha no serviço de IA",
          }),
          {
            status: transient ? 503 : 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
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
          console.log(
            `[assistente-virtual] tool ${tc.function.name} args →`,
            JSON.stringify(parsedArgs),
          );
          const result = await executeTool(tc.function.name, parsedArgs);
          console.log(`[assistente-virtual] tool ${tc.function.name} →`, JSON.stringify(result));
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        // Resumo auditado das operações reais — injetado como system para guiar a resposta final.
        // Substitui qualquer resumo anterior (mantém só o último estado).
        if (opResults.length > 0) {
          const summaryLines = opResults.map((o) => `- ${o.detail}`).join("\n");
          const auditMsg = `OPERAÇÕES REALIZADAS NESTE TURNO (fonte da verdade — sua resposta final DEVE refletir EXATAMENTE isto, sem inventar sucesso e sem omitir falhas):\n${summaryLines}\n\nRegra: se algo falhou (linha começa com ❌), DIGA explicitamente que falhou e o que tentar (ex.: "tive um problema ao cancelar X — tenta de novo dizendo 'cancelar X das 11h'"). Se houve bloqueio por duplicata, explique ao usuário que já existe e pergunte se quer mesmo duplicar. Não anuncie como sucesso o que não passou.`;
          // Remove resumo anterior se houver
          for (let i = messages.length - 1; i >= 0; i--) {
            if (
              messages[i]?.role === "system" &&
              typeof messages[i].content === "string" &&
              messages[i].content.startsWith("OPERAÇÕES REALIZADAS NESTE TURNO")
            ) {
              messages.splice(i, 1);
            }
          }
          messages.push({ role: "system", content: auditMsg });
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
