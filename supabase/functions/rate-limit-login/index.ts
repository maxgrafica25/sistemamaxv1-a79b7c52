import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password } = await req.json()
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    console.log(`[RateLimit] Processing login for IP: ${clientIp}, Email: ${email}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check rate limit
    const { data: isBlocked, error: checkError } = await supabaseAdmin
      .rpc('is_ip_blocked', { p_ip_address: clientIp })

    if (checkError) {
      console.error('[RateLimit] Error checking if blocked:', checkError)
      throw checkError
    }

    if (isBlocked) {
      console.log(`[RateLimit] IP ${clientIp} is BLOCKED`)
      return new Response(
        JSON.stringify({ error: 'Too many failed attempts. Please try again in 15 minutes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ error: authError.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})