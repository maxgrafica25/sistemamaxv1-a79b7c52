import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    // Get the original path (e.g., /rest/v1/profiles)
    const url = new URL(req.url)
    const path = url.pathname.replace('/rest-proxy', '/rest/v1')
    const targetUrl = `${supabaseUrl}${path}${url.search}`

    const headers = new Headers(req.headers)
    headers.set('apikey', supabaseAnonKey)

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.body,
    })

    if (!response.ok) {
      const errorData = await response.json()
      
      // Sanitize the error response
      const sanitizedError = {
        code: errorData.code || 'API_ERROR',
        message: 'Requisição inválida ou recurso não encontrado',
        hint: null,
        details: null
      }

      // Specific handling for common PostgREST errors to be slightly more helpful without leaking
      if (errorData.code === 'PGRST116') {
        sanitizedError.message = 'Recurso não encontrado'
      } else if (errorData.code === '23505') {
        sanitizedError.message = 'Registro já existe'
      }

      return new Response(JSON.stringify(sanitizedError), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.text()
    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno no proxy de segurança' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
