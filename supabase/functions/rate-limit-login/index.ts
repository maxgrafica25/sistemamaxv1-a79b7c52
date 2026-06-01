import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { corsHeadersFor, validateOrigin, sanitizeError } from "../_shared/errorHandler.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const blocked = validateOrigin(req, corsHeaders)
  if (blocked) return blocked

  try {
    const { email, password } = await req.json()
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    console.log(`[RateLimit] Processing login for IP: ${clientIp}, Email: ${email}`)

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Check rate limit
    const { data: isBlocked, error: checkError } = await supabaseAdmin
      .rpc('is_auth_blocked', { p_ip_address: clientIp, p_identifier: email })

    if (checkError) {
      console.error('[RateLimit] Error checking if blocked:', checkError)
      throw checkError
    }

    if (isBlocked) {
      console.log(`[RateLimit] IP ${clientIp} is BLOCKED`)
      return new Response(
        JSON.stringify({ error: 'too_many_attempts' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Attempt login
    console.log(`[RateLimit] Attempting auth.signInWithPassword for ${email}`)
    const { data, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    // Record attempt - Fix parameter names to match SQL function
    console.log(`[RateLimit] Recording attempt for ${clientIp}. Success: ${!authError}`)
    const { error: recordError } = await supabaseAdmin
      .rpc('record_auth_attempt', {
        p_ip_address: clientIp,
        p_identifier: email,
        p_successful: !authError
      })

    if (recordError) {
      console.error('[RateLimit] Error recording attempt:', recordError)
    }

    if (authError) {
      console.log(`[RateLimit] Auth failed for ${email}: ${authError.message}`)
      return new Response(
        JSON.stringify({ error: 'invalid_credentials' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify(sanitizeError(error, "rate-limit-login", { publicMessage: "Erro ao processar login" })),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})