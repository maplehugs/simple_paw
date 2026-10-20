// HTTP client for the course backend (read-only). Docs: https://pokedex-backend-g1ql.onrender.com/docs
const BASE = import.meta.env.VITE_API_URL || 'https://pokedex-backend-g1ql.onrender.com'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The free plan sleeps after ~15 min; the first request can take 30-50 s.
// Network errors and timeouts are retried with backoff; HTTP errors are not.
async function get(path, { retries = 3, timeout = 60000 } = {}) {
  for (let intento = 0; ; intento++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
      const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal })
      if (res.status === 404) return null
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new HttpError(res.status, body.message || `Error ${res.status}`)
      }
      return await res.json()
    } catch (e) {
      if (e instanceof HttpError || intento >= retries) throw e
      await sleep(2000 * 2 ** intento) // 2 s, 4 s, 8 s
    } finally {
      clearTimeout(timer)
    }
  }
}

export const api = {
  // -> { data: [{ id, name, genus, types, sprite, artwork }], meta: { total, limit, offset } }
  list({ limit = 12, offset = 0, search, type } = {}) {
    const params = new URLSearchParams({ limit, offset })
    if (search) params.set('search', search)
    if (type) params.set('type', type)
    return get(`/api/pokemon?${params}`)
  },
  // -> detail object, or null when it does not exist
  detail: (idOrName) => get(`/api/pokemon/${encodeURIComponent(idOrName)}`),
  // -> { data: [{ name, pokemonCount }] }
  types: () => get('/api/types'),
}
