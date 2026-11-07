// js/consejos.js
// El "coach de plata" de LUPP: mira cómo vas con la plata y te habla en costeño.
// Devuelve una situación con frases divertidas y un consejo financiero de verdad.

import { pesos, sumarDias, deISO } from './utils.js';

const diasEntre = (a, b) => Math.round((deISO(b) - deISO(a)) / 86400000);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Consejos generales para los días tranquilos
const TIPS = [
  'Antes de comprar algo que no necesitas, espera 24 horas. Si al otro día lo sigues queriendo, ahí sí.',
  'Págate a ti primero: apenas te entre plata, aparta un 10% para ahorro y vive con el resto.',
  'Los gastos hormiga (tinto, domicilios, antojos) parecen poquitos, pero al mes suman un montón.',
  'Ten un fondo de emergencia: la meta es juntar lo que gastas en 3 meses.',
  'Revisa tus suscripciones: si no la usaste este mes, cancélala.',
  'Cuando prestes plata, acuerden una fecha y una cuota. Anótalo en Deudas para no olvidarlo.',
  'Mercado con lista y con el estómago lleno: compras menos cosas que no necesitas.',
];

// Escoge siempre la misma frase en el día (no cambia cada vez que se refresca),
// pero se puede pasar a la siguiente con "otra".
export function escoger(lista, semilla, extra = 0) {
  let h = 0;
  for (const ch of semilla) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return lista[(h + extra) % lista.length];
}

export function analizar({ movs, total, categorias, deudas = [], hoy, hora = new Date().getHours() }) {
  const sumar = cumple => {
    let ing = 0, gas = 0;
    for (const m of movs) {
      if (!cumple(m.fecha)) continue;
      if (m.tipo === 'ingreso') ing += Number(m.monto);
      else if (m.tipo === 'gasto') gas += Number(m.monto);
    }
    return { ing, gas };
  };
  const mesClave = hoy.slice(0, 7);
  const dia = sumar(f => f === hoy);
  const mes = sumar(f => f.startsWith(mesClave));

  // Promedio de gasto diario de los últimos 30 días (sin contar hoy)
  const ini30 = sumarDias(hoy, -30);
  const antes = sumar(f => f >= ini30 && f < hoy);
  const primera = movs.reduce((min, m) => (m.fecha < min ? m.fecha : min), hoy);
  const diasHistoria = Math.min(30, diasEntre(primera, hoy));
  const promDia = diasHistoria >= 3 && antes.gas > 0 ? antes.gas / diasHistoria : null;

  // Categoría donde más se va la plata este mes
  const porCat = {};
  for (const m of movs) {
    if (m.tipo === 'gasto' && m.fecha.startsWith(mesClave)) porCat[m.categoria_id] = (porCat[m.categoria_id] || 0) + Number(m.monto);
  }
  const [topId, topValor] = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0] || [];
  const topNombre = categorias.find(c => c.id === topId)?.nombre || 'Sin categoría';
  const topPct = pct(topValor || 0, mes.gas);

  // Deudas pendientes
  const pagado = d => (d.abonos || []).reduce((s, a) => s + Number(a.monto), 0);
  const pendiente = tipo => deudas
    .filter(d => d.tipo === tipo)
    .map(d => ({ nombre: d.nombre, falta: Math.max(0, Number(d.monto) - pagado(d)) }))
    .filter(d => d.falta > 0)
    .sort((a, b) => b.falta - a.falta);
  const meDeben = pendiente('me_deben');
  const debo = pendiente('debo');
  const totalMeDeben = meDeben.reduce((s, d) => s + d.falta, 0);
  const totalDebo = debo.reduce((s, d) => s + d.falta, 0);

  const sobra = mes.ing - mes.gas;
  const tasa = mes.ing ? sobra / mes.ing : null;
  const base = { mes, dia, promDia };

  // ---- Situaciones, de la más urgente a la más tranquila ----

  if (!movs.length && !totalMeDeben && !totalDebo) {
    return { ...base, clave: 'sin-datos', animo: 'neutro', icono: 'sparkles',
      frases: [
        'Ajá, ¿y la plata dónde está? Registra tu primer movimiento.',
        'Arranquemos, mi llave: anota lo que ganas y lo que gastas.',
      ],
      consejo: 'Toca el botón + y anota lo que te entra y lo que te sale. Con unos días de datos te empiezo a aconsejar.' };
  }

  if (total < 0) {
    return { ...base, clave: 'rojo', animo: 'mal', icono: 'alert-triangle',
      frases: [
        'Manito, estás en rojo. Aquí toca apretarse el cinturón.',
        'Eche, la cuenta dice menos… eso no es buena señal.',
        'Ombe, debes más de lo que tienes. Calma y hagamos un plan.',
      ],
      consejo: `Tu total está en ${pesos(total)}. Esta semana compra solo lo necesario y prioriza pagar lo que debes, empezando por lo que cobra intereses (como la tarjeta de crédito).` };
  }

  if (promDia && dia.gas > promDia * 2.5 && dia.gas >= 30000) {
    const veces = (dia.gas / promDia).toFixed(1).replace('.', ',').replace(',0', '');
    return { ...base, clave: 'dia-alto', animo: 'mal', icono: 'flame',
      frases: [
        '¡Carajo, manito! ¿Compraste una casa o qué?',
        'Uy, ¿y qué tanto compras? Hoy la billetera lloró.',
        '¡Erda! Hoy gastaste como si fueras dueño de un banco.',
        'Ajá, ¿y la plata te está quemando las manos o qué?',
        'Ombe, hoy se te fue la mano, mi llave.',
      ],
      consejo: `Hoy gastaste ${pesos(dia.gas)}: eso es ${veces} veces lo que gastas en un día normal (${pesos(promDia)}). Mañana intenta no pasarte de ${pesos(promDia)} y se compensa.` };
  }

  if (mes.gas > 0 && mes.ing === 0) {
    return { ...base, clave: 'sin-ingreso', animo: 'ojo', icono: 'mood-nervous',
      frases: [
        'Plata sale y no entra… ¿de dónde la estás sacando, mi llave?',
        'Uy manito, este mes la plata solo va pa\' fuera.',
        'Todo es gasto y cero ingreso. Ojo con eso, pelao.',
      ],
      consejo: `Este mes llevas ${pesos(mes.gas)} en gastos y no has anotado ningún ingreso. Si te entró plata, regístrala para que las cuentas te cuadren.` };
  }

  if (mes.ing > 0 && mes.gas > mes.ing) {
    return { ...base, clave: 'mes-pasado', animo: 'mal', icono: 'trending-down',
      frases: [
        'Ajá y entonces… ¿estás gastando más de lo que entra?',
        'La plata entra por la puerta y sale por la ventana, manito.',
        'Uy, este mes el gasto le está ganando al ingreso.',
        'Pilas, pelao: así no hay bolsillo que aguante.',
      ],
      consejo: `Este mes vas ${pesos(mes.gas - mes.ing)} por encima de lo que ganaste. ${topValor
        ? `Lo que más pesa es ${topNombre} (${topPct}% de tus gastos): empieza recortando ahí.`
        : 'Revisa en qué se te va y recorta lo que no sea necesario.'}` };
  }

  if (promDia && total > 0 && total / promDia < 7) {
    const dias = Math.max(1, Math.floor(total / promDia));
    return { ...base, clave: 'poca-plata', animo: 'ojo', icono: 'hourglass-low',
      frases: [
        `Ojo, pelao: a este ritmo la plata te dura ${dias} día${dias === 1 ? '' : 's'}.`,
        'Eche, la billetera ya va en reserva.',
        'Manito, ya se le ve el fondo a la olla.',
      ],
      consejo: `Con ${pesos(total)} y gastando unos ${pesos(promDia)} al día, te alcanza para ${dias} día${dias === 1 ? '' : 's'}. Si bajas el gasto diario a ${pesos(total / 14)}, te dura dos semanas.` };
  }

  if (topValor && topPct >= 45 && mes.gas >= 50000) {
    return { ...base, clave: 'categoria', animo: 'ojo', icono: 'chart-pie',
      frases: [
        `¿Tú vives de ${topNombre.toLowerCase()} o qué, mi llave?`,
        `Erda, ${topNombre.toLowerCase()} se está comiendo tu plata.`,
        `Mucho ${topNombre.toLowerCase()}, manito. Ahí hay un hueco en el bolsillo.`,
      ],
      consejo: `${topNombre} se lleva el ${topPct}% de lo que gastaste este mes (${pesos(topValor)}). Si le bajas un 20%, te ahorras ${pesos(topValor * 0.2)} al mes.` };
  }

  if (totalMeDeben > 0 && (hora >= 12 || !dia.ing)) {
    const quien = meDeben[0];
    return { ...base, clave: 'te-deben', animo: 'ojo', icono: 'user-dollar',
      frases: [
        `Te deben ${pesos(totalMeDeben)}… ¿y quién va a cobrar, tú o el viento?`,
        'Pilas, que hay gente debiéndote. Cobra con cariño, pero cobra.',
        `Ajá, ¿y ${quien.nombre} cuándo es que te paga?`,
      ],
      consejo: `Tienes ${pesos(totalMeDeben)} por cobrar; el que más te debe es ${quien.nombre} (${pesos(quien.falta)}). Acuerden una cuota fija por semana: es más fácil de cumplir que pagar todo de una.` };
  }

  if (dia.gas === 0 && hora >= 17) {
    return { ...base, clave: 'cero-gasto', animo: 'bien', icono: 'confetti',
      frases: [
        'Hoy no gastaste ni un peso. ¡Crack!',
        'Día de cero gastos. Así es que se construye la plata.',
        '¡Bacano! Hoy la billetera descansó.',
      ],
      consejo: 'Los días sin gastos son los que más ayudan a ahorrar. Intenta tener al menos dos por semana.' };
  }

  if (tasa !== null && tasa >= 0.3) {
    return { ...base, clave: 'ahorro-alto', animo: 'bien', icono: 'trophy',
      frases: [
        '¡Eso es, mi rey! Así es como se hace la plata.',
        '¡Bacano! Estás guardando más de lo que muchos sueñan.',
        'Erda manito, tú sí sabes manejar el billete.',
        'Así, juicioso. Tu yo del futuro te lo va a agradecer.',
      ],
      consejo: totalDebo > 0
        ? `Este mes te queda el ${pct(sobra, mes.ing)}% de lo que ganaste (${pesos(sobra)}). Aprovecha y abónale a ${debo[0].nombre}: le debes ${pesos(debo[0].falta)}.`
        : `Este mes te queda el ${pct(sobra, mes.ing)}% de lo que ganaste (${pesos(sobra)}). Aparta una parte ya en un bolsillo de ahorro antes de que se te vaya en antojos.` };
  }

  if (tasa !== null && tasa >= 0.1) {
    return { ...base, clave: 'ahorro-medio', animo: 'bien', icono: 'mood-smile',
      frases: [
        'Vas bien, manito, pero se puede apretar un poquito más.',
        'Ahí vamos, juicioso. Ni muy muy, ni tan tan.',
        'Chévere, la cosa va bien. Ahora a subir ese ahorro.',
      ],
      consejo: `Te queda el ${pct(sobra, mes.ing)}% de lo que ganaste. La regla 50/30/20 dice: 50% para necesidades, 30% para gustos y 20% para ahorrar. Te faltan ${pesos(mes.ing * 0.2 - sobra)} para llegar al 20%.` };
  }

  if (tasa !== null) {
    return { ...base, clave: 'ahorro-bajo', animo: 'ojo', icono: 'mood-empty',
      frases: [
        'Ahí, ahí… raspando la olla.',
        'Te está quedando poquito, mi llave. Pilas.',
        'Ombe, entra y sale casi igualito. Toca ajustar.',
      ],
      consejo: `Solo te queda el ${pct(Math.max(0, sobra), mes.ing)}% de lo que ganaste. Revisa los gastos pequeños (tinto, domicilios, antojos): sumados son los que más pesan.` };
  }

  return { ...base, clave: 'tranquilo', animo: 'neutro', icono: 'bulb',
    frases: [
      'Mes nuevo, plata nueva. ¡Arranquemos bien, mi llave!',
      'Todo en calma por aquí. Sigue anotando, juicioso.',
      'Bien, manito. La plata se cuida con constancia.',
    ],
    consejo: escoger(TIPS, hoy) };
}