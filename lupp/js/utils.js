// Utilidades: fechas, plata en pesos colombianos, texto seguro y repeticiones.

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_CORTOS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const DIAS_3 = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ---------- Fechas (siempre en formato 'AAAA-MM-DD', hora local) ----------

export function aISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function deISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const hoyISO = () => aISO(new Date());

export function sumarDias(s, n) {
  const d = deISO(s);
  d.setDate(d.getDate() + n);
  return aISO(d);
}

// mes = 'AAAA-MM'
export function sumarMeses(mes, n) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Lunes de la semana de esa fecha
export function inicioSemana(s) {
  const d = deISO(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return aISO(d);
}

export function fechaLarga(s) {
  const d = deISO(s);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export const capital = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function horaAmPm(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'pm' : 'am'}`;
}

export function minutosDe(h) {
  const [a, b] = h.split(':').map(Number);
  return a * 60 + b;
}

export function ahoraMinutos() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function horaActual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------- Plata ----------

const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// pesos(1250000) → "$ 1.250.000"; con signo=true los positivos llevan "+"
export function pesos(n, signo = false) {
  const v = Math.round(Number(n) || 0);
  const pre = v < 0 ? '− ' : (signo && v > 0 ? '+ ' : '');
  return `${pre}$ ${miles(Math.abs(v))}`;
}

export const soloDigitos = v => Number(String(v ?? '').replace(/\D/g, '')) || 0;
export const formatearDigitos = n => (n ? miles(n) : '');

// ---------- Texto ----------

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function nuevoId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---------- Repeticiones de la agenda ----------

// ¿La actividad "a" ocurre en la fecha "f"?
export function ocurreEn(a, f) {
  if (f < a.fecha) return false;
  if (a.hasta && f > a.hasta) return false;
  if ((a.excepciones || []).includes(f)) return false;
  switch (a.repetir) {
    case 'diario':
      return true;
    case 'semanal':
      return (a.dias || []).map(Number).includes(deISO(f).getDay());
    case 'mensual': {
      const d = deISO(f);
      const diaBase = deISO(a.fecha).getDate();
      const ultimoDelMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(diaBase, ultimoDelMes);
    }
    default:
      return f === a.fecha;
  }
}

export function textoDias(dias = []) {
  const ds = [...dias].map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (ds.join() === '1,2,3,4,5') return 'Lun a Vie';
  if (ds.join() === '6,0') return 'Fines de semana';
  if (ds.length === 7) return 'Todos los días';
  return ds.map(d => DIAS_3[d]).join(', ');
}
