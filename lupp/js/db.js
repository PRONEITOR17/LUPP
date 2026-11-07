// Capa de datos de LUPP.
// - Con Supabase configurado en config.js → guarda en la nube.
// - Sin configurar → "modo local": guarda en el navegador (localStorage).
// El resto de la app usa siempre las mismas funciones: listar, crear, actualizar, borrar.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { nuevoId } from './utils.js';

export const TABLAS = ['cuentas', 'categorias', 'movimientos', 'actividades', 'tareas', 'diario', 'deudas'];
export const modoNube = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let supabase = null;

export async function iniciar() {
  if (!modoNube) return;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm');
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ---------- Sesión (solo modo nube) ----------

export async function sesion() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function entrar(email, clave) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: clave });
  if (error) throw error;
  return data;
}

export async function registrar(email, clave) {
  const { data, error } = await supabase.auth.signUp({ email, password: clave });
  if (error) throw error;
  return data;
}

export async function salir() {
  await supabase.auth.signOut();
}

// ---------- Modo local ----------

function leerLocal(tabla) {
  try { return JSON.parse(localStorage.getItem('lupp:' + tabla) || '[]'); } catch { return []; }
}

function guardarLocal(tabla, filas) {
  try {
    localStorage.setItem('lupp:' + tabla, JSON.stringify(filas));
  } catch {
    throw new Error('Se llenó el espacio del navegador. Usa imágenes más livianas o configura Supabase.');
  }
}

const filaNueva = fila => ({ id: nuevoId(), created_at: new Date().toISOString(), ...fila });

// ---------- Operaciones ----------

export async function listar(tabla) {
  if (!modoNube) return leerLocal(tabla);
  // Supabase entrega máximo 1000 filas por consulta: se piden por páginas
  const todo = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from(tabla).select('*').range(desde, desde + 999);
    if (error) throw error;
    todo.push(...data);
    if (data.length < 1000) return todo;
  }
}

export async function crear(tabla, fila) {
  if (!modoNube) {
    const nueva = filaNueva(fila);
    guardarLocal(tabla, [...leerLocal(tabla), nueva]);
    return nueva;
  }
  const { data, error } = await supabase.from(tabla).insert(fila).select().single();
  if (error) throw error;
  return data;
}

export async function crearVarios(tabla, filas) {
  if (!modoNube) {
    const nuevas = filas.map(filaNueva);
    guardarLocal(tabla, [...leerLocal(tabla), ...nuevas]);
    return nuevas;
  }
  const { data, error } = await supabase.from(tabla).insert(filas).select();
  if (error) throw error;
  return data;
}

export async function actualizar(tabla, id, cambios) {
  if (!modoNube) {
    let actualizada = null;
    guardarLocal(tabla, leerLocal(tabla).map(f => (f.id === id ? (actualizada = { ...f, ...cambios }) : f)));
    return actualizada;
  }
  const { data, error } = await supabase.from(tabla).update(cambios).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function borrar(tabla, id) {
  if (!modoNube) {
    guardarLocal(tabla, leerLocal(tabla).filter(f => f.id !== id));
    return;
  }
  const { error } = await supabase.from(tabla).delete().eq('id', id);
  if (error) throw error;
}

// ---------- Pasar los datos de este dispositivo a la nube ----------
// Cuando inicias sesión por primera vez, LUPP ofrece subir lo que tenías
// guardado en el navegador (modo local) a tu cuenta.

const COLUMNAS = {
  cuentas: ['espacio', 'nombre', 'icono', 'logo', 'saldo_inicial', 'orden', 'created_at'],
  categorias: ['espacio', 'nombre', 'tipo', 'icono', 'color', 'created_at'],
  movimientos: ['espacio', 'tipo', 'monto', 'cuenta_id', 'cuenta_destino_id', 'categoria_id', 'fecha', 'nota', 'created_at'],
  actividades: ['titulo', 'fecha', 'hora_inicio', 'hora_fin', 'repetir', 'dias', 'hasta', 'excepciones', 'avisos', 'monto', 'cuenta_id', 'pagados', 'created_at'],
  tareas: ['titulo', 'fecha', 'hecha', 'prioridad', 'created_at'],
  diario: ['fecha', 'texto', 'created_at'],
  deudas: ['espacio', 'tipo', 'nombre', 'monto', 'fecha', 'nota', 'foto', 'ahorrado', 'abonos', 'created_at'],
};

const esUUID = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));

// En el celular por la red de la casa (http) no existe crypto.randomUUID
function uuid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Cuántas cosas hay guardadas en este dispositivo
export function resumenLocal() {
  const r = {};
  for (const t of TABLAS) r[t] = leerLocal(t).length;
  return r;
}

export function hayDatosLocales() {
  const r = resumenLocal();
  // Solo cuenta si hay algo hecho por la persona (no solo las cuentas y categorías iniciales)
  return Boolean(r.movimientos || r.deudas || r.actividades || r.tareas || r.diario
    || leerLocal('cuentas').some(c => Number(c.saldo_inicial) || c.logo));
}

export async function subirDatosLocales() {
  if (!modoNube) return;
  const local = {};
  for (const t of TABLAS) local[t] = leerLocal(t);

  // Ids nuevos (Supabase usa uuid) manteniendo las relaciones entre tablas
  const mapa = new Map();
  for (const t of TABLAS) for (const f of local[t]) mapa.set(f.id, esUUID(f.id) ? f.id : uuid());
  const existe = t => new Set(local[t].map(f => mapa.get(f.id)));
  const cuentas = existe('cuentas');
  const categorias = existe('categorias');
  const ref = (v, conjunto) => (v && conjunto.has(mapa.get(v)) ? mapa.get(v) : null);

  const limpiar = (t, f) => {
    const o = { id: mapa.get(f.id) };
    for (const c of COLUMNAS[t]) if (f[c] !== undefined && f[c] !== '') o[c] = f[c];
    if ('cuenta_id' in f) o.cuenta_id = ref(f.cuenta_id, cuentas);
    if ('cuenta_destino_id' in f) o.cuenta_destino_id = ref(f.cuenta_destino_id, cuentas);
    if ('categoria_id' in f) o.categoria_id = ref(f.categoria_id, categorias);
    if (t === 'deudas') o.abonos = (f.abonos || []).map(a => ({ ...a, cuenta_id: ref(a.cuenta_id, cuentas) }));
    return o;
  };

  // En orden: primero lo que otras tablas necesitan (cuentas y categorías)
  for (const t of TABLAS) {
    let filas = local[t].map(f => limpiar(t, f));
    if (t === 'movimientos') filas = filas.filter(f => f.cuenta_id); // sin cuenta no se puede
    for (let i = 0; i < filas.length; i += 200) {
      const { error } = await supabase.from(t).upsert(filas.slice(i, i + 200));
      if (error) throw new Error(`No se pudo subir ${t}: ${error.message}`);
    }
  }
}