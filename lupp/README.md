# LUPP

Tu dinero y tu tiempo en un solo lugar: finanzas **Personal** y **Empresa**, agenda con rutinas, pendientes, diario y avisos.

App web instalable (PWA): se instala en el celular desde Chrome, sin Play Store.

---

## Qué hay en cada archivo

```
lupp/
├── index.html            Página principal
├── config.js             ← Aquí pegas tus claves de Supabase
├── manifest.webmanifest  Nombre, colores e ícono para instalarla
├── sw.js                 Hace que funcione sin internet
├── css/styles.css        Colores y diseño (modo oscuro y claro)
├── js/app.js             Toda la lógica y las pantallas
├── js/db.js              Guardado (nube o local)
├── js/utils.js           Fechas, pesos colombianos, repeticiones
├── js/datos-base.js      Cuentas y categorías iniciales (Nequi, Bancolombia…)
├── icons/                Íconos de la app
└── supabase/schema.sql   Tablas de la base de datos
```

---

## Paso 1 · Probarla en tu computador (5 minutos)

1. Abre la carpeta `lupp` en **Visual Studio Code** (Archivo → Abrir carpeta).
2. Instala la extensión **Live Server** (de Ritwick Dey).
3. Clic derecho en `index.html` → **Open with Live Server**.
4. Se abre en el navegador. Con `F12` → ícono de celular ves cómo queda en pantalla de teléfono.

> Sin configurar nada, LUPP funciona en **modo local**: guarda todo en ese navegador. Sirve para probar.

---

## Paso 2 · Base de datos en la nube (Supabase, gratis)

1. Entra a <https://supabase.com> y crea una cuenta.
2. **New project** → nombre `lupp`, crea una contraseña para la base de datos y elige la región **East US** o **South America (São Paulo)**.
3. Cuando termine de crearse, ve a **SQL Editor** → **New query**.
4. Abre `supabase/schema.sql`, copia **todo**, pégalo y presiona **Run**. Debe decir *Success*.
5. Ve a **Project Settings → API** (o **Data API**) y copia:
   - **Project URL**
   - **anon public** key
6. Pégalos en `config.js`:
   ```js
   export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```
7. *(Opcional, recomendado para uso personal)* En **Authentication → Sign In / Providers → Email**, desactiva **Confirm email** para no tener que confirmar el correo.
8. Recarga LUPP: ahora te pide **crear cuenta**. Créala con tu correo y una contraseña, y listo.

La "anon key" es pública por diseño. Tus datos están protegidos con reglas de seguridad (RLS): solo tu usuario puede ver y cambiar tus datos.

---

## Paso 3 · Publicarla en internet (gratis)

Para instalarla en el celular necesita estar en una dirección `https`. La forma más fácil:

1. Entra a <https://app.netlify.com/drop> (crea una cuenta gratis).
2. **Arrastra la carpeta `lupp`** completa a la página.
3. Te da una dirección tipo `https://algo-raro.netlify.app`. En *Site configuration* puedes cambiarla, por ejemplo a `https://lupp-tuyo.netlify.app`.

Para actualizarla después: en Netlify → tu sitio → **Deploys** → arrastra la carpeta otra vez.

---

## Paso 4 · Instalarla en tu Honor Magic

1. Abre **Chrome** en el celular y entra a tu dirección de Netlify.
2. Toca **⋮** (arriba a la derecha) → **Instalar aplicación** (o *Agregar a pantalla principal*).
3. Aparece el ícono **LUPP** en tu pantalla, como cualquier app.
4. Abre LUPP → **Ajustes** → **Activar notificaciones** → Permitir.

**Importante en celulares Honor** (ahorran mucha batería y pueden cortar los avisos):
- Ajustes del celular → **Batería** → **Inicio de aplicaciones** → busca **Chrome** → desactiva *Gestionar automáticamente* y activa las 3 opciones.
- Ajustes → **Notificaciones** → **Chrome** → todo permitido.

---

## Cómo se usa

| Pantalla | Qué haces |
|---|---|
| **Hoy** | Qué te toca ahora, qué sigue, cuánto ganaste y gastaste este mes, cuánto llevas, pendientes |
| **Finanzas** | Resumen por mes, saldo de cada cuenta, en qué se fue la plata, todos tus movimientos |
| **Agenda** | Semana, actividades del día, pendientes y diario |
| **Ajustes** | Modo oscuro/claro, notificaciones, cuentas, categorías, exportar a Excel |
| **Botón +** | Agregar gasto, ingreso, transferencia, actividad, pendiente o diario |

- **Personal / Empresa:** el selector de arriba cambia de espacio. Cada uno tiene sus propias cuentas y categorías.
- **Rutinas:** al crear una actividad eliges *Solo este día*, *Todos los días*, *Los días que yo elija* o *Cada mes*. Al editarla o borrarla te pregunta si es *solo este día*, *este y los siguientes* o *todas*.
- **Pagos en la agenda:** en una actividad abre *¿Es un pago?* y pon el monto. En la agenda aparece **Marcar pagado**, que registra el gasto automáticamente.
- **Pendientes** que no hiciste pasan solos al día siguiente (salen como *Atrasada*).
- **Tarjeta de crédito:** en la cuenta marca *Es una deuda* para que el saldo inicial sea negativo.

---

## Cuando cambies el código

En `sw.js` sube la versión (`'lupp-v1'` → `'lupp-v2'`) y vuelve a publicar. Así el celular descarga la versión nueva (a veces hay que cerrar y abrir la app dos veces).

---

## Límites de esta versión (v1)

- **Avisos:** suenan mientras LUPP esté abierta o en segundo plano reciente. Si cierras la app por completo, Android puede no avisarte. Para avisos con la app cerrada hace falta un servidor de notificaciones (*push*). Es el siguiente paso planeado (v2), usando Supabase.
- **Sin internet:** la app abre y muestra lo último cargado, pero para guardar cambios en modo nube necesita conexión.

## Ideas para la v2

- Avisos *push* con la app cerrada y botón **Posponer 10 min**
- Presupuestos por categoría con alerta
- Metas de ahorro (por ejemplo, *Ahorro para mi empresa*)
- Pasar plata de Empresa a Personal (tu sueldo)
- IVA, retenciones y fechas DIAN para la empresa
