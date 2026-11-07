// js/bancos.js
// Catálogo de bancos y billeteras de Colombia.
// Cada cuenta puede tener su propio logo (una imagen que subes desde "Editar cuenta").
// Si no tiene, se muestra un círculo con el color y las iniciales del banco.

export const BANCOS = [
  { id: 'efectivo',     nombre: 'Efectivo',             iniciales: '$',  color: '#2E7D32' },
  { id: 'nequi',        nombre: 'Nequi',                iniciales: 'N',  color: '#5B1A5E' },
  { id: 'daviplata',    nombre: 'Daviplata',            iniciales: 'DP', color: '#E30613' },
  { id: 'bancolombia',  nombre: 'Bancolombia',          iniciales: 'BC', color: '#FDDA24', texto: '#1D1D1B' },
  { id: 'nu',           nombre: 'Nu',                   iniciales: 'Nu', color: '#820AD1' },
  { id: 'davivienda',   nombre: 'Davivienda',           iniciales: 'DV', color: '#ED1C24' },
  { id: 'bogota',       nombre: 'Banco de Bogotá',      iniciales: 'BB', color: '#003B71' },
  { id: 'bbva',         nombre: 'BBVA',                 iniciales: 'BV', color: '#004481' },
  { id: 'popular',      nombre: 'Banco Popular',        iniciales: 'BP', color: '#00843D' },
  { id: 'occidente',    nombre: 'Banco de Occidente',   iniciales: 'BO', color: '#0055A5' },
  { id: 'avvillas',     nombre: 'AV Villas',            iniciales: 'AV', color: '#0057A8' },
  { id: 'colpatria',    nombre: 'Scotiabank Colpatria', iniciales: 'SC', color: '#EC111A' },
  { id: 'cajasocial',   nombre: 'Banco Caja Social',    iniciales: 'CS', color: '#0068B3' },
  { id: 'falabella',    nombre: 'Banco Falabella',      iniciales: 'BF', color: '#5DA829' },
  { id: 'lulo',         nombre: 'Lulo Bank',            iniciales: 'LB', color: '#C5E600', texto: '#1D1D1B' },
  { id: 'rappipay',     nombre: 'RappiPay',             iniciales: 'RP', color: '#FF441F' },
  { id: 'movii',        nombre: 'MOVii',                iniciales: 'MV', color: '#5C2D91' },
  { id: 'dale',         nombre: 'dale!',                iniciales: 'D!', color: '#00A3E0' },
  { id: 'tarjeta',      nombre: 'Tarjeta de crédito',   iniciales: 'TC', color: '#8B1E2D' },
  { id: 'otra',         nombre: 'Otra cuenta',          iniciales: '•',  color: '#555555' }
];

function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Solo se aceptan imágenes guardadas por la propia app
export const esImagen = v => typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v);

// Encuentra el banco de una cuenta: primero por el campo icono ('banco:nequi'),
// si no, por el nombre de la cuenta.
export function bancoDeCuenta(cuenta) {
  if (cuenta?.icono?.startsWith('banco:')) {
    const b = BANCOS.find(b => b.id === cuenta.icono.slice(6));
    if (b) return b;
  }
  const nombre = normalizar(cuenta?.nombre);
  return BANCOS.find(b => normalizar(b.nombre) === nombre)
      || BANCOS.find(b => b.id !== 'otra' && nombre.includes(normalizar(b.nombre)))
      || BANCOS.find(b => b.id === 'otra');
}

// HTML del logo redondo. Si la cuenta tiene logo propio, muestra esa imagen.
export function logoCuenta(cuenta, tamano = 36) {
  const b = bancoDeCuenta(cuenta);
  const foto = esImagen(cuenta?.logo) ? `<img src="${cuenta.logo}" alt="">` : '';
  return `<span class="logo-banco${foto ? ' con-foto' : ''}" style="--c:${b.color}; --ct:${b.texto || '#fff'}; --t:${tamano}px">${foto || `<b>${b.iniciales}</b>`}</span>`;
}