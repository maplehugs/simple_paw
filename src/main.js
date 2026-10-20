import './style.css'
import { api, TIPOS } from './api.js'

const $ = (s) => document.querySelector(s)
const grid = $('#grid')
const chips = $('#chips')
const search = $('#search')
const sort = $('#sort')
const more = $('#more')
const detail = $('#detail')
const editor = $('#editor')
const form = $('#form')

const PAGINA = 12
let all = []
let filtro = null // active type chip
let editing = null // pokémon being edited, null = creating
let visibles = PAGINA
let azar = new Map() // id -> random key, for "¡Sorpréndeme!"

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const numero = (n) => `N.º ${String(n).padStart(4, '0')}`
const slug = (t) => (TIPOS.includes(t) ? t.normalize('NFD').replace(/\p{M}/gu, '') : 'otro')
const tipos = (p) => p.tipos.map((t) => `<span class="type t-${slug(t)}">${esc(t)}</span>`).join('')
const medida = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('es'))
const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#${id}" /></svg>`
const art = (p, cls = '') =>
  p.imagen
    ? `<img class="${cls}" src="${esc(p.imagen)}" alt="" loading="lazy" width="475" height="475" />`
    : `<svg class="${cls} empty-art" aria-hidden="true"><use href="#i-ball" /></svg>`

function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.classList.add('on')
  clearTimeout(t.timer)
  t.timer = setTimeout(() => t.classList.remove('on'), 3500)
}

// --- list -------------------------------------------------------------------

const card = (p) => `
  <li>
    <button class="card" data-id="${esc(p.id)}">
      <span class="art">${art(p)}</span>
      <span class="num">${numero(p.numero)}</span>
      <span class="name" translate="no">${esc(p.nombre)}</span>
      <span class="types">${tipos(p)}</span>
    </button>
  </li>`

const ORDEN = {
  'num-asc': (a, b) => a.numero - b.numero,
  'num-desc': (a, b) => b.numero - a.numero,
  az: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
  za: (a, b) => b.nombre.localeCompare(a.nombre, 'es'),
  azar: (a, b) => (azar.get(a.id) ?? 0) - (azar.get(b.id) ?? 0),
}

// search, type filter and order live in the URL (?q=…&tipo=…&orden=…) so the view survives a reload
function syncUrl() {
  const params = new URLSearchParams()
  if (search.value.trim()) params.set('q', search.value.trim())
  if (filtro) params.set('tipo', filtro)
  if (sort.value !== 'num-asc' && sort.value !== 'azar') params.set('orden', sort.value)
  history.replaceState(null, '', params.size ? `?${params}` : location.pathname)
}

function filtrados() {
  const q = search.value.trim().toLowerCase().replace(/^#?0*/, '')
  return all
    .filter((p) => !filtro || p.tipos.includes(filtro))
    .filter((p) => !q || p.nombre.toLowerCase().includes(q) || String(p.numero) === q)
    .sort(ORDEN[sort.value])
}

function render() {
  syncUrl()
  const found = filtrados()

  $('#count').textContent = `${all.length} Pokémon`
  grid.innerHTML = found.length
    ? found.slice(0, visibles).map(card).join('')
    : `<li class="empty">${icon('i-ball')}<p>${
        all.length ? 'Ningún Pokémon coincide con la búsqueda.' : 'Tu Pokédex está vacía. Agrega el primer Pokémon.'
      }</p></li>`
  more.hidden = found.length <= visibles

  const presentes = TIPOS.filter((t) => all.some((p) => p.tipos.includes(t)))
  chips.innerHTML = presentes
    .map(
      (t) => `<button class="type t-${slug(t)}" type="button" aria-pressed="${t === filtro}" data-tipo="${t}">${t}</button>`
    )
    .join('')
}

const nuevaBusqueda = () => {
  visibles = PAGINA
  render()
}

async function load() {
  grid.setAttribute('aria-busy', 'true')
  grid.innerHTML = '<li class="sr-only">Cargando Pokédex…</li>' + '<li class="card skeleton"></li>'.repeat(PAGINA)
  try {
    all = await api.list()
    render()
  } catch {
    grid.innerHTML = `<li class="empty">${icon('i-ball')}<p>No se pudo cargar la Pokédex. Revisa tu conexión.</p>
      <button class="btn blue" id="retry" type="button">Reintentar</button></li>`
    $('#retry').onclick = load
  } finally {
    grid.removeAttribute('aria-busy')
  }
}

// --- detail -----------------------------------------------------------------

function openDetail(p) {
  detail.innerHTML = `
    <header class="sheet-head">
      <h2><span translate="no">${esc(p.nombre)}</span> <span class="num">${numero(p.numero)}</span></h2>
      <button class="close" type="button" data-close aria-label="Cerrar">${icon('i-close')}</button>
    </header>
    <div class="detail-grid">
      <div class="art big">${art(p)}</div>
      <div>
        <dl class="info-box">
          <div><dt>Altura</dt><dd>${medida(p.altura)} m</dd></div>
          <div><dt>Peso</dt><dd>${medida(p.peso)} kg</dd></div>
        </dl>
        <h3>Tipo</h3>
        <div class="types big-types">${tipos(p)}</div>
      </div>
    </div>
    <footer class="sheet-foot">
      <button class="btn danger" type="button" id="del">${icon('i-trash')}Eliminar</button>
      <button class="btn blue" type="button" id="edit">${icon('i-edit')}Editar</button>
    </footer>`
  detail.showModal()

  $('#edit').onclick = () => {
    detail.close()
    openEditor(p)
  }
  const del = $('#del')
  del.onclick = async () => {
    // first click arms, second confirms
    if (!del.classList.contains('armed')) {
      del.classList.add('armed')
      del.innerHTML = `${icon('i-trash')}¿Seguro? Eliminar`
      return
    }
    del.disabled = true
    try {
      await api.remove(p.id)
      detail.close()
      const el = grid.querySelector(`[data-id="${CSS.escape(p.id)}"]`)
      el?.classList.add('leaving')
      setTimeout(() => {
        all = all.filter((x) => x.id !== p.id)
        render()
      }, el ? 350 : 0)
      toast(`Eliminaste a ${p.nombre}.`)
    } catch (e) {
      del.disabled = false
      toast(`No se pudo eliminar (${e.message}). Revisa tu conexión e inténtalo de nuevo.`)
    }
  }
}

// --- create / edit ----------------------------------------------------------

const options = (blank) =>
  (blank ? '<option value="">Ninguno</option>' : '') + TIPOS.map((t) => `<option>${t}</option>`).join('')
form.tipo1.innerHTML = options(false)
form.tipo2.innerHTML = options(true)

function openEditor(p = null) {
  editing = p
  form.reset()
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'))
  $('#form-error').textContent = ''
  $('#form-title').textContent = p ? `Editar ${p.nombre}` : 'Nuevo Pokémon'
  if (p) {
    form.nombre.value = p.nombre
    form.numero.value = p.numero
    form.tipo1.value = p.tipos[0] ?? TIPOS[0]
    form.tipo2.value = p.tipos[1] ?? ''
    form.imagen.value = p.imagen ?? ''
    form.altura.value = p.altura ?? ''
    form.peso.value = p.peso ?? ''
  }
  editor.showModal()
}

form.addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'))
form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const err = $('#form-error')
  const bad = [...form.elements].find((el) => el.willValidate && !el.checkValidity())
  if (bad) {
    const v = bad.validity
    const why = v.valueMissing
      ? 'es obligatorio'
      : v.typeMismatch
        ? 'debe ser una URL que empiece por https://'
        : v.rangeUnderflow || v.rangeOverflow
          ? `debe estar entre ${bad.min || 0} y ${bad.max || '∞'}`
          : 'tiene un valor inválido'
    err.textContent = `“${bad.closest('label').firstChild.textContent.trim()}” ${why}.`
    bad.setAttribute('aria-invalid', 'true')
    bad.focus()
    return
  }
  const f = form.elements
  const data = {
    nombre: f.nombre.value.trim(),
    numero: Number(f.numero.value),
    tipos: [f.tipo1.value, f.tipo2.value].filter((t, i, a) => t && a.indexOf(t) === i),
    imagen: f.imagen.value.trim(),
    altura: f.altura.value === '' ? null : Number(f.altura.value),
    peso: f.peso.value === '' ? null : Number(f.peso.value),
  }
  const save = $('#save')
  save.disabled = true
  save.textContent = 'Guardando…'
  try {
    const saved = editing ? await api.update(editing.id, data) : await api.create(data)
    all = editing ? all.map((x) => (x.id === editing.id ? saved : x)) : [...all, saved]
    editor.close()
    filtro = null
    search.value = ''
    // make sure the saved card is on screen
    visibles = Math.max(PAGINA, filtrados().findIndex((x) => x.id === saved.id) + 1)
    render()
    const el = grid.querySelector(`[data-id="${CSS.escape(saved.id)}"]`)
    el?.classList.add('fresh')
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    toast(editing ? `Guardaste los cambios de ${saved.nombre}.` : `${saved.nombre} entró a tu Pokédex.`)
  } catch (e) {
    err.textContent = `No se pudo guardar (${e.message}). Revisa tu conexión e inténtalo de nuevo.`
  } finally {
    save.disabled = false
    save.textContent = 'Guardar'
  }
})

// --- wiring -----------------------------------------------------------------

search.addEventListener('input', nuevaBusqueda)
sort.addEventListener('change', () => {
  sort.querySelector('[value="azar"]').hidden = sort.value !== 'azar'
  nuevaBusqueda()
})
chips.addEventListener('click', (e) => {
  const c = e.target.closest('[data-tipo]')
  if (!c) return
  filtro = c.dataset.tipo === filtro ? null : c.dataset.tipo
  nuevaBusqueda()
})
$('#surprise').addEventListener('click', () => {
  azar = new Map(all.map((p) => [p.id, Math.random()]))
  sort.querySelector('[value="azar"]').hidden = false
  sort.value = 'azar'
  nuevaBusqueda()
})
more.addEventListener('click', () => {
  visibles += PAGINA
  render()
  grid.children[visibles - PAGINA]?.querySelector('button')?.focus({ preventScroll: true })
})
grid.addEventListener('click', (e) => {
  const c = e.target.closest('.card[data-id]')
  if (c) openDetail(all.find((p) => p.id === c.dataset.id))
})
$('#new').addEventListener('click', () => openEditor())
for (const d of [detail, editor]) {
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-close]')) d.close()
  })
}

const inicial = new URLSearchParams(location.search)
search.value = inicial.get('q') ?? ''
filtro = TIPOS.includes(inicial.get('tipo')) ? inicial.get('tipo') : null
if (ORDEN[inicial.get('orden')] && inicial.get('orden') !== 'azar') sort.value = inicial.get('orden')

load()
