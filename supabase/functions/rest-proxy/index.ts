import { corsHeadersFor, validateOrigin } from "../_shared/errorHandler.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
}

Deno.serve(async (req) => {
  const corsHeaders = { ...corsHeadersFor(req), ...BASE_HEADERS }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const blocked = validateOrigin(req, corsHeaders)
  if (blocked) return blocked

  try {
    
    const url = new URL(req.url)
    console.log(`Incoming request: ${req.method} ${req.url}`)
    console.log(`Parsed Pathname: ${url.pathname}`)
    console.log(`Parsed Search: ${url.search}`)
    
    const proxyPath = '/rest-proxy'
    const index = url.pathname.indexOf(proxyPath)
    let subPath = index !== -1 ? url.pathname.substring(index + proxyPath.length) : url.pathname
    
    // Remove prefix if present
    if (subPath.startsWith('/rest/v1')) {
      subPath = subPath.substring(8)
    }

    // Ensure it starts with a single slash
    subPath = '/' + subPath.replace(/^\/+/, '')
    
    // Reconstruct target URL safely
    const targetUrl = new URL(`rest/v1${subPath}`, SUPABASE_URL)
    targetUrl.search = url.search
    
    console.log(`Proxying ${req.method} to: ${targetUrl.toString()}`)

    const headers = new Headers(req.headers)
    headers.set('apikey', SUPABASE_ANON_KEY)

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

      // Sanitize the error response completely as requested
      const sanitizedError = {
        code: errorData.code || 'API_ERROR',
        message: 'Requisição inválida', // Default generic message
        hint: null,
        details: null
      }

      // Specific generic messages for known codes
      if (errorData.code === 'PGRST205' || errorData.code === 'PGRST202' || errorData.code === 'PGRST116') {
        sanitizedError.message = 'Recurso não encontrado'
      } else if (errorData.code === '23505') {
        sanitizedError.message = 'Registro duplicado'
      } else if (response.status === 401 || response.status === 403) {
        sanitizedError.message = 'Acesso negado'
      } else if (response.status >= 500) {
        sanitizedError.message = 'Erro interno do servidor'
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
