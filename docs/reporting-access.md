# Acceso de solo lectura a los datos (reportes / Excel / contabilidad)

Este documento es para cualquier persona (contador, socio, etc.) que necesite
consultar los datos de reservas, clientes y canchas desde Excel, Google
Sheets, o un software de contabilidad — **sin** necesidad de tocar el código
ni pedir acceso al panel de Supabase.

## Qué es esto

Existe un usuario de base de datos llamado `reporting_readonly` que **solo
puede leer** tres tablas: `bookings` (reservas), `customers` (clientes) y
`courts` (canchas). No puede modificar ni borrar nada. Es seguro conectarlo a
cualquier herramienta externa.

## Datos de conexión

| Campo | Valor |
|---|---|
| Host | `db.ylmoyjhrdfwybqosdqsg.supabase.co` |
| Puerto | `5432` |
| Base de datos | `postgres` |
| Usuario | `reporting_readonly` |
| Contraseña | Pídesela al dueño del sitio (o revisa `.env.local` → `REPORTING_READONLY_PASSWORD`, solo accesible en la computadora donde vive el proyecto) |

La contraseña **no** está escrita en este documento a propósito, para que este
archivo se pueda compartir sin riesgo.

## Cómo conectar desde Excel (Windows)

1. Instala el driver **psqlODBC** (oficial, gratuito): busca "psqlODBC download"
   o entra a `postgresql.org/ftp/odbc/releases/` → carpeta más reciente (evita
   las que digan `-mimalloc`) → descarga el archivo que termine en `_x64.msi`
   (para Windows de 64 bits) → instálalo.
2. Abre **"Orígenes de datos ODBC (64 bits)"** desde el menú de inicio de
   Windows → pestaña **"DSN de sistema"** → **Agregar** → elige
   **PostgreSQL Unicode(x64)**.
3. Llena los datos de conexión de la tabla de arriba, ponle un nombre al DSN
   (por ejemplo `SacrePadel`), y dale **Test** para confirmar que conecta
   antes de guardar.
4. En Excel: **Datos → Obtener datos → Desde otros orígenes → Desde ODBC** →
   selecciona el DSN.
5. **Importante:** no uses el explorador visual de tablas — Supabase tiene
   partes internas a las que este usuario no tiene acceso, y el explorador
   truena con un error de permisos (`permission denied for schema realtime`)
   al intentar listarlas todas. En su lugar, en la misma ventana de conexión
   despliega **"Opciones avanzadas"** y escribe una consulta directa, por
   ejemplo:
   ```sql
   SELECT * FROM public.bookings
   ```
   (cambia `bookings` por `customers` o `courts` según lo que necesites — cada
   una como una conexión/consulta separada).
6. Para traer datos frescos después: clic derecho en la tabla dentro de
   Excel → **Actualizar**.

## Si algo no funciona

- **"No aparece la opción de origen ODBC"**: falta instalar el driver psqlODBC
  (paso 1).
- **Error de permisos al explorar tablas**: usa la consulta SQL directa (paso 5)
  en vez del explorador visual.
- **La contraseña no conecta**: puede haber cambiado — pídesela de nuevo al
  dueño del sitio.

## Dar acceso a más tablas

Si en el futuro se necesita ver alguna otra tabla desde aquí, hay que:
1. `GRANT SELECT ON public.<tabla> TO reporting_readonly;`
2. `CREATE POLICY reporting_readonly_select_<tabla> ON public.<tabla> FOR SELECT TO reporting_readonly USING (true);`

(la segunda parte es necesaria porque las tablas tienen Row Level Security
activado — sin una política explícita, `reporting_readonly` vería la tabla
pero cero filas en ella).
