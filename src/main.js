import './style.css'
import { api } from './api.js'

const $ = (s) => document.querySelector(s)
const grid = $('#grid')
const chips = $('#chips')
const search = $('#search')
const more = $('#more')
const status = $('#status')
const detail = $('#detail')

const PAGINA = 12
const TOTAL_POKEDEX = 151
let filtro = null // active type (API name, e.g. "fire")
let offset = 0
let total = 0
let consulta = 0 // id of the latest query, so slow responses of older ones are ignored

// API type names -> Spanish labels; the CSS classes use the Spanish name without accents
const TIPOS = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', grass: 'Planta', electric: 'Eléctrico', ice: 'Hielo',
  fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
}
const STATS = {
  hp: 'PS', attack: 'Ataque', defense: 'Defensa', specialAttack: 'Ataque Esp.', specialDefense: 'Defensa Esp.', speed: 'Velocidad',
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const nombre = (n) => n.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
const numero = (n) => `N.º ${String(n).padStart(4, '0')}`
const clase = (t) => (TIPOS[t] ?? 'otro').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
const tipo = (t) => `<span class="type t-${clase(t)}">${esc(TIPOS[t] ?? t)}</span>`
const medida = (n, unidad) => `${(n / 10).toLocaleString('es')} ${unidad}` // API gives decimetres / hectograms
const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#${id}" /></svg>`
// the first row is above the fold: load it right away with high priority (LCP)
const art = (src, primeras = false) =>
  src
    ? `<img src="${esc(src)}" alt="" ${primeras ? 'fetchpriority="high"' : 'loading="lazy"'} width="475" height="475" />`
    : `<svg class="empty-art" aria-hidden="true"><use href="#i-ball" /></svg>`

// "despertando" message when the backend is cold-starting
function conAviso(promesa, texto) {
  const t = setTimeout(() => (status.textContent = texto), 3000)
  return promesa.finally(() => {
    clearTimeout(t)
    status.textContent = ''
  })
}
const DESPERTANDO = 'Despertando el servidor… la primera carga puede tardar hasta un minuto.'

// --- list -------------------------------------------------------------------

const card = (p, i) => `
  <li>
    <button class="card" data-id="${p.id}">
      <span class="art">${art(p.artwork, i < 4)}</span>
      <span class="num">${numero(p.id)}</span>
      <span class="name" translate="no">${esc(nombre(p.name))}</span>
      <span class="types">${p.types.map(tipo).join('')}</span>
    </button>
  </li>`

const vacio = (texto, reintentar = false) =>
  `<li class="empty">${icon('i-ball')}<p>${texto}</p>${
    reintentar ? '<button class="btn blue" type="button" data-retry>Reintentar</button>' : ''
  }</li>`

// search and type live in the URL (?q=…&tipo=…) so the view survives a reload
function syncUrl() {
  const params = new URLSearchParams()
  if (search.value.trim()) params.set('q', search.value.trim())
  if (filtro) params.set('tipo', filtro)
  history.replaceState(null, '', params.size ? `?${params}` : location.pathname)
}

async function buscar({ append = false } = {}) {
  const id = ++consulta
  const q = search.value.trim().toLowerCase()
  if (!append) {
    syncUrl()
    offset = 0
    grid.setAttribute('aria-busy', 'true')
    grid.innerHTML = '<li class="sr-only">Cargando Pokédex…</li>' + '<li class="card skeleton"></li>'.repeat(PAGINA)
  }
  more.disabled = true
  try {
    let items
    if (/^#?\d+$/.test(q)) {
      // the API searches by name only; a number goes straight to the detail endpoint
      const p = await conAviso(api.detail(Number(q.replace('#', ''))), DESPERTANDO)
      items = p && (!filtro || p.types.includes(filtro)) ? [{ ...p, artwork: p.sprites.artworkOfficial }] : []
      total = items.length
    } else {
      const res = await conAviso(api.list({ limit: PAGINA, offset, search: q, type: filtro }), DESPERTANDO)
      items = res.data
      total = res.meta.total
    }
    if (id !== consulta) return
    offset += items.length
    const html = items.map((p, i) => card(p, append ? PAGINA : i)).join('')
    if (append) grid.insertAdjacentHTML('beforeend', html)
    else grid.innerHTML = html || vacio('Ningún Pokémon coincide con la búsqueda.')
    $('#count').textContent = `${total} Pokémon`
    more.hidden = offset >= total
  } catch (e) {
    if (id !== consulta) return
    const msg = navigator.onLine
      ? `No se pudo cargar la Pokédex (${esc(e.message)}).`
      : 'Estás sin conexión y esta búsqueda no está guardada.'
    if (append) status.textContent = msg
    else grid.innerHTML = vacio(msg, true)
  } finally {
    if (id === consulta) {
      grid.removeAttribute('aria-busy')
      more.disabled = false
    }
  }
}

async function cargarTipos() {
  try {
    const { data } = await api.types()
    chips.innerHTML = data
      .filter((t) => TIPOS[t.name])
      .sort((a, b) => Object.keys(TIPOS).indexOf(a.name) - Object.keys(TIPOS).indexOf(b.name))
      .map(
        (t) =>
          `<button class="type t-${clase(t.name)}" type="button" aria-pressed="${t.name === filtro}" data-tipo="${t.name}" title="${t.pokemonCount} Pokémon">${TIPOS[t.name]}</button>`
      )
      .join('')
  } catch {
    chips.closest('fieldset').hidden = true
  }
}

// --- detail -----------------------------------------------------------------

const evolucion = (e) =>
  `<button class="evo" type="button" data-evo="${e.id}">${art(
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${e.id}.png`
  )}<span>${numero(e.id)}</span><b translate="no">${esc(nombre(e.name))}</b></button>`

async function openDetail(idOrName) {
  detail.innerHTML = `<p class="loading">Cargando ficha…</p>`
  if (!detail.open) detail.showModal()
  let p
  try {
    p = await api.detail(idOrName)
  } catch (e) {
    detail.innerHTML = `<header class="sheet-head"><h2>Algo falló</h2><button class="close" type="button" data-close aria-label="Cerrar">${icon('i-close')}</button></header>
      <p class="loading">No se pudo cargar la ficha (${esc(e.message)}). Revisa tu conexión e inténtalo de nuevo.</p>`
    return
  }
  if (!p) {
    detail.innerHTML = `<header class="sheet-head"><h2>No encontrado</h2><button class="close" type="button" data-close aria-label="Cerrar">${icon('i-close')}</button></header>
      <p class="loading">Ese Pokémon no existe en la Pokédex.</p>`
    return
  }
  const evos = [p.evolvesFrom, ...(p.evolvesTo ?? [])].filter(Boolean)
  detail.innerHTML = `
    <header class="sheet-head">
      <h2><span translate="no">${esc(nombre(p.name))}</span> <span class="num">${numero(p.id)}</span></h2>
      <button class="close" type="button" data-close aria-label="Cerrar">${icon('i-close')}</button>
    </header>
    <div class="detail-grid">
      <div class="art big">${art(p.sprites.artworkOfficial)}</div>
      <div>
        <p class="flavor" lang="en">${esc(p.flavorText?.replace(/\s+/g, ' '))}</p>
        <dl class="info-box">
          <div><dt>Altura</dt><dd>${medida(p.height, 'm')}</dd></div>
          <div><dt>Peso</dt><dd>${medida(p.weight, 'kg')}</dd></div>
          <div><dt>Categoría</dt><dd>${esc(p.genus?.replace(/ Pokémon$/, ''))}</dd></div>
          <div><dt>Habilidad</dt><dd>${p.abilities
            .map((a) => `${esc(nombre(a.name))}${a.isHidden ? ' <small>(oculta)</small>' : ''}`)
            .join('<br>')}</dd></div>
        </dl>
        <h3>Tipo</h3>
        <div class="types big-types">${p.types.map(tipo).join('')}</div>
      </div>
    </div>
    <section class="detail-extra">
      <h3>Estadísticas base</h3>
      <dl class="stats">${Object.entries(STATS)
        .map(
          ([k, label]) =>
            `<div><dt>${label}</dt><dd><meter min="0" max="255" value="${p.stats[k]}"></meter><b>${p.stats[k]}</b></dd></div>`
        )
        .join('')}</dl>
      ${
        evos.length
          ? `<h3>Evoluciones</h3><div class="evos">${evos.map(evolucion).join(`<span class="evo-arrow">${icon('i-arrow')}</span>`)}</div>`
          : ''
      }
    </section>`
}

// --- wiring -----------------------------------------------------------------

let debounce
search.addEventListener('input', () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => buscar(), 300)
})
chips.addEventListener('click', (e) => {
  const c = e.target.closest('[data-tipo]')
  if (!c) return
  filtro = c.dataset.tipo === filtro ? null : c.dataset.tipo
  chips.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tipo === filtro))
  buscar()
})
more.addEventListener('click', () => buscar({ append: true }))
grid.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry]')) return buscar()
  const c = e.target.closest('.card[data-id]')
  if (c) openDetail(c.dataset.id)
})
$('#surprise').addEventListener('click', () => openDetail(1 + Math.floor(Math.random() * TOTAL_POKEDEX)))
detail.addEventListener('click', (e) => {
  if (e.target === detail || e.target.closest('[data-close]')) return detail.close()
  const evo = e.target.closest('[data-evo]')
  if (evo) openDetail(evo.dataset.evo)
})

const inicial = new URLSearchParams(location.search)
search.value = inicial.get('q') ?? ''
filtro = TIPOS[inicial.get('tipo')] ? inicial.get('tipo') : null

cargarTipos()
buscar()
