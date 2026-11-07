// Recorrido guiado de LUPP: va resaltando cada parte de la app, entra a cada
// pestaña y explica para qué sirve. Sale la primera vez y se repite desde Ajustes.
// Para cambiar los textos, edita la lista PASOS.
//
// Cada paso puede tener:
//   tab:   pestaña a la que entra ('hoy', 'finanzas', 'agenda', 'ajustes')
//   menu:  true para abrir el menú del botón +
//   sel:   lo que se resalta (selector CSS). Sin sel, el mensaje sale en el centro.

const PASOS = [
  {
    tab: 'hoy',
    titulo: '¡Hola! Esto es LUPP 👋',
    texto: 'Te voy a mostrar la app parte por parte. Toca <b>Siguiente</b> o toca lo que esté resaltado.',
  },
  {
    tab: 'hoy', sel: '.ahora',
    titulo: 'Ahora toca',
    texto: 'Aquí ves lo que deberías estar haciendo en este momento y lo que sigue, según tu agenda.',
  },
  {
    tab: 'hoy', sel: '.pantalla > .metricas',
    titulo: 'Gané y gasté',
    texto: 'Lo que has ganado <b class="verde">(verde)</b> y gastado <b class="rojo">(rojo)</b> en lo que va del mes.',
  },
  {
    tab: 'hoy', sel: '.saldo',
    titulo: 'Cuánto llevo',
    texto: 'La suma de todas tus cuentas: efectivo, Nequi, banco… Y abajo, cuánto gastaste hoy.',
  },
  {
    tab: 'hoy', sel: '.pantalla > .seg',
    titulo: 'Personal y Empresa',
    texto: 'Cambia entre tu plata personal y la de tu empresa. Cada una tiene sus propias cuentas, así nunca se mezclan.',
  },
  {
    tab: 'hoy', sel: '.nav .fab',
    titulo: 'El botón +',
    texto: 'Desde aquí agregas todo rápido. Mira lo que tiene adentro…',
  },
  {
    tab: 'hoy', menu: true, sel: '.menu-rapido',
    titulo: 'Agregar',
    texto: 'Un <b>gasto</b>, un <b>ingreso</b>, <b>transferir</b> entre cuentas, una <b>actividad</b> de tu agenda, un <b>pendiente</b> o escribir en tu <b>diario</b>.',
  },
  {
    tab: 'hoy', sel: '[data-accion="tab"][data-valor="finanzas"]',
    titulo: 'Finanzas',
    texto: 'Vamos a ver tu plata en detalle. Entremos…',
  },
  {
    tab: 'finanzas', sel: '.mes-nav',
    titulo: 'Mes a mes',
    texto: 'Con las flechas cambias de mes para ver cómo te fue antes.',
  },
  {
    tab: 'finanzas', sel: '.metricas.tres',
    titulo: 'Resumen del mes',
    texto: 'Cuánto ganaste, cuánto gastaste y cuánto <b>te quedó</b>.',
  },
  {
    tab: 'finanzas', sel: '.cuentas-scroll',
    titulo: 'Tus cuentas',
    texto: 'El saldo de cada una. Desliza a los lados para ver todas y tócalas para editarlas o crear una nueva.',
  },
  {
    tab: 'finanzas', sel: '.dia-grupo, .pantalla > .vacio:last-of-type',
    titulo: 'Movimientos',
    texto: 'Aquí aparecen todos tus gastos e ingresos del mes. Toca uno para editarlo o borrarlo. Cuando gastes, también verás <b>¿En qué se fue la plata?</b> por categoría.',
  },
  {
    tab: 'finanzas', sel: '[data-accion="tab"][data-valor="agenda"]',
    titulo: 'Agenda',
    texto: 'Ahora tu tiempo. Entremos a la agenda…',
  },
  {
    tab: 'agenda', sel: '.semana',
    titulo: 'Tu semana',
    texto: 'Toca un día para ver lo que tienes. El puntico dorado indica que ese día tiene actividades.',
  },
  {
    tab: 'agenda', sel: '[data-accion="nueva-act"]',
    titulo: 'Actividades y rutinas',
    texto: 'Crea algo <b>solo para un día</b> o que se <b>repita</b>: todos los días, los días que elijas o cada mes. También le pones <b>avisos</b> a la hora que quieras.',
  },
  {
    tab: 'agenda', sel: '[data-accion="nueva-tarea"]',
    titulo: 'Pendientes',
    texto: 'Cosas por hacer. Márcalas al terminarlas; las que no hagas pasan solas al día siguiente.',
  },
  {
    tab: 'agenda', sel: '.diario',
    titulo: 'Tu diario',
    texto: 'Escribe cómo te fue, ideas o lo que quieras. Cada día tiene su página y se guarda solo.',
  },
  {
    tab: 'agenda', sel: '[data-accion="tab"][data-valor="ajustes"]',
    titulo: 'Ajustes',
    texto: 'Por último, tus ajustes…',
  },
  {
    tab: 'ajustes', sel: '.seg-tema',
    titulo: 'Oscuro o claro',
    texto: 'Elige cómo quieres ver LUPP.',
  },
  {
    tab: 'ajustes', sel: '.card-notif',
    titulo: 'Notificaciones',
    texto: 'Actívalas para que tu celular te avise de tus actividades y pagos.',
  },
  {
    tab: 'ajustes', sel: '[data-accion="guia"]',
    titulo: 'Volver a ver este recorrido',
    texto: 'Si se te olvida algo, aquí lo repites cuando quieras.',
  },
  {
    tab: 'hoy',
    titulo: '¡Listo! 🎉',
    texto: 'Ya conoces LUPP. Empieza registrando tu primer gasto con el botón <b>+</b>.',
  },
];

let paso = 0;
let app = null;      // { irTab, abrirMenu, cerrarMenu, alTerminar }
let $raiz = null;
let $luz = null;
let $globo = null;
let turno = 0;       // evita que un paso viejo se dibuje encima de uno nuevo

export function mostrarGuia(conexion) {
  app = conexion;
  paso = 0;
  $raiz = document.createElement('div');
  $raiz.className = 'tour';
  $raiz.innerHTML = '<div class="tour-fondo"></div><div class="tour-luz"></div><div class="tour-globo" role="dialog" aria-live="polite"></div>';
  document.body.appendChild($raiz);
  $luz = $raiz.querySelector('.tour-luz');
  $globo = $raiz.querySelector('.tour-globo');
  $raiz.addEventListener('click', alClic);
  document.addEventListener('keydown', alTeclado);
  window.addEventListener('resize', ubicar);
  mostrarPaso();
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function mostrarPaso() {
  const mio = ++turno;
  const p = PASOS[paso];
  $raiz.classList.add('cambiando');

  // Prepara la pantalla: entra a la pestaña y abre/cierra el menú +
  if (p.menu) {
    if (!document.querySelector('.menu-rapido')) { app.irTab(p.tab); app.abrirMenu(); await esperar(260); }
  } else {
    app.cerrarMenu();
    app.irTab(p.tab);
  }
  await esperar(30);
  if (mio !== turno) return;

  const el = p.sel ? document.querySelector(p.sel) : null;
  if (el && !p.menu && !el.closest('.nav')) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await esperar(380);
    if (mio !== turno) return;
  }

  dibujarGlobo(p);
  ubicar();
  $raiz.classList.remove('cambiando');
}

function dibujarGlobo(p) {
  const ultimo = paso === PASOS.length - 1;
  $globo.innerHTML = `
    <div class="tour-cab">
      <span class="tour-num">${paso + 1} de ${PASOS.length}</span>
      ${ultimo ? '' : '<button class="link gris" data-tour="cerrar">Saltar</button>'}
    </div>
    <h3>${p.titulo}</h3>
    <p>${p.texto}</p>
    <div class="tour-barra"><i style="width:${((paso + 1) / PASOS.length) * 100}%"></i></div>
    <div class="tour-botones">
      ${paso > 0 ? '<button class="btn btn-sec" data-tour="ant">Atrás</button>' : ''}
      <button class="btn btn-prim" data-tour="${ultimo ? 'cerrar' : 'sig'}">${ultimo ? 'Empezar' : 'Siguiente'}</button>
    </div>`;
}

// Pone el foco sobre el elemento y el globo arriba o abajo, donde quepa
function ubicar() {
  if (!$raiz) return;
  const p = PASOS[paso];
  const el = p.sel ? document.querySelector(p.sel) : null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const g = $globo.getBoundingClientRect();

  if (!el) {
    $luz.classList.add('oculta');
    $raiz.classList.add('centro');
    $globo.style.top = `${Math.max(16, (vh - g.height) / 2)}px`;
    $globo.style.left = `${Math.max(16, (vw - g.width) / 2)}px`;
    return;
  }

  $raiz.classList.remove('centro');
  $luz.classList.remove('oculta');
  const r = el.getBoundingClientRect();
  const m = 6;
  Object.assign($luz.style, {
    top: `${r.top - m}px`, left: `${r.left - m}px`,
    width: `${r.width + m * 2}px`, height: `${r.height + m * 2}px`,
    borderRadius: getComputedStyle(el).borderRadius === '50%' ? '50%' : '16px',
  });

  const espacioAbajo = vh - r.bottom;
  const top = espacioAbajo > g.height + 24
    ? r.bottom + m + 12
    : Math.max(12, r.top - m - 12 - g.height);
  const left = Math.min(Math.max(16, r.left + r.width / 2 - g.width / 2), vw - g.width - 16);
  $globo.style.top = `${top}px`;
  $globo.style.left = `${left}px`;
}

function ir(n) {
  if (n < 0 || n >= PASOS.length) return;
  paso = n;
  mostrarPaso();
}

function cerrar() {
  turno++;
  document.removeEventListener('keydown', alTeclado);
  window.removeEventListener('resize', ubicar);
  $raiz.remove();
  $raiz = null;
  app.cerrarMenu();
  app.irTab('hoy');
  app.alTerminar?.();
}

function alClic(e) {
  const b = e.target.closest('[data-tour]');
  if (b) {
    if (b.dataset.tour === 'sig') ir(paso + 1);
    else if (b.dataset.tour === 'ant') ir(paso - 1);
    else cerrar();
    return;
  }
  // Tocar lo resaltado también avanza, como si lo usaras de verdad
  if (e.target === $luz) ir(paso + 1);
}

function alTeclado(e) {
  if (e.key === 'ArrowRight' || e.key === 'Enter') ir(paso + 1);
  else if (e.key === 'ArrowLeft') ir(paso - 1);
  else if (e.key === 'Escape') cerrar();
}
