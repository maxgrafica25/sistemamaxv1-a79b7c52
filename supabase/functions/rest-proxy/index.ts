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
    
    // Decodifica %3F se o navegador/cliente tiver codificado a query string no path
    if (subPath.includes('%3F')) {
      subPath = decodeURIComponent(subPath)
    }

    // Separa path e query se estiverem juntos
    let search = url.search
    if (!search && subPath.includes('?')) {
      const parts = subPath.split('?')
      subPath = parts[0]
      search = '?' + parts[1]
    }

    // Remove o prefixo /rest/v1/ redundante se vier do cliente
    if (subPath.startsWith('/rest/v1/')) {
      subPath = subPath.substring(8)
    }

    // Reconstrói a URL de destino (REST) garantindo que seja uma URL absoluta válida
    const targetUrl = new URL(`rest/v1${subPath}${search}`, SUPABASE_URL).toString()
    
    console.log(`[proxy] ${req.method} -> ${targetUrl}`)

    const headers = new Headers(req.headers)
    headers.set('apikey', SUPABASE_ANON_KEY)

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.body,
    })

    const responseHeaders = new Headers(corsHeaders)
    responseHeaders.set('Content-Type', 'application/json')
    
    // Repassa headers importantes da resposta original (ex: count do PostgREST)
    if (response.headers.has('Content-Range')) {
      responseHeaders.set('Content-Range', response.headers.get('Content-Range')!)
    }
    if (response.headers.has('Preference-Applied')) {
      responseHeaders.set('Preference-Applied', response.headers.get('Preference-Applied')!)
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }
      
      console.log(`[proxy] Error ${response.status}:`, JSON.stringify(errorData))

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
        headers: responseHeaders,
      })
    }

    const data = await response.text()
    return new Response(data, {
      status: response.status,
      headers: responseHeaders,
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno no proxy de segurança' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
