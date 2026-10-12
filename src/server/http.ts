/** A small JSON response that is never cached. */
export function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  })
}

export function clientIp(request: Request) {
  const fwd = request.headers.get('x-forwarded-for')
  return fwd?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
}
