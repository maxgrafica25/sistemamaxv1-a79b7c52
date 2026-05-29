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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check rate limit using the existing security schema functions
    const { data: isBlocked, error: checkError } = await supabaseAdmin
      .rpc('is_ip_blocked', { p_ip_address: clientIp })

    if (checkError) throw checkError
    if (isBlocked) {
      return new Response(
        JSON.stringify({ error: 'Too many failed attempts. Please try again in 15 minutes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Attempt login
    const { data, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    })

    // Record attempt
    const { error: recordError } = await supabaseAdmin
      .rpc('record_auth_attempt', {
        p_ip_address: clientIp,
        p_email: email,
        p_is_success: !authError
      })

    if (recordError) console.error('Error recording attempt:', recordError)

    if (authError) {
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