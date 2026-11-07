// js/graficos.js
// Gráfico de barras: compara lo que GANASTE (verde) y lo que GASTASTE (rojo)
// por día (últimos 7 días), por semana (últimas 8) o por mes (últimos 6).
// No usa librerías: dibuja con SVG.

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

let modoActual = 'dia'; // 'dia' | 'semana' | 'mes'

function aTexto(f) {
  const m = String(f.getMonth() + 1).padStart(2, '0');
  const d = String(f.getDate()).padStart(2, '0');
  return `${f.getFullYear()}-${m}-${d}`;
}

function inicioSemana(f) {
  const r = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  const diasDesdeLunes = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - diasDesdeLunes);
  return r;
}

function pesos(n) {
  const valor = Math.round(Math.abs(n)).toLocaleString('es-CO');
  return (n < 0 ? '-$ ' : '$ ') + valor;
}

function pesosCorto(n) {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1).replace('.', ',').replace(',0', '') + 'M';
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
  return '$' + n;
}

function armarGrupos(modo, hoy) {
  const grupos = [];
  if (modo === 'dia') {
    for (let i = 6; i >= 0; i--) {
      const f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
      const t = aTexto(f);
      grupos.push({ etiqueta: i === 0 ? 'Hoy' : DIAS[f.getDay()], desde: t, hasta: t });
    }
  } else if (modo === 'semana') {
    const lunes = inicioSemana(hoy);
    for (let i = 7; i >= 0; i--) {
      const d = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() - 7 * i);
      const h = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6);
      grupos.push({
        etiqueta: i === 0 ? 'Esta' : `${d.getDate()} ${MESES[d.getMonth()]}`,
        desde: aTexto(d),
        hasta: aTexto(h)
      });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const h = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      grupos.push({ etiqueta: MESES[d.getMonth()], desde: aTexto(d), hasta: aTexto(h) });
    }
  }
  return grupos;
}

export function datosGrafico(movimientos, modo, hoy = new Date()) {
  const grupos = armarGrupos(modo, hoy).map(g => ({ ...g, ingreso: 0, gasto: 0 }));
  for (const m of movimientos) {
    if (m.tipo !== 'ingreso' && m.tipo !== 'gasto') continue; // las transferencias no cuentan
    const g = grupos.find(g => m.fecha >= g.desde && m.fecha <= g.hasta);
    if (g) g[m.tipo] += Number(m.monto) || 0;
  }
  return grupos;
}

function textoCambio(actual, anterior) {
  if (!anterior) return actual ? 'antes no había' : 'igual';
  const p = Math.round(((actual - anterior) / anterior) * 100);
  if (p === 0) return 'igual';
  return p > 0 ? `${p}% más` : `${-p}% menos`;
}

function dibujar(movimientos) {
  const grupos = datosGrafico(movimientos, modoActual);
  const n = grupos.length;
  const ancho = 340, alto = 170, base = alto - 22;
  const max = Math.max(1, ...grupos.flatMap(g => [g.ingreso, g.gasto]));
  const espacio = ancho / n;
  const barra = Math.min(16, espacio / 3);

  let barras = '';
  grupos.forEach((g, i) => {
    const x = i * espacio + espacio / 2;
    const hI = (g.ingreso / max) * (base - 14);
    const hG = (g.gasto / max) * (base - 14);
    barras += `
      <rect class="gb-ingreso" x="${x - barra - 1}" y="${base - hI}" width="${barra}" height="${hI}" rx="3">
        <title>${g.etiqueta} · Gané ${pesos(g.ingreso)}</title></rect>
      <rect class="gb-gasto" x="${x + 1}" y="${base - hG}" width="${barra}" height="${hG}" rx="3">
        <title>${g.etiqueta} · Gasté ${pesos(g.gasto)}</title></rect>
      <text class="gb-etiqueta" x="${x}" y="${alto - 6}" text-anchor="middle">${g.etiqueta}</text>`;
  });

  const actual = grupos[n - 1];
  const anterior = grupos[n - 2];
  const nombres = {
    dia: ['Hoy', 'ayer'],
    semana: ['Esta semana', 'la anterior'],
    mes: ['Este mes', 'el anterior']
  }[modoActual];

  const boton = (modo, texto) =>
    `<button type="button" class="gb-tab ${modoActual === modo ? 'activo' : ''}" data-gb-modo="${modo}">${texto}</button>`;

  return `
    <div class="gb-tabs">
      ${boton('dia', 'Día')}${boton('semana', 'Semana')}${boton('mes', 'Mes')}
    </div>
    <svg class="gb-svg" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Gráfico de ganancias y gastos">
      <line class="gb-base" x1="0" y1="${base}" x2="${ancho}" y2="${base}"></line>
      ${barras}
    </svg>
    <div class="gb-leyenda">
      <span><i class="gb-punto gb-p-ingreso"></i>Gané</span>
      <span><i class="gb-punto gb-p-gasto"></i>Gasté</span>
      <span class="gb-max">Máx. ${pesosCorto(max)}</span>
    </div>
    <div class="gb-comparar">
      <strong>${nombres[0]} vs ${nombres[1]}</strong>
      <div>Gané <b class="gb-verde">${pesos(actual.ingreso)}</b> (${textoCambio(actual.ingreso, anterior.ingreso)})</div>
      <div>Gasté <b class="gb-rojo">${pesos(actual.gasto)}</b> (${textoCambio(actual.gasto, anterior.gasto)})</div>
      <div>Me quedó <b>${pesos(actual.ingreso - actual.gasto)}</b></div>
    </div>`;
}

// Úsala así: montarGrafico(document.getElementById('grafico-finanzas'), movimientosDelEspacio)
// Pásale TODOS los movimientos del espacio (Personal o Empresa), no solo los del mes.
export function montarGrafico(contenedor, movimientos) {
  if (!contenedor) return;
  contenedor.classList.add('grafico-caja');
  contenedor.innerHTML = dibujar(movimientos);
  contenedor.onclick = (e) => {
    const b = e.target.closest('[data-gb-modo]');
    if (!b) return;
    modoActual = b.dataset.gbModo;
    contenedor.innerHTML = dibujar(movimientos);
  };
}