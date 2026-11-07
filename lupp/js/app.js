// ============================================================
//  LUPP · App principal
//  Pestañas: Hoy · Finanzas · Agenda · Ajustes
// ============================================================

import * as db from './db.js';
import {
  DIAS_CORTOS, MESES, hoyISO, deISO, sumarDias, sumarMeses, inicioSemana, fechaLarga, capital,
  horaAmPm, minutosDe, ahoraMinutos, horaActual, pesos, soloDigitos, formatearDigitos, esc,
  ocurreEn, textoDias,
} from './utils.js';
import {
  CUENTAS_BASE, CATEGORIAS_BASE, COLORES, ICONOS_CATEGORIA, ICONOS_CUENTA,
} from './datos-base.js';
import { mostrarGuia } from './guia.js';
import { montarGrafico } from './graficos.js';
import { BANCOS, bancoDeCuenta, logoCuenta, esImagen } from './bancos.js';
import { num, numPct, barra, animarNumeros, celebrar, sonar, sonidoActivo, cambiarSonido } from './animaciones.js';
import { analizar, escoger } from './consejos.js';

// Carga los estilos "vivos" (animaciones y diseño nuevo) sin tocar index.html
if (!document.querySelector('link[href="css/vivo.css"]')) {
  const estilo = document.createElement('link');
  estilo.rel = 'stylesheet';
  estilo.href = 'css/vivo.css';
  document.head.append(estilo);
}

const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet-root');
const $toast = document.getElementById('toast');

// Preferencias guardadas en este dispositivo
const pref = {
  leer(k, def) { try { return localStorage.getItem('lupp:' + k) ?? def; } catch { return def; } },
  guardar(k, v) { try { localStorage.setItem('lupp:' + k, v); } catch { /* sin almacenamiento */ } },
};

const state = {
  tab: 'hoy',
  espacio: pref.leer('espacio', 'personal'),
  tema: pref.leer('tema', 'oscuro'),
  agendaFecha: hoyISO(),
  finMes: hoyISO().slice(0, 7),
  usuario: null,
  d: { cuentas: [], categorias: [], movimientos: [], actividades: [], tareas: [], diario: [], deudas: [] },
};

// ============================================================
//  Arranque
// ============================================================

async function arrancar() {
  aplicarTema();
  registrarServiceWorker();
  try {
    await db.iniciar();
    if (db.modoNube) {
      const s = await db.sesion();
      if (!s) return pantallaLogin('entrar');
      state.usuario = s.user;
    }
    await despuesDeEntrar();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<main class="login"><h1 class="logo grande">LUPP</h1>
      <p class="error">No se pudo iniciar: ${esc(err.message || err)}</p>
      <button class="btn btn-prim ancho" onclick="location.reload()">Reintentar</button></main>`;
  }
}

async function despuesDeEntrar() {
  await cargarTodo();
  render();
  iniciarAvisos();
  // La primera vez muestra la mini guía
  if (pref.leer('guia-vista', 'no') !== 'si') iniciarRecorrido();
}

// Recorrido guiado: le da a guia.js cómo moverse por la app
function iniciarRecorrido() {
  mostrarGuia({
    irTab: t => {
      if (state.tab === t) return;
      state.tab = t;
      render();
      window.scrollTo(0, 0);
    },
    abrirMenu: menuNuevo,
    cerrarMenu: () => { if (sheetActual) cerrarSheet(); },
    alTerminar: () => pref.guardar('guia-vista', 'si'),
  });
}

async function cargarTodo() {
  const res = await Promise.all(db.TABLAS.map(t => db.listar(t)));
  db.TABLAS.forEach((t, i) => { state.d[t] = res[i]; });
  // Primera vez en la nube con datos viejos en este dispositivo: ofrecer subirlos
  if (db.modoNube && !state.d.cuentas.length && db.hayDatosLocales() && pref.leer('migrado', '') === '') {
    const respuesta = await preguntarSubir();
    if (respuesta === true) {
      await subirDatos();
      return cargarTodo();
    }
    // "No" queda guardado; "Cancelar" pregunta otra vez la próxima vez
    if (respuesta === false) pref.guardar('migrado', 'no');
  }
  await sembrar('personal');
  if (state.espacio === 'empresa') await sembrar('empresa');
}

// Crea las cuentas y categorías iniciales de un espacio si no tiene
async function sembrar(espacio) {
  if (!state.d.cuentas.some(c => c.espacio === espacio)) {
    const filas = CUENTAS_BASE[espacio].map((c, i) => ({ ...c, espacio, orden: i, saldo_inicial: 0 }));
    state.d.cuentas.push(...await db.crearVarios('cuentas', filas));
  }
  if (!state.d.categorias.some(c => c.espacio === espacio)) {
    const filas = CATEGORIAS_BASE[espacio].map(c => ({ ...c, espacio }));
    state.d.categorias.push(...await db.crearVarios('categorias', filas));
  }
}

// Pregunta (con una hoja abajo) si subir los datos de este dispositivo
let respuestaSubir = null;
function preguntarSubir() {
  const r = db.resumenLocal();
  const partes = [
    [r.movimientos, 'movimiento'], [r.deudas, 'deuda'], [r.cuentas, 'cuenta'],
    [r.actividades, 'actividad'], [r.tareas, 'pendiente'], [r.diario, 'día de diario'],
  ].filter(([n]) => n).map(([n, t]) => `${n} ${t}${n === 1 ? '' : (t.endsWith('d') ? 'es' : 's')}`);
  return new Promise(ok => {
    respuestaSubir = ok;
    abrirSheet({
      titulo: 'Tus datos',
      cuerpo: `<div class="subir-caja">
          <span class="subir-icono"><i class="ti ti-cloud-upload"></i></span>
          <b>Encontramos datos guardados en este dispositivo</b>
          <p class="ayuda">${esc(partes.join(' · '))}</p>
          <p class="ayuda">¿Los subimos a tu cuenta? Así quedan guardados en la nube y los ves desde cualquier celular o PC.</p>
        </div>
        <button type="button" class="btn btn-prim ancho" data-accion="subir-si"><i class="ti ti-cloud-upload"></i> Sí, subirlos a mi cuenta</button>
        <button type="button" class="btn btn-sec ancho" data-accion="subir-no">No, empezar de cero</button>`,
    });
  });
}

async function subirDatos() {
  toast('Subiendo tus datos…');
  await db.subirDatosLocales();
  pref.guardar('migrado', 'si');
  celebrar({ tipo: 'ok', titulo: '¡Datos en la nube!', detalle: 'Ya puedes entrar desde cualquier celular o PC' });
}

function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker:', err));
  }
}

function aplicarTema() {
  const t = state.tema === 'sistema'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro')
    : state.tema;
  document.documentElement.dataset.tema = t;
  document.querySelector('meta[name="theme-color"]').content = t === 'claro' ? '#F7F4EE' : '#0B0B0C';
}

// ============================================================
//  Datos: ayudantes
// ============================================================

const porId = (lista, id) => lista.find(x => x.id === id);
const cuentasDe = esp => state.d.cuentas.filter(c => c.espacio === esp).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
const cuentasEsp = () => cuentasDe(state.espacio);
const categoriasEsp = () => state.d.categorias.filter(c => c.espacio === state.espacio);
const movsEsp = () => state.d.movimientos.filter(m => m.espacio === state.espacio);
const ordenMov = (a, b) => b.fecha.localeCompare(a.fecha) || (b.created_at || '').localeCompare(a.created_at || '');
const nombreEspacio = () => (state.espacio === 'empresa' ? 'Empresa' : 'Personal');

function saldoCuenta(c) {
  let s = Number(c.saldo_inicial) || 0;
  for (const m of state.d.movimientos) {
    const v = Number(m.monto);
    if (m.tipo === 'ingreso' && m.cuenta_id === c.id) s += v;
    else if (m.tipo === 'gasto' && m.cuenta_id === c.id) s -= v;
    else if (m.tipo === 'transferencia') {
      if (m.cuenta_id === c.id) s -= v;
      if (m.cuenta_destino_id === c.id) s += v;
    }
  }
  return s;
}

// Movimientos que tocan una cuenta (incluye transferencias que entran o salen)
function movsDeCuenta(c) {
  return state.d.movimientos
    .filter(m => m.cuenta_id === c.id || m.cuenta_destino_id === c.id)
    .sort(ordenMov);
}

// Cuánto entró y salió de una cuenta en las fechas que cumplan la condición
function entradasSalidas(c, cumple) {
  let entro = 0, salio = 0;
  for (const m of movsDeCuenta(c)) {
    if (!cumple(m.fecha)) continue;
    const v = Number(m.monto);
    if ((m.tipo === 'ingreso' && m.cuenta_id === c.id) || (m.tipo === 'transferencia' && m.cuenta_destino_id === c.id)) entro += v;
    if ((m.tipo === 'gasto' && m.cuenta_id === c.id) || (m.tipo === 'transferencia' && m.cuenta_id === c.id)) salio += v;
  }
  return { entro, salio };
}

function resumenMes(mes) {
  let ing = 0, gas = 0;
  for (const m of movsEsp()) {
    if (!m.fecha.startsWith(mes)) continue;
    if (m.tipo === 'ingreso') ing += Number(m.monto);
    else if (m.tipo === 'gasto') gas += Number(m.monto);
  }
  return { ing, gas };
}

function resumenDia(fecha) {
  let ing = 0, gas = 0;
  for (const m of movsEsp()) {
    if (m.fecha !== fecha) continue;
    if (m.tipo === 'ingreso') ing += Number(m.monto);
    else if (m.tipo === 'gasto') gas += Number(m.monto);
  }
  return { ing, gas };
}

function ocurrenciasDe(fecha) {
  return state.d.actividades
    .filter(a => ocurreEn(a, fecha))
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
}

// Pendientes del día; hoy también muestra los atrasados sin hacer
function tareasDe(fecha) {
  const hoy = hoyISO();
  const peso = { alta: 0, media: 1, baja: 2 };
  return state.d.tareas
    .filter(t => t.fecha === fecha || (fecha === hoy && t.fecha < hoy && !t.hecha))
    .sort((a, b) => (a.hecha - b.hecha) || (peso[a.prioridad] ?? 1) - (peso[b.prioridad] ?? 1));
}

// Guarda en la base de datos y actualiza el estado en memoria
async function guardarFila(tabla, id, datos) {
  if (id) {
    const fila = await db.actualizar(tabla, id, datos);
    state.d[tabla] = state.d[tabla].map(f => (f.id === id ? fila : f));
    return fila;
  }
  const fila = await db.crear(tabla, datos);
  state.d[tabla].push(fila);
  return fila;
}

function quitar(tabla, id) {
  state.d[tabla] = state.d[tabla].filter(f => f.id !== id);
}

// ============================================================
//  Dibujar pantallas
// ============================================================

let vistaAnterior = null;

function render() {
  aplicarTema();
  const vistas = { hoy: vistaHoy, finanzas: vistaFinanzas, agenda: vistaAgenda, ajustes: vistaAjustes };
  // Solo hay animación de entrada al cambiar de pestaña o de espacio, no al guardar
  const vista = `${state.tab}|${state.espacio}`;
  const entra = vista !== vistaAnterior;
  vistaAnterior = vista;
  $app.innerHTML = `<main class="pantalla${entra ? ' entrar' : ''}">${encabezado()}${vistas[state.tab]()}</main>${barraNav()}`;
  // El gráfico se dibuja después, cuando su caja ya existe en la pantalla
  if (state.tab === 'finanzas') montarGrafico(document.getElementById('grafico-finanzas'), movsEsp());
  animarNumeros($app);
}

function encabezado() {
  const titulos = { hoy: 'LUPP', finanzas: 'Finanzas', agenda: 'Agenda', ajustes: 'Ajustes' };
  const selector = state.tab === 'agenda' ? '' : `<div class="seg">${['personal', 'empresa'].map(e => `
      <button class="${state.espacio === e ? 'activo' : ''}" data-accion="espacio" data-valor="${e}">
        ${e === 'personal' ? 'Personal' : 'Empresa'}</button>`).join('')}</div>`;
  return `<header class="cabecera">
      <h1 class="${state.tab === 'hoy' ? 'logo' : ''}">${titulos[state.tab]}</h1>
      <span class="sub">${fechaLarga(hoyISO())}</span>
    </header>${selector}`;
}

function barraNav() {
  const b = (t, ico, txt) => `<button class="${state.tab === t ? 'activo' : ''}" data-accion="tab" data-valor="${t}">
      <i class="ti ti-${ico}"></i><span>${txt}</span></button>`;
  return `<nav class="nav">
      ${b('hoy', 'home', 'Hoy')}${b('finanzas', 'wallet', 'Finanzas')}
      <button class="fab" data-accion="nuevo" aria-label="Agregar"><i class="ti ti-plus"></i></button>
      ${b('agenda', 'calendar', 'Agenda')}${b('ajustes', 'settings', 'Ajustes')}
    </nav>`;
}

// Tarjeta de una cuenta con su logo; al tocarla se ve el detalle
function tarjetaCuenta(c) {
  const s = saldoCuenta(c);
  return `<button class="card cuenta" style="--c:${bancoDeCuenta(c).color}" data-accion="ver-cuenta" data-id="${c.id}">
      ${logoCuenta(c, 32)}<span>${esc(c.nombre)}</span><b class="${s < 0 ? 'rojo' : ''}">${num('cta-' + c.id, s)}</b></button>`;
}

// Calcula el saldo inicial para que la cuenta quede con "nuevo" de saldo actual.
// Así ajustar el saldo no cuenta como ganancia ni como gasto.
function saldoInicialPara(c, nuevo) {
  return (Number(c.saldo_inicial) || 0) + (nuevo - saldoCuenta(c));
}

// Suma o resta plata a una cuenta sin que cuente como ganancia ni gasto
// (se usa al prestar, al recibir abonos de deudas, etc.)
async function moverSaldo(cuentaId, cambio) {
  const c = porId(state.d.cuentas, cuentaId);
  if (!c || !cambio) return;
  await guardarFila('cuentas', c.id, { saldo_inicial: (Number(c.saldo_inicial) || 0) + cambio });
}

// ---------- Deudas: ayudantes ----------

const deudasEsp = () => (state.d.deudas || []).filter(d => (d.espacio || 'personal') === state.espacio);
const pagadoDe = d => (d.abonos || []).reduce((s, a) => s + Number(a.monto), 0);
const faltaDe = d => Math.max(0, Number(d.monto) - pagadoDe(d));
const pctDe = d => (Number(d.monto) ? Math.min(100, Math.round((pagadoDe(d) / Number(d.monto)) * 100)) : 0);
const saldada = d => Number(d.monto) > 0 && pagadoDe(d) >= Number(d.monto);

function iniciales(nombre) {
  const partes = String(nombre || '?').trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || '?') + (partes[1]?.[0] || '')).toUpperCase();
}

// Foto redonda de la deuda (o sus iniciales)
function avatar(d, tamano = 44) {
  const color = d.tipo === 'debo' ? '#8B1E2D' : '#2E7D32';
  return `<span class="avatar" style="--c:${color}; --t:${tamano}px">${esImagen(d.foto)
    ? `<img src="${d.foto}" alt="">`
    : `<b>${esc(iniciales(d.nombre))}</b>`}</span>`;
}

// Selector de foto/logo para los formularios
function selectorFoto(foto, texto) {
  const hay = esImagen(foto);
  return `<div class="foto-picker">
      <label class="foto-circulo" aria-label="Elegir imagen">
        <input type="file" accept="image/*" data-foto-input hidden>
        <span class="foto-vista">${hay ? `<img src="${foto}" alt="">` : '<i class="ti ti-camera-plus"></i>'}</span>
        <span class="foto-lapiz"><i class="ti ti-pencil"></i></span>
      </label>
      <input type="hidden" name="foto" value="${hay ? foto : ''}">
      <div class="foto-texto"><b>${texto}</b><small>Toca el círculo para elegir una imagen</small>
        <button type="button" class="link gris" data-accion="quitar-foto" ${hay ? '' : 'hidden'}>Quitar imagen</button></div>
    </div>`;
}

// Recorta la imagen en cuadrado y la achica para guardarla liviana
function leerFoto(archivo, lado = 192) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = lado;
      const lado0 = Math.min(img.naturalWidth, img.naturalHeight);
      c.getContext('2d').drawImage(img,
        (img.naturalWidth - lado0) / 2, (img.naturalHeight - lado0) / 2, lado0, lado0, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/webp', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

// ---------- Hoy ----------

function vistaHoy() {
  const hoy = hoyISO();
  const ahora = ahoraMinutos();
  const ocs = ocurrenciasDe(hoy);
  const actual = ocs.find(a => {
    const ini = minutosDe(a.hora_inicio);
    const fin = a.hora_fin ? minutosDe(a.hora_fin) : ini + 60;
    return ini <= ahora && ahora < fin;
  });
  const siguiente = ocs.find(a => minutosDe(a.hora_inicio) > ahora);
  const { ing, gas } = resumenDia(hoy);
  const cuentas = cuentasEsp();
  const total = cuentas.reduce((s, c) => s + saldoCuenta(c), 0);
  const movsHoy = movsEsp().filter(m => m.fecha === hoy).sort(ordenMov);

  return `
    <section class="card ahora">
      ${actual
        ? `<div class="etq oro">Ahora toca · ${horaAmPm(actual.hora_inicio)}${actual.hora_fin ? ' – ' + horaAmPm(actual.hora_fin) : ''}</div>
           <div class="grande">${esc(actual.titulo)}</div>`
        : `<div class="etq oro">Ahora</div><div class="grande">Tiempo libre</div>`}
      <div class="etq">${siguiente ? `Sigue: ${horaAmPm(siguiente.hora_inicio)} · ${esc(siguiente.titulo)}` : 'No hay más actividades hoy'}</div>
    </section>
    <div class="metricas">
      <div class="card metrica"><span class="etq">Gané hoy</span><b class="verde">${num('hoy-ing-' + state.espacio, ing)}</b></div>
      <div class="card metrica"><span class="etq">Gasté hoy</span><b class="rojo">${num('hoy-gas-' + state.espacio, gas)}</b></div>
    </div>
    ${tarjetaCoach(total)}
    <h2 class="titulo-sec">Mis cuentas
      <button class="link" data-accion="nueva-cuenta">+ Nueva</button></h2>
    <div class="cuentas-scroll">${cuentas.map(tarjetaCuenta).join('')}</div>
    <h2 class="titulo-sec">Pendientes de hoy
      <button class="link" data-accion="nueva-tarea" data-fecha="${hoy}">+ Agregar</button></h2>
    ${listaTareas(tareasDe(hoy))}
    <h2 class="titulo-sec">Movimientos de hoy
      <button class="link" data-accion="tab" data-valor="finanzas">Ver todo</button></h2>
    ${movsHoy.length
      ? `<div class="card lista">${movsHoy.map(filaMov).join('')}</div>`
      : `<div class="vacio">Hoy no has registrado movimientos. Toca <b>+</b> para agregar uno.</div>`}`;
}

// ---------- Coach de plata ----------

let otraFrase = 0;
let ultimaFrase = '';

function tarjetaCoach(total) {
  const hoy = hoyISO();
  const a = analizar({
    movs: movsEsp(), total, categorias: categoriasEsp(), deudas: deudasEsp(), hoy,
  });
  const frase = escoger(a.frases, hoy + a.clave + state.espacio, otraFrase);
  const nueva = frase !== ultimaFrase;
  ultimaFrase = frase;
  const { ing, gas } = a.mes;
  const usado = ing ? Math.round((gas / ing) * 100) : (gas ? 100 : 0);
  const tono = usado < 70 ? 'bien' : usado < 100 ? 'ojo' : 'mal';

  return `<section class="card coach animo-${a.animo}">
      <div class="coach-cab">
        <span class="coach-icono"><i class="ti ti-${a.icono}"></i></span>
        <span class="coach-nombre">Tu coach de plata</span>
        <button class="coach-otra" data-accion="otra-frase" aria-label="Otra frase"><i class="ti ti-refresh"></i></button>
      </div>
      <p class="coach-frase${nueva ? ' nueva' : ''}">“${esc(frase)}”</p>
      <p class="coach-consejo"><i class="ti ti-bulb"></i><span>${esc(a.consejo)}</span></p>
      ${ing || gas ? `
        <div class="coach-uso">
          <div class="fila-sb"><small>${ing ? 'Este mes gastaste' : 'Este mes'}</small>
            <small><b class="tono-${tono}">${ing ? numPct('coach-uso-' + state.espacio, usado) : 'sin ingresos'}</b>${ing ? ' de lo que ganaste' : ''}</small></div>
          ${barra('coach-' + state.espacio, Math.min(100, usado), 'tono-' + tono)}
        </div>` : ''}
      <div class="coach-pie">
        <span>Llevo en total · ${nombreEspacio()}</span>
        <b class="${total < 0 ? 'rojo' : ''}">${num('total-' + state.espacio, total)}</b>
      </div>
    </section>`;
}

// ---------- Deudas: tarjetas ----------

function tarjetaDeuda(d) {
  const p = pctDe(d);
  const lista = saldada(d);
  const meDebe = d.tipo !== 'debo';
  return `<button class="card deuda ${lista ? 'saldada' : 'pendiente'}" data-accion="ver-deuda" data-id="${d.id}">
      <div class="deuda-cab">
        ${avatar(d, 44)}
        <span class="deuda-txt"><b>${esc(d.nombre)}</b>
          <small>${lista ? (meDebe ? 'Ya te pagó todo' : 'Ya pagaste todo') : `${meDebe ? 'Te debe' : 'Le debes'} ${pesos(faltaDe(d))}`}</small></span>
        <span class="deuda-pct">${lista ? '<i class="ti ti-circle-check-filled"></i>' : numPct('deuda-pct-' + d.id, p)}</span>
      </div>
      ${barra('deuda-' + d.id, p)}
      <div class="deuda-pie"><small>${meDebe ? 'Me ha pagado' : 'He pagado'} ${pesos(pagadoDe(d))}</small><small>de ${pesos(d.monto)}</small></div>
    </button>`;
}

function seccionDeudas() {
  const lista = deudasEsp().sort((a, b) => saldada(a) - saldada(b) || (b.fecha || '').localeCompare(a.fecha || ''));
  const meDeben = lista.filter(d => d.tipo !== 'debo').reduce((s, d) => s + faltaDe(d), 0);
  const debo = lista.filter(d => d.tipo === 'debo').reduce((s, d) => s + faltaDe(d), 0);
  return `
    <h2 class="titulo-sec">Deudas
      <button class="link" data-accion="nueva-deuda">+ Nueva</button></h2>
    <div class="metricas">
      <div class="card metrica"><span class="etq">Me deben</span><b class="verde">${num('deben-' + state.espacio, meDeben)}</b></div>
      <div class="card metrica"><span class="etq">Debo</span><b class="rojo">${num('debo-' + state.espacio, debo)}</b></div>
    </div>
    ${lista.length
      ? `<div class="deudas-lista">${lista.map(tarjetaDeuda).join('')}</div>`
      : `<button class="vacio vacio-boton" data-accion="nueva-deuda"><i class="ti ti-user-dollar"></i> ¿Le prestaste a alguien o debes algo? Anótalo aquí.</button>`}`;
}

function filaMov(m) {
  const cat = porId(state.d.categorias, m.categoria_id);
  const cta = porId(state.d.cuentas, m.cuenta_id);
  let icono, titulo, clase, monto, color;
  if (m.tipo === 'transferencia') {
    const dest = porId(state.d.cuentas, m.cuenta_destino_id);
    icono = 'arrows-exchange';
    titulo = `${cta?.nombre ?? '?'} → ${dest?.nombre ?? '?'}`;
    clase = '';
    monto = pesos(m.monto);
    color = 'var(--text2)';
  } else {
    icono = cat?.icono || 'dots';
    titulo = cat?.nombre || 'Sin categoría';
    clase = m.tipo === 'ingreso' ? 'verde' : 'rojo';
    monto = pesos(m.tipo === 'ingreso' ? m.monto : -m.monto, true);
    color = cat?.color || 'var(--text3)';
  }
  const detalle = [m.nota, m.tipo !== 'transferencia' ? cta?.nombre : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="fila" data-accion="editar-mov" data-id="${m.id}">
      <span class="ico" style="--c:${color}"><i class="ti ti-${icono}"></i></span>
      <span class="txt"><b>${esc(titulo)}</b><small>${esc(detalle)}</small></span>
      <span class="monto ${clase}">${monto}</span>
    </button>`;
}

function listaTareas(tareas) {
  if (!tareas.length) return `<div class="vacio">Nada pendiente.</div>`;
  const hoy = hoyISO();
  return `<div class="card lista">${tareas.map(t => `
      <div class="fila tarea ${t.hecha ? 'hecha' : ''}">
        <button class="check" data-accion="tarea-toggle" data-id="${t.id}" aria-label="Marcar como hecha">
          <i class="ti ti-${t.hecha ? 'square-check' : 'square'}"></i></button>
        <button class="txt" data-accion="editar-tarea" data-id="${t.id}">
          <b>${esc(t.titulo)}</b>${t.fecha < hoy && !t.hecha ? '<small class="rojo">Atrasada</small>' : ''}</button>
        <span class="prio ${t.prioridad}"></span>
        <button class="icon-btn" data-accion="tarea-borrar" data-id="${t.id}" aria-label="Borrar"><i class="ti ti-x"></i></button>
      </div>`).join('')}</div>`;
}

// ---------- Finanzas ----------

function vistaFinanzas() {
  const mes = state.finMes;
  const [y, m] = mes.split('-').map(Number);
  const { ing, gas } = resumenMes(mes);
  const balance = ing - gas;
  const movs = movsEsp().filter(x => x.fecha.startsWith(mes)).sort(ordenMov);

  const porCat = {};
  for (const x of movs) if (x.tipo === 'gasto') porCat[x.categoria_id] = (porCat[x.categoria_id] || 0) + Number(x.monto);
  const barras = Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([id, v]) => {
    const c = porId(state.d.categorias, id);
    const pct = gas ? Math.round((v / gas) * 100) : 0;
    const color = c?.color || '#71717A';
    return `<div class="barra-fila">
        <span class="ico chico" style="--c:${color}"><i class="ti ti-${c?.icono || 'dots'}"></i></span>
        <div class="barra-info">
          <div class="fila-sb"><span>${esc(c?.nombre || 'Sin categoría')}</span><span>${pesos(v)} · ${pct}%</span></div>
          <div class="barra"><i style="width:${pct}%;background:${color}"></i></div>
        </div></div>`;
  }).join('');

  const grupos = {};
  for (const x of movs) (grupos[x.fecha] ||= []).push(x);

  return `
    <div class="mes-nav">
      <button class="icon-btn" data-accion="mes" data-valor="-1" aria-label="Mes anterior"><i class="ti ti-chevron-left"></i></button>
      <b>${MESES[m - 1]} ${y}</b>
      <button class="icon-btn" data-accion="mes" data-valor="1" aria-label="Mes siguiente"><i class="ti ti-chevron-right"></i></button>
    </div>
    <div class="metricas tres">
      <div class="card metrica"><span class="etq">Gané</span><b class="verde">${num(`mes-ing-${state.espacio}-${mes}`, ing)}</b></div>
      <div class="card metrica"><span class="etq">Gasté</span><b class="rojo">${num(`mes-gas-${state.espacio}-${mes}`, gas)}</b></div>
      <div class="card metrica"><span class="etq">Me quedó</span><b class="${balance < 0 ? 'rojo' : 'verde'}">${num(`mes-bal-${state.espacio}-${mes}`, balance)}</b></div>
    </div>
    <h2 class="titulo-sec">Gané vs gasté · ${nombreEspacio()}</h2>
    <div id="grafico-finanzas"></div>
    <h2 class="titulo-sec">Mis cuentas
      <button class="link" data-accion="nueva-cuenta">+ Nueva</button></h2>
    <div class="cuentas-scroll">
      ${cuentasEsp().map(tarjetaCuenta).join('')}
      <button class="card cuenta nueva" data-accion="nueva-cuenta"><i class="ti ti-plus"></i><span>Nueva cuenta</span></button>
    </div>
    ${seccionDeudas()}
    ${gas ? `<h2 class="titulo-sec">¿En qué se fue la plata?</h2><div class="card">${barras}</div>` : ''}
    <h2 class="titulo-sec">Movimientos
      <button class="link" data-accion="nuevo-mov" data-valor="gasto">+ Agregar</button></h2>
    ${movs.length
      ? Object.entries(grupos).map(([f, lista]) => `
          <div class="dia-grupo">${fechaLarga(f)}</div>
          <div class="card lista">${lista.map(filaMov).join('')}</div>`).join('')
      : '<div class="vacio">No hay movimientos este mes.</div>'}`;
}

// ---------- Agenda ----------

function vistaAgenda() {
  const f = state.agendaFecha;
  const hoy = hoyISO();
  const ini = inicioSemana(f);
  const semana = Array.from({ length: 7 }, (_, i) => sumarDias(ini, i));
  const ocs = ocurrenciasDe(f);
  const diario = state.d.diario.find(x => x.fecha === f);
  const fd = deISO(f);

  return `
    <div class="mes-nav">
      <button class="icon-btn" data-accion="semana" data-valor="-7" aria-label="Semana anterior"><i class="ti ti-chevron-left"></i></button>
      <b>${MESES[fd.getMonth()]} ${fd.getFullYear()}</b>
      ${f !== hoy ? `<button class="link" data-accion="dia" data-valor="${hoy}">Hoy</button>` : ''}
      <button class="icon-btn" data-accion="semana" data-valor="7" aria-label="Semana siguiente"><i class="ti ti-chevron-right"></i></button>
    </div>
    <div class="semana">${semana.map(d => {
      const dd = deISO(d);
      const tiene = state.d.actividades.some(a => ocurreEn(a, d));
      return `<button class="dia ${d === f ? 'activo' : ''} ${d === hoy ? 'hoy' : ''}" data-accion="dia" data-valor="${d}">
          <small>${DIAS_CORTOS[dd.getDay()]}</small><b>${dd.getDate()}</b>${tiene ? '<i class="punto"></i>' : ''}</button>`;
    }).join('')}</div>
    <div class="dia-titulo">${capital(fechaLarga(f))}</div>
    ${ocs.length ? ocs.map(a => bloqueActividad(a, f)).join('') : '<div class="vacio">No tienes actividades este día.</div>'}
    <button class="btn btn-sec ancho" data-accion="nueva-act" data-fecha="${f}"><i class="ti ti-plus"></i> Nueva actividad</button>
    <h2 class="titulo-sec">Pendientes
      <button class="link" data-accion="nueva-tarea" data-fecha="${f}">+ Agregar</button></h2>
    ${listaTareas(tareasDe(f))}
    <h2 class="titulo-sec">Diario</h2>
    <textarea class="diario" data-diario="${f}" placeholder="¿Cómo te fue hoy? Escribe lo que quieras…">${esc(diario?.texto || '')}</textarea>
    <small class="ayuda">Se guarda solo cuando sales del cuadro.</small>`;
}

function bloqueActividad(a, f) {
  const tipo = a.monto ? 'pago' : (a.repetir === 'nunca' ? 'unico' : 'rutina');
  const pagado = (a.pagados || []).includes(f);
  const repeticion = {
    nunca: 'Solo este día',
    diario: 'Todos los días',
    semanal: textoDias(a.dias),
    mensual: 'Cada mes, día ' + deISO(a.fecha).getDate(),
  }[a.repetir];
  const horas = a.hora_fin ? `${horaAmPm(a.hora_inicio)} – ${horaAmPm(a.hora_fin)} · ` : '';
  const avisos = (a.avisos || []).length ? ` · <i class="ti ti-bell"></i> ${a.avisos.length}` : '';
  const derecha = a.monto
    ? `<span class="rojo">${pesos(a.monto)}</span>`
    : (a.repetir !== 'nunca' ? '<i class="ti ti-repeat"></i>' : '');
  return `<div class="bloque ${tipo}">
      <span class="hora">${horaAmPm(a.hora_inicio)}</span>
      <button class="ev" data-accion="editar-act" data-id="${a.id}" data-fecha="${f}">
        <span class="fila-sb"><b>${esc(a.titulo)}</b>${derecha}</span>
        <small>${horas}${repeticion}${avisos}</small>
      </button>
      ${a.monto ? (pagado
        ? '<span class="pagado"><i class="ti ti-check"></i> Pagado</span>'
        : `<button class="btn-mini" data-accion="pagar" data-id="${a.id}" data-fecha="${f}">Marcar pagado</button>`) : ''}
    </div>`;
}

// ---------- Ajustes ----------

function vistaAjustes() {
  const permiso = 'Notification' in window ? Notification.permission : 'no-soportado';
  const notif = {
    granted: '<p><i class="ti ti-bell-check verde"></i> Notificaciones activadas</p>',
    denied: '<p>Las notificaciones están bloqueadas. Actívalas en Chrome: ⋮ → Configuración → Configuración de sitios → Notificaciones.</p>',
    'no-soportado': '<p>Este navegador no soporta notificaciones.</p>',
  }[permiso] || '<button class="btn btn-prim ancho" data-accion="permiso"><i class="ti ti-bell"></i> Activar notificaciones</button>';

  return `
    <h2 class="titulo-sec">Apariencia</h2>
    <div class="seg seg-tema">${[['oscuro', 'Oscuro'], ['claro', 'Claro'], ['sistema', 'Automático']].map(([v, t]) => `
      <button class="${state.tema === v ? 'activo' : ''}" data-accion="tema" data-valor="${v}">${t}</button>`).join('')}</div>

    <h2 class="titulo-sec">Sonido al guardar</h2>
    <div class="seg seg-sonido">${[['si', 'Con sonido'], ['no', 'En silencio']].map(([v, t]) => `
      <button class="${(sonidoActivo() ? 'si' : 'no') === v ? 'activo' : ''}" data-accion="sonido" data-valor="${v}">${t}</button>`).join('')}</div>

    <h2 class="titulo-sec">Notificaciones</h2>
    <div class="card card-notif">
      ${notif}
      <button class="btn btn-sec ancho" data-accion="probar-aviso">Probar un aviso</button>
      <small class="ayuda">Los avisos suenan mientras LUPP esté abierta o en segundo plano.</small>
    </div>

    <h2 class="titulo-sec">Cuentas · ${nombreEspacio()}
      <button class="link" data-accion="nueva-cuenta">+ Nueva</button></h2>
    <div class="card lista">${cuentasEsp().map(c => `
      <button class="fila" data-accion="editar-cuenta" data-id="${c.id}">
        ${logoCuenta(c, 36)}
        <span class="txt"><b>${esc(c.nombre)}</b><small>Saldo inicial ${pesos(c.saldo_inicial)}</small></span>
        <span class="monto">${pesos(saldoCuenta(c))}</span>
      </button>`).join('') || '<div class="vacio">Sin cuentas</div>'}</div>

    <h2 class="titulo-sec">Categorías · ${nombreEspacio()}
      <button class="link" data-accion="nueva-categoria">+ Nueva</button></h2>
    <div class="chips">${categoriasEsp().sort((a, b) => a.tipo.localeCompare(b.tipo)).map(c => `
      <button class="chip" data-accion="editar-categoria" data-id="${c.id}">
        <i class="ti ti-${c.icono}" style="color:${c.color}"></i>${esc(c.nombre)}</button>`).join('')}</div>

    <h2 class="titulo-sec">Mis datos</h2>
    <div class="card">
      <p>${db.modoNube
        ? `<i class="ti ti-cloud-check verde"></i> Guardado en la nube<br><small class="etq">Entraste como <b>${esc(state.usuario?.email || '')}</b></small>`
        : '<i class="ti ti-device-mobile"></i> Guardado solo en este dispositivo (modo local). Configura Supabase en <code>config.js</code> para guardar en la nube.'}</p>
      <button class="btn btn-sec ancho" data-accion="exportar"><i class="ti ti-download"></i> Exportar movimientos (Excel/CSV)</button>
      ${db.modoNube && db.hayDatosLocales() ? '<button class="btn btn-sec ancho" data-accion="subir-ahora"><i class="ti ti-cloud-upload"></i> Subir datos de este dispositivo a mi cuenta</button>' : ''}
      ${db.modoNube ? '<button class="btn btn-peligro ancho" data-accion="salir"><i class="ti ti-logout"></i> Cerrar sesión</button>' : ''}
    </div>
    <h2 class="titulo-sec">Ayuda</h2>
    <button class="btn btn-sec ancho" data-accion="guia"><i class="ti ti-help-circle"></i> Ver guía de uso</button>
    <p class="version">LUPP v1.4 · Hecho en Barranquilla</p>`;
}

// ============================================================
//  Hoja inferior (formularios)
// ============================================================

let sheetActual = null;
let sheetTurno = 0;

function abrirSheet({ titulo, cuerpo, guardar, borrar, confirmarBorrar, alAbrir }) {
  // Si ya había una hoja abierta, el fondo oscuro no vuelve a aparecer (evita parpadeo)
  const yaAbierta = Boolean($sheet.firstElementChild) && !$sheet.classList.contains('saliendo');
  sheetTurno++;
  $sheet.classList.remove('saliendo');
  sheetActual = { guardar, borrar, confirmarBorrar };
  $sheet.innerHTML = `
    <div class="overlay${yaAbierta ? ' quieto' : ''}" data-accion="cerrar-sheet"></div>
    <form class="sheet" novalidate>
      <div class="sheet-cab">
        <button type="button" class="link gris" data-accion="cerrar-sheet">Cancelar</button>
        <b>${titulo}</b>
        ${guardar ? '<button type="submit" class="link">Guardar</button>' : '<span style="width:60px"></span>'}
      </div>
      <div class="sheet-cuerpo">
        ${cuerpo}
        <p class="error" hidden></p>
        ${borrar ? '<button type="button" class="btn btn-peligro ancho" data-accion="borrar-sheet"><i class="ti ti-trash"></i> Borrar</button>' : ''}
      </div>
    </form>`;
  document.body.classList.add('sin-scroll');
  const form = $sheet.querySelector('form');
  alAbrir?.(form);
}

function cerrarSheet() {
  // Si estaba preguntando si subir los datos y se canceló, seguir sin subir (por ahora)
  if (respuestaSubir) { const ok = respuestaSubir; respuestaSubir = null; ok('luego'); }
  sheetActual = null;
  document.body.classList.remove('sin-scroll');
  if (!$sheet.firstElementChild) return;
  // Baja suave y luego se borra (si no se abrió otra hoja mientras tanto)
  const turno = ++sheetTurno;
  $sheet.classList.add('saliendo');
  setTimeout(() => {
    if (turno !== sheetTurno) return;
    $sheet.innerHTML = '';
    $sheet.classList.remove('saliendo');
  }, 260);
}

// Muestra un error en el formulario y devuelve false para no cerrarlo
function falla(msg) {
  const p = $sheet.querySelector('.error');
  if (p) { p.textContent = msg; p.hidden = false; }
  return false;
}

function preguntarAlcance(titulo, alElegir) {
  abrirSheet({
    titulo,
    cuerpo: `<p class="ayuda">Esta actividad se repite. ¿A cuáles aplicar?</p>
      <button type="button" class="btn btn-sec ancho" data-accion="alcance" data-valor="solo">Solo este día</button>
      <button type="button" class="btn btn-sec ancho" data-accion="alcance" data-valor="siguientes">Este y los siguientes</button>
      <button type="button" class="btn btn-sec ancho" data-accion="alcance" data-valor="todas">Todas</button>`,
  });
  sheetActual.alcance = alElegir;
}

function menuNuevo() {
  abrirSheet({
    titulo: 'Agregar',
    cuerpo: `<div class="menu-rapido">
      <button type="button" data-accion="nuevo-mov" data-valor="gasto"><i class="ti ti-arrow-down-right rojo"></i>Gasto</button>
      <button type="button" data-accion="nuevo-mov" data-valor="ingreso"><i class="ti ti-arrow-up-right verde"></i>Ingreso</button>
      <button type="button" data-accion="nuevo-mov" data-valor="transferencia"><i class="ti ti-arrows-exchange"></i>Transferir</button>
      <button type="button" data-accion="nueva-act"><i class="ti ti-calendar-plus oro"></i>Actividad</button>
      <button type="button" data-accion="nueva-deuda"><i class="ti ti-user-dollar oro"></i>Deuda</button>
      <button type="button" data-accion="nueva-tarea"><i class="ti ti-checkbox oro"></i>Pendiente</button>
      <button type="button" data-accion="diario"><i class="ti ti-notebook oro"></i>Diario</button>
    </div>`,
  });
}

// ---------- Movimiento ----------

function formMovimiento(mov, tipoInicial = 'gasto', cuentaInicial = null) {
  const nuevo = !mov;
  const cuentaElegida = porId(state.d.cuentas, cuentaInicial);
  const espacio = mov?.espacio || cuentaElegida?.espacio || state.espacio;
  const cuentas = cuentasDe(espacio);
  const m = mov || {
    tipo: tipoInicial, monto: 0,
    cuenta_id: cuentaElegida?.id || cuentas[0]?.id,
    cuenta_destino_id: cuentas.find(c => c.id !== (cuentaElegida?.id || cuentas[0]?.id))?.id,
    categoria_id: null, fecha: state.tab === 'agenda' ? state.agendaFecha : hoyISO(), nota: '',
  };
  const cats = state.d.categorias.filter(c => c.espacio === espacio);
  const opciones = sel => cuentas.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
  const chips = tipo => cats.filter(c => c.tipo === tipo).map(c => `
      <label class="cat cat-${tipo}"><input type="radio" name="categoria_id" value="${c.id}" ${c.id === m.categoria_id ? 'checked' : ''}>
        <span style="--c:${c.color}"><i class="ti ti-${c.icono}"></i>${esc(c.nombre)}</span></label>`).join('');

  abrirSheet({
    titulo: nuevo ? 'Nuevo movimiento' : 'Editar movimiento',
    cuerpo: `
      <div class="seg">${[['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['transferencia', 'Transferir']].map(([v, t]) => `
        <label><input type="radio" name="tipo" value="${v}" ${m.tipo === v ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
      <div class="monto-input"><span>$</span>
        <input name="monto" data-monto inputmode="numeric" autocomplete="off" placeholder="0" value="${formatearDigitos(Number(m.monto))}"></div>
      <div class="rapidos">${[1000, 5000, 10000, 20000, 50000, 100000].map(v => `
        <button type="button" class="chip" data-accion="sumar-monto" data-valor="${v}">+${formatearDigitos(v)}</button>`).join('')}</div>
      <label class="campo"><span class="no-trans">Cuenta</span><span class="si-trans">Desde</span>
        <select name="cuenta_id">${opciones(m.cuenta_id)}</select></label>
      <label class="campo si-trans"><span>Hacia</span>
        <select name="cuenta_destino_id">${opciones(m.cuenta_destino_id)}</select></label>
      <div class="campo no-trans"><span>Categoría</span><div class="cats">${chips('gasto')}${chips('ingreso')}</div></div>
      <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${m.fecha}"></label>
      <label class="campo"><span>Nota (opcional)</span>
        <input name="nota" value="${esc(m.nota)}" placeholder="Almuerzo, pasaje, cliente…" maxlength="120"></label>`,
    alAbrir: form => {
      form.dataset.tipo = m.tipo;
      if (nuevo) form.querySelector('[name=monto]').focus();
    },
    borrar: nuevo ? null : async () => {
      await db.borrar('movimientos', mov.id);
      quitar('movimientos', mov.id);
      toast('Movimiento borrado');
    },
    guardar: async (form, fd) => {
      const tipo = fd.get('tipo');
      const datos = {
        espacio, tipo,
        monto: soloDigitos(fd.get('monto')),
        cuenta_id: fd.get('cuenta_id'),
        cuenta_destino_id: null,
        categoria_id: null,
        fecha: fd.get('fecha') || hoyISO(),
        nota: (fd.get('nota') || '').trim(),
      };
      if (!datos.monto) return falla('Escribe cuánto fue.');
      if (!datos.cuenta_id) return falla('Primero crea una cuenta en Ajustes.');
      if (tipo === 'transferencia') {
        datos.cuenta_destino_id = fd.get('cuenta_destino_id');
        if (datos.cuenta_destino_id === datos.cuenta_id) return falla('Elige dos cuentas distintas.');
      } else {
        const cat = porId(state.d.categorias, fd.get('categoria_id'));
        if (!cat || cat.tipo !== tipo) return falla('Elige una categoría.');
        datos.categoria_id = cat.id;
      }
      await guardarFila('movimientos', mov?.id, datos);
      const cta = porId(state.d.cuentas, datos.cuenta_id);
      const dest = porId(state.d.cuentas, datos.cuenta_destino_id);
      const nombreCta = cta?.nombre || 'la cuenta';
      if (!nuevo) {
        celebrar({ tipo: tipo === 'transferencia' ? 'ok' : tipo, titulo: '¡Cambios guardados!',
          frase: 'Ahora el monto es', monto: datos.monto, detalle: nombreCta });
      } else if (tipo === 'transferencia') {
        celebrar({ tipo: 'ok', frase: 'Pasaste', monto: datos.monto,
          detalle: `De ${nombreCta} a ${dest?.nombre || 'otra cuenta'}`,
          datos: [
            { etq: `Saldo en ${nombreCta}`, valor: saldoCuenta(cta) },
            { etq: `Saldo en ${dest?.nombre || 'destino'}`, valor: saldoCuenta(dest) },
          ] });
      } else {
        const hoy = hoyISO();
        let quedo = 0;
        for (const x of state.d.movimientos) {
          if (x.espacio !== espacio || x.fecha !== hoy) continue;
          if (x.tipo === 'ingreso') quedo += Number(x.monto);
          else if (x.tipo === 'gasto') quedo -= Number(x.monto);
        }
        celebrar({
          tipo,
          frase: tipo === 'ingreso' ? 'Ingresaste' : 'Registraste un gasto de',
          monto: datos.monto,
          detalle: [tipo === 'ingreso' ? `a ${nombreCta}` : `desde ${nombreCta}`, datos.nota].filter(Boolean).join(' · '),
          datos: [
            { etq: `Saldo en ${nombreCta}`, valor: saldoCuenta(cta) },
            { etq: datos.fecha === hoy ? 'Hoy me quedó' : 'Total en mis cuentas',
              valor: datos.fecha === hoy ? quedo : cuentasDe(espacio).reduce((t, c) => t + saldoCuenta(c), 0) },
          ],
        });
      }
    },
  });
}

// ---------- Actividad (agenda) ----------

function filaAviso(av = { tipo: 'antes', min: 15 }) {
  const mins = [[0, 'A la hora'], [5, '5 min antes'], [10, '10 min antes'], [15, '15 min antes'], [30, '30 min antes'],
    [60, '1 hora antes'], [120, '2 horas antes'], [1440, '1 día antes']];
  return `<div class="aviso-fila">
      <select data-av="tipo" aria-label="Tipo de aviso">
        <option value="antes" ${av.tipo === 'antes' ? 'selected' : ''}>Antes de empezar</option>
        <option value="hora" ${av.tipo === 'hora' ? 'selected' : ''}>A una hora exacta</option>
      </select>
      <select data-av="min" ${av.tipo === 'hora' ? 'hidden' : ''} aria-label="Cuánto antes">
        ${mins.map(([v, t]) => `<option value="${v}" ${Number(av.min) === v ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <input type="time" data-av="hora" value="${av.hora || '07:00'}" ${av.tipo !== 'hora' ? 'hidden' : ''} aria-label="Hora del aviso">
      <button type="button" class="icon-btn" data-accion="quitar-aviso" aria-label="Quitar aviso"><i class="ti ti-x"></i></button>
    </div>`;
}

function leerAvisos(form) {
  return [...form.querySelectorAll('.aviso-fila')].map(f => {
    const tipo = f.querySelector('[data-av=tipo]').value;
    return tipo === 'hora'
      ? { tipo: 'hora', hora: f.querySelector('[data-av=hora]').value || '07:00' }
      : { tipo: 'antes', min: Number(f.querySelector('[data-av=min]').value) };
  });
}

function formActividad(act, fechaOcurrencia) {
  const nueva = !act;
  const fechaBase = fechaOcurrencia || state.agendaFecha;
  const a = act || {
    titulo: '', fecha: fechaBase, hora_inicio: '08:00', hora_fin: '09:00', repetir: 'nunca',
    dias: [deISO(fechaBase).getDay()], avisos: [{ tipo: 'antes', min: 15 }], monto: null, cuenta_id: null,
  };
  const opcCuentas = ['personal', 'empresa'].map(esp => {
    const cs = cuentasDe(esp);
    return cs.length ? `<optgroup label="${esp === 'personal' ? 'Personal' : 'Empresa'}">${cs.map(c => `
        <option value="${c.id}" ${c.id === a.cuenta_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</optgroup>` : '';
  }).join('');

  abrirSheet({
    titulo: nueva ? 'Nueva actividad' : 'Editar actividad',
    cuerpo: `
      <label class="campo"><span>¿Qué vas a hacer?</span>
        <input name="titulo" value="${esc(a.titulo)}" placeholder="Inglés, gimnasio, reunión…" maxlength="80"></label>
      <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${fechaBase}"></label>
      <div class="dos">
        <label class="campo"><span>Desde</span><input type="time" name="hora_inicio" value="${a.hora_inicio}"></label>
        <label class="campo"><span>Hasta</span><input type="time" name="hora_fin" value="${a.hora_fin || ''}"></label>
      </div>
      <div class="campo"><span>Repetir</span>
        <div class="opciones">${[['nunca', 'Solo este día'], ['diario', 'Todos los días'], ['semanal', 'Los días que yo elija'], ['mensual', 'Cada mes']].map(([v, t]) => `
          <label><input type="radio" name="repetir" value="${v}" ${a.repetir === v ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
        <div class="dias-sel">${[1, 2, 3, 4, 5, 6, 0].map(d => `
          <label><input type="checkbox" name="dias" value="${d}" ${(a.dias || []).map(Number).includes(d) ? 'checked' : ''}><span>${DIAS_CORTOS[d]}</span></label>`).join('')}</div>
      </div>
      <div class="campo"><span>Avisos</span>
        <div class="avisos">${(a.avisos || []).map(filaAviso).join('')}</div>
        <button type="button" class="link" data-accion="agregar-aviso">+ Agregar aviso</button>
      </div>
      <details class="campo" ${a.monto ? 'open' : ''}>
        <summary>¿Es un pago? (opcional)</summary>
        <div class="monto-input chico"><span>$</span>
          <input name="monto" data-monto inputmode="numeric" placeholder="0" value="${formatearDigitos(a.monto || 0)}"></div>
        <label class="campo"><span>Se paga desde</span><select name="cuenta_id">${opcCuentas}</select></label>
      </details>`,
    alAbrir: form => {
      form.dataset.repetir = a.repetir;
      if (nueva) form.querySelector('[name=titulo]').focus();
    },
    borrar: nueva ? null : async () => {
      if (act.repetir === 'nunca') {
        await db.borrar('actividades', act.id);
        quitar('actividades', act.id);
        toast('Actividad borrada');
        return;
      }
      preguntarAlcance('¿Borrar cuáles?', alcance => borrarRecurrente(act, fechaBase, alcance));
      return 'abierto';
    },
    guardar: async (form, fd) => {
      const monto = soloDigitos(fd.get('monto'));
      const datos = {
        titulo: (fd.get('titulo') || '').trim(),
        fecha: fd.get('fecha'),
        hora_inicio: fd.get('hora_inicio'),
        hora_fin: fd.get('hora_fin') || null,
        repetir: fd.get('repetir') || 'nunca',
        dias: fd.getAll('dias').map(Number),
        avisos: leerAvisos(form),
        monto: monto || null,
        cuenta_id: monto ? fd.get('cuenta_id') : null,
      };
      if (!datos.titulo) return falla('Escribe qué vas a hacer.');
      if (!datos.fecha) return falla('Elige una fecha.');
      if (!datos.hora_inicio) return falla('Elige la hora de inicio.');
      if (datos.hora_fin && datos.hora_fin <= datos.hora_inicio) return falla('La hora final debe ser después de la inicial.');
      if (datos.repetir === 'semanal' && !datos.dias.length) return falla('Elige al menos un día de la semana.');

      if (nueva) {
        await guardarFila('actividades', null, { ...datos, excepciones: [], pagados: [], hasta: null });
        toast('Actividad creada');
        return;
      }
      if (act.repetir === 'nunca') {
        await guardarFila('actividades', act.id, datos);
        toast('Cambios guardados');
        return;
      }
      preguntarAlcance('¿Cambiar cuáles?', alcance => editarRecurrente(act, fechaBase, datos, alcance));
      return 'abierto';
    },
  });
}

async function editarRecurrente(act, f, datos, alcance) {
  if (alcance === 'todas' || (alcance === 'siguientes' && f <= act.fecha)) {
    // Mantiene la fecha de inicio original para no perder las repeticiones pasadas
    await guardarFila('actividades', act.id, { ...datos, fecha: datos.repetir === 'nunca' ? datos.fecha : act.fecha });
  } else if (alcance === 'solo') {
    await guardarFila('actividades', act.id, { excepciones: [...(act.excepciones || []), f] });
    await guardarFila('actividades', null, { ...datos, repetir: 'nunca', excepciones: [], pagados: [], hasta: null });
  } else {
    await guardarFila('actividades', act.id, { hasta: sumarDias(f, -1) });
    await guardarFila('actividades', null, {
      ...datos,
      hasta: act.hasta || null,
      excepciones: (act.excepciones || []).filter(e => e >= f),
      pagados: (act.pagados || []).filter(e => e >= f),
    });
  }
  toast('Cambios guardados');
}

async function borrarRecurrente(act, f, alcance) {
  if (alcance === 'todas' || (alcance === 'siguientes' && f <= act.fecha)) {
    await db.borrar('actividades', act.id);
    quitar('actividades', act.id);
  } else if (alcance === 'solo') {
    await guardarFila('actividades', act.id, { excepciones: [...(act.excepciones || []), f] });
  } else {
    await guardarFila('actividades', act.id, { hasta: sumarDias(f, -1) });
  }
  toast('Actividad borrada');
}

async function marcarPagado(id, fecha) {
  const a = porId(state.d.actividades, id);
  const cuenta = porId(state.d.cuentas, a.cuenta_id) || cuentasDe('personal')[0];
  if (!cuenta) return toast('Primero crea una cuenta en Ajustes');
  const gastos = state.d.categorias.filter(c => c.espacio === cuenta.espacio && c.tipo === 'gasto');
  const cat = gastos.find(c => c.nombre === 'Servicios') || gastos[0];
  await guardarFila('movimientos', null, {
    espacio: cuenta.espacio, tipo: 'gasto', monto: a.monto, cuenta_id: cuenta.id,
    cuenta_destino_id: null, categoria_id: cat?.id || null, fecha, nota: a.titulo,
  });
  await guardarFila('actividades', id, { pagados: [...(a.pagados || []), fecha] });
  toast(`Pago de ${pesos(a.monto)} registrado en ${cuenta.nombre}`);
}

// ---------- Pendiente ----------

function formTarea(tarea, fecha) {
  const nueva = !tarea;
  const t = tarea || { titulo: '', fecha: fecha || hoyISO(), prioridad: 'media' };
  abrirSheet({
    titulo: nueva ? 'Nuevo pendiente' : 'Editar pendiente',
    cuerpo: `
      <label class="campo"><span>¿Qué tienes pendiente?</span>
        <input name="titulo" value="${esc(t.titulo)}" placeholder="Comprar mercado, llamar a…" maxlength="100"></label>
      <label class="campo"><span>Para el día</span><input type="date" name="fecha" value="${t.fecha}"></label>
      <div class="campo"><span>Prioridad</span>
        <div class="seg">${[['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']].map(([v, n]) => `
          <label><input type="radio" name="prioridad" value="${v}" ${t.prioridad === v ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
      </div>`,
    alAbrir: form => { if (nueva) form.querySelector('[name=titulo]').focus(); },
    borrar: nueva ? null : async () => {
      await db.borrar('tareas', tarea.id);
      quitar('tareas', tarea.id);
    },
    guardar: async (form, fd) => {
      const titulo = (fd.get('titulo') || '').trim();
      if (!titulo) return falla('Escribe el pendiente.');
      await guardarFila('tareas', tarea?.id, {
        titulo, fecha: fd.get('fecha') || hoyISO(), prioridad: fd.get('prioridad') || 'media',
        ...(nueva ? { hecha: false } : {}),
      });
      toast(nueva ? 'Pendiente agregado' : 'Cambios guardados');
    },
  });
}

// ---------- Diario ----------

async function guardarDiario(fecha, texto) {
  const existe = state.d.diario.find(x => x.fecha === fecha);
  const limpio = texto.trim();
  if (existe && !limpio) {
    await db.borrar('diario', existe.id);
    quitar('diario', existe.id);
  } else if (existe) {
    await guardarFila('diario', existe.id, { texto });
  } else if (limpio) {
    await guardarFila('diario', null, { fecha, texto });
  } else {
    return;
  }
  toast('Diario guardado');
}

// ---------- Cuenta ----------

// Detalle de una cuenta: cuánto tiene, qué entró y salió, y sus movimientos
function verCuenta(c) {
  if (!c) return;
  const s = saldoCuenta(c);
  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);
  const dia = entradasSalidas(c, f => f === hoy);
  const delMes = entradasSalidas(c, f => f.startsWith(mes));
  const movs = movsDeCuenta(c);
  const color = bancoDeCuenta(c).color;

  abrirSheet({
    titulo: esc(c.nombre),
    cuerpo: `
      <div class="cuenta-detalle" style="--c:${color}">
        ${logoCuenta(c, 56)}
        <div><span class="etq">Tengo ahora</span><b class="${s < 0 ? 'rojo' : 'oro'}">${num('cta-' + c.id, s)}</b></div>
      </div>
      <div class="acciones-cuenta">
        <button type="button" data-accion="cuenta-mov" data-valor="ingreso" data-id="${c.id}">
          <i class="ti ti-arrow-up-right verde"></i><span>Entró plata</span></button>
        <button type="button" data-accion="cuenta-mov" data-valor="gasto" data-id="${c.id}">
          <i class="ti ti-arrow-down-right rojo"></i><span>Salió plata</span></button>
        <button type="button" data-accion="ajustar-saldo" data-id="${c.id}">
          <i class="ti ti-adjustments-dollar oro"></i><span>Actualizar saldo</span></button>
      </div>
      <div class="metricas">
        <div class="card metrica"><span class="etq">Hoy entró</span><b class="verde">${num('cta-hoy-in-' + c.id, dia.entro)}</b></div>
        <div class="card metrica"><span class="etq">Hoy salió</span><b class="rojo">${num('cta-hoy-out-' + c.id, dia.salio)}</b></div>
        <div class="card metrica"><span class="etq">Este mes entró</span><b class="verde">${num('cta-mes-in-' + c.id, delMes.entro)}</b></div>
        <div class="card metrica"><span class="etq">Este mes salió</span><b class="rojo">${num('cta-mes-out-' + c.id, delMes.salio)}</b></div>
      </div>
      <h2 class="titulo-sec">Movimientos de esta cuenta</h2>
      ${movs.length
        ? `<div class="card lista">${movs.slice(0, 50).map(filaMov).join('')}</div>`
        : '<div class="vacio">Esta cuenta aún no tiene movimientos.</div>'}
      <button type="button" class="btn btn-sec ancho" data-accion="editar-cuenta" data-id="${c.id}">
        <i class="ti ti-pencil"></i> Editar cuenta</button>`,
    alAbrir: () => animarNumeros($sheet),
  });
}

// "¿Cuánto tienes ahora en Nequi?" → deja la cuenta con ese saldo exacto
function formSaldo(c) {
  if (!c) return;
  const s = saldoCuenta(c);
  abrirSheet({
    titulo: 'Actualizar saldo',
    cuerpo: `
      <div class="cuenta-detalle" style="--c:${bancoDeCuenta(c).color}">
        ${logoCuenta(c, 48)}
        <div><span class="etq">LUPP dice que tienes</span><b class="${s < 0 ? 'rojo' : ''}">${pesos(s)}</b></div>
      </div>
      <div class="campo"><span>¿Cuánto tienes ahora en ${esc(c.nombre)}?</span>
        <div class="monto-input"><span>$</span>
          <input name="saldo" data-monto inputmode="numeric" autocomplete="off" placeholder="0" value="${formatearDigitos(Math.abs(s))}"></div></div>
      <label class="check-linea"><input type="checkbox" name="deuda"> Es una deuda (saldo negativo, por ejemplo tarjeta de crédito)</label>
      <p class="ayuda">Mira el saldo en la app de tu banco y escríbelo aquí. La diferencia no cuenta como ganancia ni como gasto.</p>`,
    alAbrir: form => {
      const input = form.querySelector('[name=saldo]');
      input.focus();
      input.select();
    },
    guardar: async (form, fd) => {
      let nuevo = soloDigitos(fd.get('saldo'));
      if (fd.get('deuda')) nuevo = -nuevo;
      await guardarFila('cuentas', c.id, { saldo_inicial: saldoInicialPara(c, nuevo) });
      celebrar({ tipo: 'ajuste', frase: `Ahora en ${c.nombre} tienes`, monto: nuevo,
        datos: [{ etq: `Total en mis cuentas · ${c.espacio === 'empresa' ? 'Empresa' : 'Personal'}`,
          valor: cuentasDe(c.espacio).reduce((t, x) => t + saldoCuenta(x), 0) }] });
    },
  });
}

function formCuenta(c) {
  const nueva = !c;
  const v = c || { nombre: '', icono: 'banco:otra', saldo_inicial: 0 };
  const elegido = nueva ? null : bancoDeCuenta(c);
  const actual = nueva ? 0 : saldoCuenta(c);
  abrirSheet({
    titulo: nueva ? 'Nueva cuenta' : 'Editar cuenta',
    cuerpo: `
      <div class="campo"><span>Banco o billetera</span>
        <div class="bancos-sel">${BANCOS.map(b => `
          <label><input type="radio" name="banco" value="${b.id}" ${elegido?.id === b.id ? 'checked' : ''}>
            <span>${logoCuenta({ icono: 'banco:' + b.id }, 36)}<small>${esc(b.nombre)}</small></span></label>`).join('')}</div></div>
      <div class="campo"><span>Logo propio (opcional)</span>
        ${selectorFoto(v.logo, 'Pon el logo original')}</div>
      <label class="campo"><span>Nombre</span>
        <input name="nombre" value="${esc(v.nombre)}" placeholder="Nequi, Bancolombia, alcancía…" maxlength="40" data-auto="${nueva ? '1' : '0'}"></label>
      <div class="campo"><span>¿Cuánto tienes ahora en esta cuenta?</span>
        <div class="monto-input chico"><span>$</span>
          <input name="saldo" data-monto inputmode="numeric" placeholder="0" value="${formatearDigitos(Math.abs(actual))}"></div></div>
      <label class="check-linea"><input type="checkbox" name="deuda" ${actual < 0 && elegido?.id === 'tarjeta' ? 'checked' : ''}> Es una deuda (saldo negativo, por ejemplo tarjeta de crédito)</label>`,
    confirmarBorrar: '¿Borrar esta cuenta? También se borran todos sus movimientos.',
    borrar: nueva ? null : async () => {
      const ids = state.d.movimientos.filter(m => m.cuenta_id === c.id || m.cuenta_destino_id === c.id).map(m => m.id);
      if (!db.modoNube) for (const id of ids) await db.borrar('movimientos', id);
      await db.borrar('cuentas', c.id);
      state.d.movimientos = state.d.movimientos.filter(m => !ids.includes(m.id));
      quitar('cuentas', c.id);
      toast('Cuenta borrada');
    },
    guardar: async (form, fd) => {
      const nombre = (fd.get('nombre') || '').trim();
      if (!nombre) return falla('Elige un banco o escribe el nombre de la cuenta.');
      let saldo = soloDigitos(fd.get('saldo'));
      if (fd.get('deuda')) saldo = -saldo;
      await guardarFila('cuentas', c?.id, {
        nombre, icono: 'banco:' + (fd.get('banco') || 'otra'),
        logo: esImagen(fd.get('foto')) ? fd.get('foto') : null,
        saldo_inicial: nueva ? saldo : saldoInicialPara(c, saldo),
        ...(nueva ? { espacio: state.espacio, orden: cuentasEsp().length } : {}),
      });
      celebrar({ tipo: 'ajuste', titulo: nueva ? '¡Cuenta lista!' : '¡Listo!',
        frase: nueva ? `${nombre} empieza con` : `Ahora en ${nombre} tienes`, monto: saldo,
        datos: [{ etq: `Total en mis cuentas · ${nombreEspacio()}`, valor: cuentasEsp().reduce((t, x) => t + saldoCuenta(x), 0) }] });
    },
  });
}

// ---------- Deudas: detalle y formularios ----------

function verDeuda(d) {
  if (!d) return;
  const meDebe = d.tipo !== 'debo';
  const p = pctDe(d);
  const lista = saldada(d);
  const abonos = [...(d.abonos || [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ahorrado = Number(d.ahorrado) || 0;
  abrirSheet({
    titulo: esc(d.nombre),
    cuerpo: `
      <div class="deuda-detalle ${lista ? 'saldada' : 'pendiente'}">
        ${avatar(d, 76)}
        <span class="etq">${meDebe ? `Le prestaste a ${esc(d.nombre)}` : `Le debes a ${esc(d.nombre)}`}</span>
        <b class="deuda-total">${pesos(d.monto)}</b>
        ${lista ? `<span class="sello-saldada"><i class="ti ti-circle-check-filled"></i> ¡Saldada!</span>` : ''}
        <div class="deuda-barra-grande">
          ${barra('deuda-' + d.id, p)}
          <div class="fila-sb"><small>${meDebe ? 'Me ha pagado' : 'He pagado'} <b>${pesos(pagadoDe(d))}</b></small>
            <small><b>${numPct('deuda-pct-' + d.id, p)}</b></small></div>
        </div>
      </div>
      <div class="metricas">
        <div class="card metrica"><span class="etq">Falta</span><b class="${lista ? 'verde' : 'rojo'}">${pesos(faltaDe(d))}</b></div>
        ${meDebe
          ? `<div class="card metrica"><span class="etq">Desde</span><b>${d.fecha ? capital(fechaLarga(d.fecha)) : '—'}</b></div>`
          : `<div class="card metrica"><span class="etq">Llevo ahorrado</span><b class="oro">${pesos(ahorrado)}</b></div>`}
      </div>
      ${d.nota ? `<p class="ayuda">${esc(d.nota)}</p>` : ''}
      ${lista ? '' : `<div class="acciones-cuenta dos">
        <button type="button" data-accion="nuevo-abono" data-id="${d.id}">
          <i class="ti ti-${meDebe ? 'cash' : 'credit-card-pay'} verde"></i><span>${meDebe ? 'Me pagó' : 'Pagué'}</span></button>
        <button type="button" data-accion="editar-deuda" data-id="${d.id}">
          <i class="ti ti-pencil oro"></i><span>Editar</span></button>
      </div>`}
      <h2 class="titulo-sec">${meDebe ? 'Pagos que me ha hecho' : 'Pagos que he hecho'}</h2>
      ${abonos.length ? `<div class="card lista">${abonos.map(a => `
        <div class="fila abono">
          <span class="ico" style="--c:#22C55E"><i class="ti ti-${meDebe ? 'arrow-down-left' : 'arrow-up-right'}"></i></span>
          <span class="txt"><b>${pesos(a.monto)}</b><small>${esc([capital(fechaLarga(a.fecha)), porId(state.d.cuentas, a.cuenta_id)?.nombre, a.nota].filter(Boolean).join(' · '))}</small></span>
          <button type="button" class="icon-btn" data-accion="borrar-abono" data-id="${d.id}" data-abono="${a.id}" aria-label="Borrar pago"><i class="ti ti-x"></i></button>
        </div>`).join('')}</div>` : '<div class="vacio">Todavía no hay pagos.</div>'}
      ${lista ? `<button type="button" class="btn btn-sec ancho" data-accion="editar-deuda" data-id="${d.id}"><i class="ti ti-pencil"></i> Editar</button>` : ''}`,
    alAbrir: () => animarNumeros($sheet),
  });
}

function formDeuda(d) {
  const nueva = !d;
  const v = d || { tipo: 'me_deben', nombre: '', monto: 0, fecha: hoyISO(), nota: '', foto: null, ahorrado: 0 };
  abrirSheet({
    titulo: nueva ? 'Nueva deuda' : 'Editar deuda',
    cuerpo: `
      <div class="seg">${[['me_deben', 'Me deben'], ['debo', 'Yo debo']].map(([val, t]) => `
        <label><input type="radio" name="clase" value="${val}" ${v.tipo === val ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
      ${selectorFoto(v.foto, 'Foto (opcional)')}
      <label class="campo"><span class="si-me-deben">¿Quién te debe?</span><span class="si-debo">¿A quién le debes?</span>
        <input name="nombre" value="${esc(v.nombre)}" placeholder="Primo, Carlos, el banco…" maxlength="40"></label>
      <div class="campo"><span class="si-me-deben">¿Cuánto le prestaste?</span><span class="si-debo">¿Cuánto debes?</span>
        <div class="monto-input"><span>$</span>
          <input name="monto" data-monto inputmode="numeric" autocomplete="off" placeholder="0" value="${formatearDigitos(Number(v.monto))}"></div></div>
      <div class="campo si-debo"><span>¿Cuánto llevas ahorrado para pagarla?</span>
        <div class="monto-input chico"><span>$</span>
          <input name="ahorrado" data-monto inputmode="numeric" placeholder="0" value="${formatearDigitos(Number(v.ahorrado) || 0)}"></div></div>
      <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${v.fecha || hoyISO()}"></label>
      <label class="campo"><span>Nota (opcional)</span>
        <input name="nota" value="${esc(v.nota)}" placeholder="Me paga los viernes, para la moto…" maxlength="120"></label>`,
    alAbrir: form => {
      form.dataset.clase = v.tipo;
      if (nueva) form.querySelector('[name=nombre]').focus();
    },
    confirmarBorrar: '¿Borrar esta deuda y todos sus pagos?',
    borrar: nueva ? null : async () => {
      await db.borrar('deudas', d.id);
      quitar('deudas', d.id);
      toast('Deuda borrada');
    },
    guardar: async (form, fd) => {
      const tipo = fd.get('clase') === 'debo' ? 'debo' : 'me_deben';
      const nombre = (fd.get('nombre') || '').trim();
      const monto = soloDigitos(fd.get('monto'));
      if (!nombre) return falla(tipo === 'debo' ? 'Escribe a quién le debes.' : 'Escribe quién te debe.');
      if (!monto) return falla('Escribe el valor de la deuda.');
      if (!nueva && monto < pagadoDe(d)) return falla(`Ya se han pagado ${pesos(pagadoDe(d))}; el valor no puede ser menor.`);
      const datos = {
        tipo, nombre, monto,
        fecha: fd.get('fecha') || hoyISO(),
        nota: (fd.get('nota') || '').trim(),
        foto: esImagen(fd.get('foto')) ? fd.get('foto') : null,
        ahorrado: tipo === 'debo' ? soloDigitos(fd.get('ahorrado')) : 0,
      };
      if (nueva) {
        // Anotar una deuda NO toca tus cuentas: solo lleva la cuenta de quién debe qué
        await guardarFila('deudas', null, { ...datos, espacio: state.espacio, abonos: [] });
        celebrar({ tipo: 'ajuste', titulo: '¡Anotado!',
          frase: tipo === 'debo' ? `Le debes a ${nombre}` : `${nombre} te debe`, monto,
          detalle: 'Ve registrando los pagos y mira cómo se llena la barra' });
      } else {
        await guardarFila('deudas', d.id, datos);
        sonar('ajuste');
        toast('Deuda actualizada');
      }
    },
  });
}

function formAbono(d) {
  if (!d) return;
  const meDebe = d.tipo !== 'debo';
  const falta = faltaDe(d);
  const opcCuentas = `<option value="">No mover ninguna cuenta</option>${cuentasDe(d.espacio || 'personal').map(c =>
    `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}`;
  abrirSheet({
    titulo: meDebe ? `${esc(d.nombre)} me pagó` : `Le pagué a ${esc(d.nombre)}`,
    cuerpo: `
      <p class="ayuda">Falta ${pesos(falta)} de ${pesos(d.monto)}.</p>
      <div class="monto-input"><span>$</span>
        <input name="monto" data-monto inputmode="numeric" autocomplete="off" placeholder="0"></div>
      <div class="rapidos">${[10000, 20000, 30000, 50000].filter(x => x < falta).map(x => `
        <button type="button" class="chip" data-accion="poner-monto" data-valor="${x}">${formatearDigitos(x)}</button>`).join('')}
        <button type="button" class="chip chip-oro" data-accion="poner-monto" data-valor="${falta}">Todo (${formatearDigitos(falta)})</button></div>
      <label class="campo"><span>${meDebe ? '¿Quieres sumar este pago a una cuenta?' : '¿Quieres restar este pago de una cuenta?'}</span>
        <select name="cuenta_id">${opcCuentas}</select>
        <small class="ayuda">Si eliges "No mover ninguna cuenta", solo se anota en la deuda.</small></label>
      <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${hoyISO()}"></label>
      <label class="campo"><span>Nota (opcional)</span>
        <input name="nota" placeholder="Cuota del viernes…" maxlength="80"></label>`,
    alAbrir: form => form.querySelector('[name=monto]').focus(),
    guardar: async (form, fd) => {
      const monto = soloDigitos(fd.get('monto'));
      if (!monto) return falla('Escribe cuánto fue el pago.');
      if (monto > falta) return falla(`Eso es más de lo que falta (${pesos(falta)}).`);
      const cuentaId = fd.get('cuenta_id') || null;
      const abono = {
        id: 'ab-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        monto, fecha: fd.get('fecha') || hoyISO(), nota: (fd.get('nota') || '').trim(), cuenta_id: cuentaId,
      };
      const actualizada = await guardarFila('deudas', d.id, { abonos: [...(d.abonos || []), abono] });
      await moverSaldo(cuentaId, meDebe ? monto : -monto);
      if (saldada(actualizada)) {
        celebrar({ tipo: 'saldada', frase: meDebe ? `${d.nombre} te pagó todo:` : `Le pagaste todo a ${d.nombre}:`,
          monto: Number(d.monto), detalle: meDebe ? 'Plata de vuelta en casa' : 'Una deuda menos, ¡libre!' });
      } else {
        celebrar({
          tipo: meDebe ? 'abono_recibido' : 'abono_pagado',
          frase: meDebe ? `${d.nombre} te abonó` : `Le abonaste a ${d.nombre}`,
          monto,
          datos: [
            { etq: 'Va pagado', valor: pagadoDe(actualizada) },
            { etq: 'Falta', valor: faltaDe(actualizada) },
          ],
        });
      }
    },
  });
}

async function borrarAbono(deudaId, abonoId) {
  const d = porId(state.d.deudas, deudaId);
  const a = d?.abonos?.find(x => x.id === abonoId);
  if (!a || !confirm(`¿Borrar el pago de ${pesos(a.monto)}?`)) return;
  await guardarFila('deudas', d.id, { abonos: d.abonos.filter(x => x.id !== abonoId) });
  // Devuelve la plata a como estaba en la cuenta
  await moverSaldo(a.cuenta_id, d.tipo === 'debo' ? Number(a.monto) : -Number(a.monto));
  sonar('borrar');
  verDeuda(porId(state.d.deudas, deudaId));
  render();
}

// ---------- Categoría ----------

function formCategoria(c) {
  const nueva = !c;
  const v = c || { nombre: '', tipo: 'gasto', icono: 'dots', color: COLORES[0] };
  abrirSheet({
    titulo: nueva ? 'Nueva categoría' : 'Editar categoría',
    cuerpo: `
      <label class="campo"><span>Nombre</span>
        <input name="nombre" value="${esc(v.nombre)}" placeholder="Mascotas, gimnasio…" maxlength="40"></label>
      ${nueva ? `<div class="campo"><span>Tipo</span><div class="seg">
        <label><input type="radio" name="tipo" value="gasto" checked><span>Gasto</span></label>
        <label><input type="radio" name="tipo" value="ingreso"><span>Ingreso</span></label></div></div>` : ''}
      <div class="campo"><span>Ícono</span><div class="iconos">${ICONOS_CATEGORIA.map(i => `
        <label><input type="radio" name="icono" value="${i}" ${v.icono === i ? 'checked' : ''}><span><i class="ti ti-${i}"></i></span></label>`).join('')}</div></div>
      <div class="campo"><span>Color</span><div class="colores">${COLORES.map(col => `
        <label><input type="radio" name="color" value="${col}" ${v.color === col ? 'checked' : ''}><span style="background:${col}"></span></label>`).join('')}</div></div>`,
    confirmarBorrar: '¿Borrar esta categoría? Sus movimientos quedarán "Sin categoría".',
    borrar: nueva ? null : async () => {
      await db.borrar('categorias', c.id);
      quitar('categorias', c.id);
      for (const m of state.d.movimientos.filter(x => x.categoria_id === c.id)) {
        if (!db.modoNube) await db.actualizar('movimientos', m.id, { categoria_id: null });
        m.categoria_id = null;
      }
      toast('Categoría borrada');
    },
    guardar: async (form, fd) => {
      const nombre = (fd.get('nombre') || '').trim();
      if (!nombre) return falla('Ponle un nombre a la categoría.');
      await guardarFila('categorias', c?.id, {
        nombre, icono: fd.get('icono') || 'dots', color: fd.get('color') || COLORES[0],
        ...(nueva ? { espacio: state.espacio, tipo: fd.get('tipo') || 'gasto' } : {}),
      });
      toast('Categoría guardada');
    },
  });
}

// ============================================================
//  Inicio de sesión (solo modo nube)
// ============================================================

const ERRORES_LOGIN = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu correo primero (revisa tu bandeja de entrada).',
  'User already registered': 'Ese correo ya tiene cuenta. Toca "Ya tengo cuenta".',
  'Password should be at least 6 characters.': 'La contraseña debe tener al menos 6 caracteres.',
  'Unable to validate email address: invalid format': 'Ese correo no es válido.',
  'Failed to fetch': 'No hay conexión a internet. Revisa tu red e intenta de nuevo.',
};

function pantallaLogin(modo) {
  const entrar = modo === 'entrar';
  $app.innerHTML = `<main class="login">
      <div class="login-marca">
        <span class="login-anillo"></span>
        <h1 class="logo grande">LUPP</h1>
        <p class="sub">Tu plata y tu tiempo, en un solo lugar.</p>
      </div>
      <form class="card login-caja" novalidate>
        <h2>${entrar ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h2>
        <label class="campo"><span>Correo</span>
          <input type="email" name="email" autocomplete="email" inputmode="email" placeholder="tucorreo@gmail.com"></label>
        <label class="campo"><span>Contraseña</span>
          <span class="clave-caja">
            <input type="password" name="clave" autocomplete="${entrar ? 'current-password' : 'new-password'}" placeholder="Mínimo 6 caracteres">
            <button type="button" class="ver-clave" data-accion="ver-clave" aria-label="Mostrar contraseña"><i class="ti ti-eye"></i></button>
          </span></label>
        <p class="error" hidden></p>
        <button class="btn btn-prim ancho" type="submit">${entrar ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      <button class="link" data-accion="login-modo" data-valor="${entrar ? 'registro' : 'entrar'}">
        ${entrar ? '¿No tienes cuenta? <b>Créala aquí</b>' : '¿Ya tienes cuenta? <b>Entra</b>'}</button>
    </main>`;
  const form = $app.querySelector('form');
  const error = form.querySelector('.error');
  const mostrar = msg => { error.textContent = msg; error.hidden = false; };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.email.value.trim();
    const clave = form.clave.value;
    if (!email || !clave) return mostrar('Escribe tu correo y contraseña.');
    if (clave.length < 6) return mostrar('La contraseña debe tener al menos 6 caracteres.');
    const boton = form.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      const r = entrar ? await db.entrar(email, clave) : await db.registrar(email, clave);
      if (!r.session) {
        pantallaLogin('entrar');
        return toast('Te enviamos un correo. Confírmalo y luego entra.');
      }
      state.usuario = r.user;
      await despuesDeEntrar();
    } catch (err) {
      mostrar(ERRORES_LOGIN[err.message] || err.message);
    } finally {
      boton.disabled = false;
    }
  });
}

// ============================================================
//  Avisos (notificaciones)
// ============================================================

let avisosIniciados = false;

function iniciarAvisos() {
  if (avisosIniciados) return;
  avisosIniciados = true;
  revisarAvisos();
  setInterval(revisarAvisos, 30_000);
  // Refresca "Ahora toca" cada minuto si no hay un formulario abierto
  setInterval(() => {
    if (state.tab === 'hoy' && !sheetActual && document.visibilityState === 'visible') render();
  }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    revisarAvisos();
    if (!sheetActual && document.activeElement?.tagName !== 'TEXTAREA') render();
  });
}

function revisarAvisos() {
  const ahora = Date.now();
  const hoy = hoyISO();
  let hechos;
  try { hechos = JSON.parse(localStorage.getItem('lupp:avisados') || '{}'); } catch { hechos = {}; }

  for (const f of [hoy, sumarDias(hoy, 1)]) {
    const base = deISO(f);
    const momento = hhmm => {
      const [h, m] = hhmm.split(':').map(Number);
      return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m).getTime();
    };
    for (const a of ocurrenciasDe(f)) {
      (a.avisos || []).forEach((av, i) => {
        const t = av.tipo === 'hora' ? momento(av.hora) : momento(a.hora_inicio) - av.min * 60_000;
        const clave = `${a.id}|${f}|${i}`;
        // Suena si ya llegó la hora (con 15 minutos de margen) y no había sonado
        if (ahora >= t && ahora - t < 15 * 60_000 && !hechos[clave]) {
          hechos[clave] = f;
          avisar(a, f, av);
        }
      });
    }
  }
  const limite = sumarDias(hoy, -2);
  for (const k in hechos) if (hechos[k] < limite) delete hechos[k];
  try { localStorage.setItem('lupp:avisados', JSON.stringify(hechos)); } catch { /* sin almacenamiento */ }
}

async function avisar(a, f, av) {
  const cuando = av.tipo === 'antes' && av.min
    ? `Empieza ${f === hoyISO() ? 'hoy' : 'mañana'} a las ${horaAmPm(a.hora_inicio)}`
    : `${horaAmPm(a.hora_inicio)}${a.hora_fin ? ' – ' + horaAmPm(a.hora_fin) : ''}`;
  const cuerpo = a.monto ? `${cuando} · Pago de ${pesos(a.monto)}` : cuando;
  toast(`${a.titulo} · ${cuerpo}`);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opciones = {
    body: cuerpo, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    tag: `${a.id}|${f}`, vibrate: [200, 100, 200],
  };
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) reg.showNotification(a.titulo, opciones);
  else new Notification(a.titulo, opciones);
}

// ============================================================
//  Exportar
// ============================================================

function exportarCSV() {
  const nombre = id => porId(state.d.cuentas, id)?.nombre || '';
  const filas = [['Fecha', 'Espacio', 'Tipo', 'Monto', 'Cuenta', 'Cuenta destino', 'Categoría', 'Nota']];
  for (const m of [...state.d.movimientos].sort(ordenMov)) {
    filas.push([m.fecha, m.espacio, m.tipo, m.monto, nombre(m.cuenta_id), nombre(m.cuenta_destino_id),
      porId(state.d.categorias, m.categoria_id)?.nombre || '', m.nota || '']);
  }
  // Punto y coma + BOM para que Excel en español lo abra bien
  const csv = '\uFEFF' + filas.map(f => f.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `lupp-movimientos-${hoyISO()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ============================================================
//  Mensajito flotante
// ============================================================

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('ver');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('ver'), 2800);
}

// ============================================================
//  Acciones (todos los botones con data-accion)
// ============================================================

const acciones = {
  tab: ({ valor }) => { state.tab = valor; cerrarSheet(); render(); window.scrollTo(0, 0); },
  espacio: async ({ valor }) => {
    state.espacio = valor;
    pref.guardar('espacio', valor);
    if (valor === 'empresa') await sembrar('empresa');
    render();
  },
  tema: ({ valor }) => { state.tema = valor; pref.guardar('tema', valor); render(); },
  sonido: ({ valor }) => { cambiarSonido(valor === 'si'); render(); },

  nuevo: menuNuevo,
  'nuevo-mov': ({ valor }) => formMovimiento(null, valor),
  'editar-mov': ({ id }) => formMovimiento(porId(state.d.movimientos, id)),
  'sumar-monto': ({ valor }, el) => {
    const input = el.closest('form').querySelector('[name=monto]');
    input.value = formatearDigitos(soloDigitos(input.value) + Number(valor));
  },
  mes: ({ valor }) => { state.finMes = sumarMeses(state.finMes, Number(valor)); render(); },

  semana: ({ valor }) => { state.agendaFecha = sumarDias(state.agendaFecha, Number(valor)); render(); },
  dia: ({ valor }) => { state.agendaFecha = valor; render(); },
  'nueva-act': ({ fecha }) => formActividad(null, fecha || (state.tab === 'agenda' ? state.agendaFecha : hoyISO())),
  'editar-act': ({ id, fecha }) => formActividad(porId(state.d.actividades, id), fecha),
  'agregar-aviso': (_, el) => el.previousElementSibling.insertAdjacentHTML('beforeend', filaAviso()),
  'quitar-aviso': (_, el) => el.closest('.aviso-fila').remove(),
  pagar: async ({ id, fecha }) => { await marcarPagado(id, fecha); render(); },

  'nueva-tarea': ({ fecha }) => formTarea(null, fecha || (state.tab === 'agenda' ? state.agendaFecha : hoyISO())),
  'editar-tarea': ({ id }) => formTarea(porId(state.d.tareas, id)),
  'tarea-toggle': async ({ id }) => {
    const t = porId(state.d.tareas, id);
    await guardarFila('tareas', id, { hecha: !t.hecha });
    render();
  },
  'tarea-borrar': async ({ id }) => {
    await db.borrar('tareas', id);
    quitar('tareas', id);
    render();
  },
  diario: () => {
    state.tab = 'agenda';
    state.agendaFecha = hoyISO();
    cerrarSheet();
    render();
    document.querySelector('[data-diario]')?.focus();
  },

  'nueva-cuenta': () => formCuenta(null),
  'nueva-deuda': () => formDeuda(null),
  'subir-si': () => { const ok = respuestaSubir; respuestaSubir = null; cerrarSheet(); ok?.(true); },
  'subir-no': () => { const ok = respuestaSubir; respuestaSubir = null; cerrarSheet(); ok?.(false); },
  'subir-ahora': async () => {
    if (!confirm('¿Subir a tu cuenta lo que hay guardado en este dispositivo? Si ya lo subiste antes, no se duplica.')) return;
    await subirDatos();
    await cargarTodo();
    render();
  },
  'ver-deuda': ({ id }) => verDeuda(porId(state.d.deudas, id)),
  'editar-deuda': ({ id }) => formDeuda(porId(state.d.deudas, id)),
  'nuevo-abono': ({ id }) => formAbono(porId(state.d.deudas, id)),
  'borrar-abono': ({ id, abono }) => borrarAbono(id, abono),
  'poner-monto': ({ valor }, el) => {
    const input = el.closest('form').querySelector('[name=monto]');
    input.value = formatearDigitos(Number(valor));
    sonar('toque');
  },
  'otra-frase': () => { otraFrase++; sonar('toque'); render(); },
  'quitar-foto': (_, el) => {
    const caja = el.closest('.foto-picker');
    caja.querySelector('[name=foto]').value = '';
    caja.querySelector('.foto-vista').innerHTML = '<i class="ti ti-camera-plus"></i>';
    el.hidden = true;
  },
  'ver-cuenta': ({ id }) => verCuenta(porId(state.d.cuentas, id)),
  'cuenta-mov': ({ id, valor }) => formMovimiento(null, valor, id),
  'ajustar-saldo': ({ id }) => formSaldo(porId(state.d.cuentas, id)),
  'editar-cuenta': ({ id }) => formCuenta(porId(state.d.cuentas, id)),
  'nueva-categoria': () => formCategoria(null),
  'editar-categoria': ({ id }) => formCategoria(porId(state.d.categorias, id)),

  permiso: async () => { await Notification.requestPermission(); render(); },
  'probar-aviso': () => avisar({ id: 'prueba', titulo: 'Así se ven tus avisos', hora_inicio: horaActual() }, hoyISO(), { tipo: 'hora' }),
  exportar: exportarCSV,
  salir: async () => { await db.salir(); location.reload(); },
  'login-modo': ({ valor }) => pantallaLogin(valor),
  'ver-clave': (_, el) => {
    const input = el.parentElement.querySelector('input');
    const ver = input.type === 'password';
    input.type = ver ? 'text' : 'password';
    el.innerHTML = `<i class="ti ti-eye${ver ? '-off' : ''}"></i>`;
  },

  guia: iniciarRecorrido,
  'cerrar-sheet': cerrarSheet,
  'borrar-sheet': async () => {
    if (!confirm(sheetActual.confirmarBorrar || '¿Seguro que quieres borrar esto?')) return;
    const r = await sheetActual.borrar();
    if (r !== 'abierto') cerrarSheet();
    sonar('borrar');
    render();
  },
  alcance: async ({ valor }) => {
    const fn = sheetActual.alcance;
    cerrarSheet();
    await fn(valor);
    render();
  },
};

// ============================================================
//  Eventos globales
// ============================================================

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-accion]');
  if (!el) return;
  const fn = acciones[el.dataset.accion];
  if (!fn) return;
  e.preventDefault();
  try {
    await fn(el.dataset, el);
  } catch (err) {
    console.error(err);
    toast('Algo salió mal: ' + (err.message || err));
  }
});

document.addEventListener('submit', async e => {
  const form = e.target;
  if (!$sheet.contains(form)) return;
  e.preventDefault();
  if (!sheetActual?.guardar) return;
  const boton = form.querySelector('[type=submit]');
  boton.disabled = true;
  try {
    const r = await sheetActual.guardar(form, new FormData(form));
    if (r === false) return;
    if (r !== 'abierto') cerrarSheet();
    render();
  } catch (err) {
    console.error(err);
    falla('No se pudo guardar: ' + (err.message || err));
  } finally {
    boton.disabled = false;
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-monto]')) t.value = formatearDigitos(soloDigitos(t.value));
  // Si escribes el nombre a mano, elegir otro banco ya no lo cambia
  if (t.name === 'nombre' && t.dataset.auto) t.dataset.auto = '0';
  if (t.form && $sheet.contains(t.form)) {
    const p = $sheet.querySelector('.error');
    if (p) p.hidden = true;
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'tipo' && t.form && $sheet.contains(t.form)) {
    t.form.dataset.tipo = t.value;
    t.form.querySelectorAll('[name=categoria_id]').forEach(r => { r.checked = false; });
  }
  if (t.name === 'repetir' && t.form) t.form.dataset.repetir = t.value;
  if (t.name === 'clase' && t.form) t.form.dataset.clase = t.value;
  // Elegiste una imagen: se recorta, se muestra y queda lista para guardar
  if (t.matches('[data-foto-input]') && t.files?.[0]) {
    const caja = t.closest('.foto-picker');
    leerFoto(t.files[0]).then(url => {
      caja.querySelector('[name=foto]').value = url;
      const vista = caja.querySelector('.foto-vista');
      vista.innerHTML = `<img src="${url}" alt="">`;
      vista.classList.remove('nueva');
      void vista.offsetWidth;
      vista.classList.add('nueva');
      caja.querySelector('[data-accion=quitar-foto]').hidden = false;
      sonar('toque');
    }).catch(err => toast(err.message));
    t.value = '';
  }
  // Al elegir un banco, pone su nombre en la cuenta (si no lo has escrito tú)
  if (t.name === 'banco' && t.form) {
    const b = BANCOS.find(x => x.id === t.value);
    const nombre = t.form.querySelector('[name=nombre]');
    if (b && nombre && (nombre.dataset.auto === '1' || !nombre.value.trim())) {
      nombre.value = b.id === 'otra' ? '' : b.nombre;
      nombre.dataset.auto = '1';
      if (b.id === 'otra') nombre.focus();
    }
  }
  if (t.matches('[data-av=tipo]')) {
    const fila = t.closest('.aviso-fila');
    fila.querySelector('[data-av=min]').hidden = t.value === 'hora';
    fila.querySelector('[data-av=hora]').hidden = t.value !== 'hora';
  }
  if (t.matches('[data-diario]')) {
    guardarDiario(t.dataset.diario, t.value).catch(err => toast('No se pudo guardar el diario: ' + err.message));
  }
});

matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (state.tema === 'sistema') aplicarTema();
});

arrancar();