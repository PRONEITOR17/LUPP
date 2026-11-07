// js/animaciones.js
// Animaciones de LUPP: números que cuentan y celebración estilo Duolingo al guardar.
// Todo se anima con transform/opacity, canvas y requestAnimationFrame (60 fps).

import { pesos, esc } from './utils.js';

const reducir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const suave = t => 1 - Math.pow(1 - t, 4); // arranca rápido y frena suave

// ---------- Preferencia de sonido ----------
export function sonidoActivo() {
  try { return localStorage.getItem('lupp:sonido') !== 'no'; } catch { return true; }
}
export function cambiarSonido(activo) {
  try { localStorage.setItem('lupp:sonido', activo ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
}

// ---------- Números que cuentan ----------

const ultimos = new Map();                // último valor mostrado de cada número
let esperaCelebracion = Promise.resolve(); // se cumple cuando se cierra la celebración

const formato = (el, v) => (el.dataset.fmt === 'pct' ? `${Math.round(v)}%` : pesos(v));

// Devuelve un número en pesos que se anima cuando cambia.
export function num(clave, valor) {
  const v = Math.round(Number(valor) || 0);
  return `<span class="num" data-num="${v}" data-clave="${clave}">${pesos(v)}</span>`;
}

// Igual, pero en porcentaje (ej. 40%)
export function numPct(clave, valor) {
  const v = Math.round(Number(valor) || 0);
  return `<span class="num" data-fmt="pct" data-num="${v}" data-clave="${clave}">${v}%</span>`;
}

// Barra de progreso que se llena desde donde estaba (0 a 100)
const barras = new Map();
export function barra(clave, porcentaje, clase = '') {
  const p = Math.max(0, Math.min(100, Number(porcentaje) || 0)) / 100;
  const p0 = barras.has(clave) ? barras.get(clave) : 0;
  barras.set(clave, p);
  return `<div class="barra-prog ${clase}"><i style="--p0:${p0};--p:${p}"></i></div>`;
}

// Busca los números de la pantalla y anima los que cambiaron
export function animarNumeros(raiz = document) {
  const espera = esperaCelebracion;
  raiz.querySelectorAll('[data-clave]').forEach(el => {
    const clave = el.dataset.clave;
    const hasta = Number(el.dataset.num);
    const primeraVez = !ultimos.has(clave);
    const desde = primeraVez ? 0 : ultimos.get(clave);
    ultimos.set(clave, hasta);
    if (desde === hasta || reducir()) return;

    el.textContent = formato(el, desde);
    // Si hay celebración en pantalla, el número cuenta justo cuando se cierra
    espera.then(() => {
      if (!el.isConnected) return;
      if (!primeraVez) {
        el.classList.remove('sube', 'baja');
        void el.offsetWidth;
        el.classList.add(hasta > desde ? 'sube' : 'baja');
      }
      const duracion = primeraVez ? 900 : 1100;
      const t0 = performance.now();
      const paso = ahora => {
        if (!el.isConnected) return;
        const p = Math.min(1, (ahora - t0) / duracion);
        el.textContent = formato(el, desde + (hasta - desde) * suave(p));
        if (p < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });
  });
}

// ---------- Sonidos (se generan en el momento, no necesitan archivos) ----------

let audio;
let ruido;

function contexto() {
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
  if (!ruido) {
    ruido = audio.createBuffer(1, audio.sampleRate * 0.5, audio.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return audio;
}

// Nota simple con ataque rápido y caída suave
function nota(ac, { f, ini, dur = 0.5, vol = 0.12, forma = 'sine', hasta = null }) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = forma;
  o.frequency.setValueAtTime(f, ini);
  if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, ini + dur * 0.8);
  g.gain.setValueAtTime(0, ini);
  g.gain.linearRampToValueAtTime(vol, ini + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, ini + dur);
  o.connect(g).connect(ac.destination);
  o.start(ini);
  o.stop(ini + dur + 0.05);
}

// Campanita metálica (varios armónicos) para el "ching"
function campana(ac, f, ini, vol = 0.1) {
  [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.9, 0.1]].forEach(([m, v]) =>
    nota(ac, { f: f * m, ini, dur: 0.9 / Math.sqrt(m), vol: vol * v }));
}

// Golpecito de ruido (cajón de la caja registradora, roce de monedas)
function golpe(ac, ini, { frec = 3000, dur = 0.04, vol = 0.18, q = 1.2 } = {}) {
  const src = ac.createBufferSource();
  src.buffer = ruido;
  const filtro = ac.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = frec;
  filtro.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, ini);
  g.gain.exponentialRampToValueAtTime(0.0001, ini + dur);
  src.connect(filtro).connect(g).connect(ac.destination);
  src.start(ini, Math.random() * 0.3);
  src.stop(ini + dur + 0.02);
}

const SONIDOS = {
  // ¡Cha-ching! caja registradora
  ingreso(ac, t) {
    golpe(ac, t, { frec: 2200, dur: 0.06, vol: 0.22 });
    golpe(ac, t + 0.05, { frec: 5000, dur: 0.05, vol: 0.12 });
    campana(ac, 1568, t + 0.09, 0.11);
    campana(ac, 2093, t + 0.2, 0.12);
    for (let i = 0; i < 5; i++) golpe(ac, t + 0.3 + i * 0.045, { frec: 6000 + Math.random() * 3000, dur: 0.03, vol: 0.06, q: 8 });
  },
  // "Fwip": la plata que se va (suave, no triste)
  gasto(ac, t) {
    nota(ac, { f: 900, hasta: 260, ini: t, dur: 0.28, vol: 0.12, forma: 'sine' });
    nota(ac, { f: 450, hasta: 130, ini: t, dur: 0.3, vol: 0.05, forma: 'triangle' });
    golpe(ac, t, { frec: 1800, dur: 0.12, vol: 0.06, q: 0.7 });
    nota(ac, { f: 140, ini: t + 0.22, dur: 0.18, vol: 0.12 });
  },
  // Monedas que caen (te pagaron)
  monedas(ac, t) {
    for (let i = 0; i < 6; i++) {
      const ini = t + i * 0.06 + Math.random() * 0.02;
      campana(ac, 2400 + Math.random() * 1600, ini, 0.04);
      golpe(ac, ini, { frec: 7000, dur: 0.025, vol: 0.06, q: 6 });
    }
    campana(ac, 2093, t + 0.42, 0.1);
  },
  // Pagaste un abono: campanitas que suben
  abono(ac, t) {
    [659.25, 783.99, 987.77].forEach((f, i) => campana(ac, f, t + i * 0.09, 0.08));
  },
  // Deuda saldada: fanfarria + cha-ching
  saldada(ac, t) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      nota(ac, { f, ini: t + i * 0.1, dur: 0.6, vol: 0.1, forma: 'triangle' });
      nota(ac, { f: f * 2, ini: t + i * 0.1, dur: 0.4, vol: 0.03 });
    });
    [1046.5, 1318.5, 1568].forEach(f => nota(ac, { f, ini: t + 0.45, dur: 1.1, vol: 0.07, forma: 'triangle' }));
    SONIDOS.ingreso(ac, t + 0.55);
  },
  // Saldo actualizado
  ajuste(ac, t) {
    [587.33, 739.99, 880].forEach((f, i) => campana(ac, f, t + i * 0.08, 0.07));
  },
  // Algo se borró
  borrar(ac, t) {
    nota(ac, { f: 320, hasta: 110, ini: t, dur: 0.22, vol: 0.12 });
    golpe(ac, t, { frec: 900, dur: 0.08, vol: 0.08, q: 0.8 });
  },
  // Toque suave (cambiar frase, elegir foto)
  toque(ac, t) {
    nota(ac, { f: 1200, ini: t, dur: 0.08, vol: 0.05 });
    nota(ac, { f: 1800, ini: t + 0.04, dur: 0.08, vol: 0.035 });
  },
  ok(ac, t) {
    [587.33, 880].forEach((f, i) => campana(ac, f, t + i * 0.09, 0.08));
  },
};

export function sonar(tipo) {
  if (!sonidoActivo()) return;
  try {
    const ac = contexto();
    (SONIDOS[tipo] || SONIDOS.ok)(ac, ac.currentTime + 0.03);
  } catch { /* sin sonido */ }
}

// ---------- Confeti en canvas ----------

function lanzarConfeti(lienzo, colores, cantidad) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const ancho = lienzo.clientWidth;
  const alto = lienzo.clientHeight;
  lienzo.width = ancho * dpr;
  lienzo.height = alto * dpr;
  const ctx = lienzo.getContext('2d');
  ctx.scale(dpr, dpr);

  const azar = (a, b) => a + Math.random() * (b - a);
  const piezas = [];
  const crear = (x, y, angulo, abertura, fuerza, n, retraso) => {
    for (let i = 0; i < n; i++) {
      const a = angulo + azar(-abertura, abertura);
      const v = fuerza * azar(0.55, 1.1);
      piezas.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        giro: azar(0, Math.PI * 2),
        vGiro: azar(-0.25, 0.25),
        vaiven: azar(0, Math.PI * 2),
        w: azar(6, 11),
        h: azar(8, 15),
        forma: Math.random() < 0.25 ? 'circulo' : Math.random() < 0.3 ? 'cinta' : 'papel',
        color: colores[i % colores.length],
        nace: retraso,
        vida: 1,
      });
    }
  };

  const cx = ancho / 2;
  const cy = alto * 0.36;
  const arriba = -Math.PI / 2;
  // Explosión desde la medalla
  crear(cx, cy, arriba, Math.PI, 13, Math.round(cantidad * 0.45), 120);
  // Cañones desde las esquinas de abajo (estilo Duolingo)
  crear(0, alto, -Math.PI / 3, 0.35, 22, Math.round(cantidad * 0.275), 260);
  crear(ancho, alto, -Math.PI * 2 / 3, 0.35, 22, Math.round(cantidad * 0.275), 260);

  const t0 = performance.now();
  let previo = t0;
  const cuadro = ahora => {
    if (!lienzo.isConnected) return;
    const dt = Math.min(2.5, (ahora - previo) / 16.67); // compensa si el celular se atrasa
    previo = ahora;
    const pasado = ahora - t0;
    ctx.clearRect(0, 0, ancho, alto);
    let vivas = 0;
    for (const p of piezas) {
      if (pasado < p.nace) { vivas++; continue; }
      p.vx *= Math.pow(0.985, dt);
      p.vy = p.vy * Math.pow(0.985, dt) + 0.32 * dt;
      p.vaiven += 0.12 * dt;
      p.x += (p.vx + Math.sin(p.vaiven) * 0.8) * dt;
      p.y += p.vy * dt;
      p.giro += p.vGiro * dt;
      if (pasado > p.nace + 1800) p.vida -= 0.02 * dt;
      if (p.vida <= 0 || p.y > alto + 30) continue;
      vivas++;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.vida);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.scale(1, Math.cos(p.vaiven * 1.3)); // efecto de papel que voltea
      ctx.fillStyle = p.color;
      if (p.forma === 'circulo') {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.forma === 'cinta') {
        ctx.fillRect(-p.w / 5, -p.h, p.w / 2.5, p.h * 2);
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (vivas) requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
}

// ---------- Celebración ----------

const ESTILOS = {
  ingreso: {
    color: '#22C55E', oscuro: '#15803D', icono: 'coins',
    confeti: ['#22C55E', '#D4AF37', '#F3D77A', '#FFFFFF', '#4ADE80', '#8B1E2D'], cantidad: 170,
    titulos: ['¡Listo!', '¡Eso es!', '¡Bien hecho!', '¡Vas muy bien!', '¡Así se hace!'],
  },
  gasto: {
    color: '#EF4444', oscuro: '#B91C1C', icono: 'receipt',
    confeti: ['#EF4444', '#FFFFFF', '#D4AF37', '#F87171'], cantidad: 70,
    titulos: ['¡Listo!', '¡Anotado!'],
  },
  ajuste: {
    color: '#D4AF37', oscuro: '#8C6D1F', icono: 'wallet',
    confeti: ['#D4AF37', '#F3D77A', '#FFFFFF', '#8B1E2D'], cantidad: 110,
    titulos: ['¡Listo!'],
  },
  ok: {
    color: '#D4AF37', oscuro: '#8C6D1F', icono: 'arrows-exchange',
    confeti: ['#D4AF37', '#F3D77A', '#FFFFFF', '#8B1E2D'], cantidad: 90,
    titulos: ['¡Listo!'],
  },
  abono_recibido: {
    color: '#22C55E', oscuro: '#15803D', icono: 'cash', sonido: 'monedas',
    confeti: ['#22C55E', '#D4AF37', '#FFFFFF', '#4ADE80'], cantidad: 130,
    titulos: ['¡Te pagaron!', '¡Eso es!', '¡Listo!'],
  },
  abono_pagado: {
    color: '#D4AF37', oscuro: '#8C6D1F', icono: 'circle-check', sonido: 'abono',
    confeti: ['#D4AF37', '#F3D77A', '#FFFFFF', '#22C55E'], cantidad: 110,
    titulos: ['¡Un paso menos!', '¡Listo!', '¡Bien hecho!'],
  },
  saldada: {
    color: '#22C55E', oscuro: '#15803D', icono: 'trophy', sonido: 'saldada',
    confeti: ['#22C55E', '#D4AF37', '#F3D77A', '#FFFFFF', '#4ADE80', '#8B1E2D'], cantidad: 260,
    titulos: ['¡Deuda saldada!'],
  },
};

// Pantalla de celebración.
//  tipo:    'ingreso' | 'gasto' | 'ajuste' | 'ok'
//  titulo:  opcional (si no, uno al azar según el tipo, ej. "¡Listo!")
//  frase:   texto antes del monto, ej. "Ingresaste"
//  monto:   número en pesos (se anima contando)
//  detalle: texto debajo, ej. "a Nequi"  (texto plano, aquí se escapa)
//  datos:   tarjetitas abajo: [{ etq: 'Saldo en Nequi', valor: 38858 }]
export function celebrar({ tipo = 'ok', titulo, frase = '', monto = null, detalle = '', datos = [] }) {
  const e = ESTILOS[tipo] || ESTILOS.ok;
  const tituloFinal = titulo || e.titulos[Math.floor(Math.random() * e.titulos.length)];
  const signo = tipo === 'ingreso' || tipo === 'abono_recibido' ? '+ ' : (monto !== null && monto < 0) || tipo === 'gasto' ? '− ' : '';

  navigator.vibrate?.(tipo === 'saldada' ? [20, 60, 20, 60, 20, 60, 60] : tipo === 'ingreso' ? [15, 60, 15, 60, 30] : [15, 50, 15]);
  sonar(e.sonido || tipo);
  document.querySelector('.celebra')?.remove();

  const letras = [...tituloFinal].map((l, i) =>
    `<span style="--i:${i}">${l === ' ' ? '&nbsp;' : esc(l)}</span>`).join('');

  const el = document.createElement('div');
  el.className = `celebra celebra-${tipo}`;
  el.setAttribute('role', 'status');
  el.style.setProperty('--cc', e.color);
  el.style.setProperty('--cc-oscuro', e.oscuro);
  el.innerHTML = `
    <canvas class="celebra-confeti" aria-hidden="true"></canvas>
    <div class="celebra-contenido">
      <div class="celebra-medalla">
        <div class="celebra-rayos" aria-hidden="true"></div>
        <div class="celebra-circulo"><i class="ti ti-${e.icono}"></i></div>
        <div class="celebra-sombra" aria-hidden="true"></div>
      </div>
      <h2 class="celebra-titulo">${letras}</h2>
      ${monto !== null ? `
        <p class="celebra-frase">${esc(frase)}</p>
        <div class="celebra-monto">${signo}<span>${pesos(0)}</span></div>` : ''}
      ${detalle ? `<p class="celebra-detalle">${esc(detalle)}</p>` : ''}
      ${datos.length ? `<div class="celebra-datos">${datos.map((d, i) => `
        <div class="celebra-dato" style="--i:${i}">
          <small>${esc(d.etq)}</small>
          <b class="${d.valor < 0 ? 'rojo' : ''}">${pesos(d.valor)}</b>
        </div>`).join('')}</div>` : ''}
    </div>
    <button type="button" class="celebra-boton">Continuar</button>`;
  document.body.append(el);

  let terminar;
  esperaCelebracion = new Promise(r => { terminar = r; });

  if (!reducir()) lanzarConfeti(el.querySelector('.celebra-confeti'), e.confeti, e.cantidad);

  // El monto cuenta desde 0 con un "tic" visual al final
  const span = el.querySelector('.celebra-monto span');
  if (span) {
    const total = Math.abs(Math.round(monto));
    if (reducir()) span.textContent = pesos(total);
    else {
      setTimeout(() => {
        const t0 = performance.now();
        const paso = ahora => {
          if (!el.isConnected) return;
          const p = Math.min(1, (ahora - t0) / 900);
          span.textContent = pesos(total * suave(p));
          if (p < 1) requestAnimationFrame(paso);
          else span.parentElement.classList.add('tic');
        };
        requestAnimationFrame(paso);
      }, 650);
    }
  }

  const cerrar = () => {
    if (el.classList.contains('sale')) return;
    el.classList.add('sale');
    setTimeout(() => { el.remove(); }, 380);
    setTimeout(terminar, 200);
  };
  el.querySelector('.celebra-boton').addEventListener('click', cerrar);
  el.addEventListener('click', ev => { if (ev.target === el) cerrar(); });
  const auto = setTimeout(cerrar, 4800);
  el.addEventListener('pointerdown', () => clearTimeout(auto), { once: true });
  setTimeout(() => el.querySelector('.celebra-boton')?.focus({ preventScroll: true }), 900);
}