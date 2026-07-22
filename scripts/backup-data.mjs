// Respaldo manual de los datos (no del esquema — eso ya vive versionado en
// migrations/*.sql). Exporta cada tabla a un archivo JSON con fecha, usando
// la llave de servicio (lee todo, sin restricciones de RLS).
//
// Uso:  node scripts/backup-data.mjs
import fs from "fs";
import path from "path";

const envContent = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
function getEnv(key) {
  const line = envContent.split("\n").find((l) => l.startsWith(key + "="));
  if (!line) return undefined;
  return line.slice(key.length + 1).trim().replace(/^"|"$/g, "");
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };

const TABLES = ["courts", "customers", "profiles", "bookings", "booking_events"];

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(process.cwd(), "backups", timestamp);
fs.mkdirSync(outDir, { recursive: true });

console.log(`Respaldando a ${outDir}\n`);

for (const table of TABLES) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers });
  if (!res.ok) {
    console.error(`${table}: ERROR ${res.status} — ${await res.text()}`);
    continue;
  }
  const data = await res.json();
  fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(data, null, 2));
  console.log(`${table}: ${data.length} filas guardadas`);
}

console.log(`\nListo. Guarda esta carpeta fuera de tu computadora de vez en cuando (USB, Drive, etc.) — contiene datos de clientes reales, no la subas a ningún repositorio público.`);
