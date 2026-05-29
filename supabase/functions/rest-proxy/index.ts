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
    
    const url = new URL(req.url)
    // Extract the sub-path after /rest-proxy
    const proxyPath = '/rest-proxy'
    const index = url.pathname.indexOf(proxyPath)
    const subPath = index !== -1 ? url.pathname.substring(index + proxyPath.length) : url.pathname
    
    // Ensure subPath doesn't double up on /rest/v1 if it already contains it
    const cleanSubPath = subPath.startsWith('/rest/v1') ? subPath.substring(8) : subPath
    const targetUrl = `${supabaseUrl}/rest/v1${cleanSubPath}${url.search}`

    const headers = new Headers(req.headers)
    headers.set('apikey', supabaseAnonKey)

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.body,
    })

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json()
      } catch {
        errorData = {}
      }
      
      console.log(`Intercepted error ${response.status} (Code: ${errorData.code}):`, JSON.stringify(errorData))

      // Sanitize the error response to prevent schema leakage
      const sanitizedError = {
        code: errorData.code || 'API_ERROR',
        message: 'Requisição inválida ou erro interno',
        hint: null,
        details: null
      }

      // Specific messages for known codes as requested
      if (errorData.code === 'PGRST205' || errorData.code === 'PGRST202' || errorData.code === 'PGRST116') {
        sanitizedError.message = 'Recurso não encontrado'
      } else if (errorData.code === '23505') {
        sanitizedError.message = 'Este registro já existe'
      } else if (errorData.message && !errorData.message.includes('public.') && !errorData.message.includes('schema')) {
        // Only keep original message if it's safe and not one of the restricted ones
        sanitizedError.message = errorData.message
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
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno no proxy de segurança' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
