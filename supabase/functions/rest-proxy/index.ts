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
    const proxyPath = '/rest-proxy'
    const index = url.pathname.indexOf(proxyPath)
    
    // Extrai o subPath ignorando o prefixo do proxy
    let subPath = index !== -1 
      ? url.pathname.substring(index + proxyPath.length) 
      : url.pathname

    // Garante que subPath comece com /
    if (!subPath.startsWith('/')) subPath = '/' + subPath
    
    // Se a query string estiver codificada no subPath (ex: %3F em vez de ?), separa-a.
    // Isso acontece em alguns ambientes de edge runtime.
    let search = url.search
    if (!search && subPath.includes('%3F')) {
      const parts = subPath.split('%3F')
      subPath = parts[0]
      search = '?' + parts[1]
    } else if (!search && subPath.includes('?')) {
      const parts = subPath.split('?')
      subPath = parts[0]
      search = '?' + parts[1]
    }

    // Remove o prefixo /rest/v1/ redundante se vier do cliente
    if (subPath.startsWith('/rest/v1/')) {
      subPath = subPath.substring(8)
    }

    // Reconstrói a URL de destino (REST)
    const targetUrl = new URL(`rest/v1${subPath}${search}`, SUPABASE_URL).toString()
    
    console.log(`[proxy] ${req.method} URL=${req.url} -> ${targetUrl}`)

    const headers = new Headers(req.headers)
    headers.set('apikey', SUPABASE_ANON_KEY)

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.body,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }
      
      console.log(`[proxy] Intercepted error ${response.status}:`, JSON.stringify(errorData))

      const sanitizedError = {
        code: errorData.code || 'API_ERROR',
        message: 'Requisição inválida (Proxy)',
        hint: null,
        details: null
      }

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
