// Single place that talks to the data source.
// With VITE_API_URL set (e.g. in .env.local) it hits the professor's REST backend;
// without it, it uses a localStorage mock seeded from PokeAPI.
// Pokémon shape: { id, numero, nombre, tipos: [string], imagen, altura, peso }

const BASE = import.meta.env.VITE_API_URL

async function http(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}`)
  return res.status === 204 ? null : res.json()
}

const rest = {
  list: () => http('/pokemon'),
  create: (data) => http('/pokemon', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => http(`/pokemon/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => http(`/pokemon/${id}`, { method: 'DELETE' }),
}

// --- mock -------------------------------------------------------------------

const KEY = 'pokedex-mock'
const ES = {
  normal: 'normal', fire: 'fuego', water: 'agua', grass: 'planta', electric: 'eléctrico', ice: 'hielo',
  fighting: 'lucha', poison: 'veneno', ground: 'tierra', flying: 'volador', psychic: 'psíquico', bug: 'bicho',
  rock: 'roca', ghost: 'fantasma', dragon: 'dragón', dark: 'siniestro', steel: 'acero', fairy: 'hada',
}

const read = () => JSON.parse(localStorage.getItem(KEY))
const write = (all) => localStorage.setItem(KEY, JSON.stringify(all))

async function seed() {
  const ids = Array.from({ length: 151 }, (_, i) => i + 1)
  const all = await Promise.all(
    ids.map(async (id) => {
      const p = await (await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)).json()
      return {
        id: String(id),
        numero: id,
        nombre: p.name[0].toUpperCase() + p.name.slice(1),
        tipos: p.types.map((t) => ES[t.type.name] ?? t.type.name),
        imagen: p.sprites.other['official-artwork'].front_default,
        altura: p.height / 10,
        peso: p.weight / 10,
      }
    })
  )
  write(all)
  return all
}

const mock = {
  list: async () => read() ?? seed(),
  create: async (data) => {
    const p = { ...data, id: crypto.randomUUID() }
    write([...read(), p])
    return p
  },
  update: async (id, data) => {
    const p = { ...data, id }
    write(read().map((x) => (x.id === id ? p : x)))
    return p
  },
  remove: async (id) => write(read().filter((x) => x.id !== id)),
}

export const api = BASE ? rest : mock
export const TIPOS = Object.values(ES)
