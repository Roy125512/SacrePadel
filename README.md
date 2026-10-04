# Sacré Pádel

Sitio de reservas de canchas de pádel del club Sacré Pádel (Pátzcuaro, Michoacán): página pública, reservas en línea con pago por Mercado Pago o en recepción, y un panel de recepción con cobros y reportes.

**Producción:** https://sacrepadel.com (Vercel, proyecto `sacre-padel-li2o`)

## Stack

- **Next.js 16** (App Router) + React 19 + Tailwind 4
- **Supabase**: Postgres, autenticación y seguridad por filas (RLS)
- **Mercado Pago** Checkout Pro para pagos en línea
- **Nodemailer** (SMTP de Gmail) para correos de confirmación y alertas
- **Vitest** para pruebas

## Arrancar en una computadora nueva

```bash
git clone https://github.com/Roy125512/SacrePadel.git
cd SacrePadel
./scripts/setup-mac.sh   # instala dependencias y te pide las claves de .env.local
npm run dev              # http://localhost:3000
```

### Variables de entorno (`.env.local`)

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión pública a Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave de administrador (solo servidor; nunca exponerla) |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Pagos en línea y verificación del webhook |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envío de correos |
| `NOTIFY_EMAIL` | Correo del dueño: avisos de reservas nuevas y alertas (pagos sin reserva, montos que no cuadran) |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio |
| `NEXT_PUBLIC_DEMO_MODE` | `true` = usa una base de datos falsa en memoria (para probar sin tocar datos reales) |

Las mismas variables deben estar en Vercel (Settings → Environment Variables).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Corre las pruebas (precios, horarios, clientes, pagos…) |
| `npm run lint` | Revisa el código |
| `npm run build` | Compila para producción |

Para probar sin datos reales: `NEXT_PUBLIC_DEMO_MODE=true npm run dev`. Cuentas demo: `recepcion@demo.com` (dueño) y `cliente@demo.com`, con cualquier contraseña de 8+ caracteres.

## Base de datos

Las migraciones están en `migrations/` y se aplican **en orden**, a mano, en el SQL Editor de Supabase. Al agregar una nueva, aplícala en Supabase **antes** de subir el código que la usa.

| Migración | Contenido |
|---|---|
| `000`–`007` | Esquema base, Mercado Pago, rol de solo lectura para reportes, orígenes de reservas de recepción |
| `008` | Dueño de cada cliente (`customers.user_id`) y correo de contacto por reserva |
| `009` | Límite de solicitudes compartido (`rate_limits`) |

Acceso de solo lectura para Excel/contabilidad: ver `docs/reporting-access.md`.

## Cómo funciona (lo importante)

- **Hora del club.** Todas las fechas, horas y tarifas se calculan en hora de Pátzcuaro (`America/Mexico_City`, ver `src/lib/businessTime.ts`), sin importar la zona de la computadora o del servidor.
- **Tarifas.** $350/h de 7:00 a 18:00 y $400/h de 18:00 a 22:00, prorrateado por minuto (`src/lib/pricing-shared.ts`). El precio siempre se calcula en el servidor.
- **Reservas web.** Al elegir horario se crea un apartado (`HOLD`) de 10 min. "Pagar en recepción" lo confirma sin pago (tope de 2 reservas sin pagar por cliente). "Pagar en línea" crea un link de Mercado Pago que vence junto con el apartado (20 min).
- **Pagos en línea** (`src/lib/mpBookings.ts`). El webhook de Mercado Pago y el regreso del navegador confirman la reserva de forma idempotente. Se registra lo que Mercado Pago realmente cobró, y ningún apartado se borra sin antes preguntarle a Mercado Pago si se pagó.
- **Clientes** (`src/lib/customers.ts`). El teléfono no se verifica, así que un cliente encontrado solo por teléfono nunca se sobrescribe: únicamente se llenan sus campos vacíos. Solo la cuenta dueña del registro puede cambiar sus datos.
- **Recepción** (`/reception`). Rol `owner`: todo, incluido el dashboard. Rol `reception`: solo reservas de un día a la vez. Los roles se asignan en Supabase, en la tabla `profiles`.
