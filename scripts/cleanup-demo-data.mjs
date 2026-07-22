// Borra las reservas y clientes de prueba creados por seed-demo-data.mjs.
import fs from "fs";

const envContent = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
function getEnv(key) {
  const line = envContent.split("\n").find((l) => l.startsWith(key + "="));
  if (!line) return undefined;
  return line.slice(key.length + 1).trim().replace(/^"|"$/g, "");
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };

const idsPath = new URL("./demo-data-ids.json", import.meta.url);
const ids = JSON.parse(fs.readFileSync(idsPath, "utf8"));

if (ids.bookingIds?.length) {
  const filter = ids.bookingIds.map((id) => `"${id}"`).join(",");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=in.(${filter})`, { method: "DELETE", headers });
  console.log("Reservas borradas:", r.status);
}

if (ids.customerIds?.length) {
  const filter = ids.customerIds.map((id) => `"${id}"`).join(",");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=in.(${filter})`, { method: "DELETE", headers });
  console.log("Clientes borrados:", r.status);
}

fs.unlinkSync(idsPath);
console.log("Listo — datos de prueba eliminados.");
