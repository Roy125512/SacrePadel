// Datos de prueba para visualizar Recepción (Reservas + Dashboard) con
// contenido real. NO se auto-limpian — bórralos a mano cuando el usuario
// lo pida, con scripts/cleanup-demo-data.mjs (usa el mismo archivo de IDs).
import fs from "fs";

const envContent = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
function getEnv(key) {
  const line = envContent.split("\n").find((l) => l.startsWith(key + "="));
  if (!line) return undefined;
  return line.slice(key.length + 1).trim().replace(/^"|"$/g, "");
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function rest(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const courts = await rest("courts?select=id,name&order=name");

const testCustomers = [
  { full_name: "TEST Ana Martínez", phone_e164: "+5215550002001" },
  { full_name: "TEST Luis Hernández", phone_e164: "+5215550002002" },
  { full_name: "TEST Carla Ramírez", phone_e164: "+5215550002003" },
  { full_name: "TEST Jorge Pérez", phone_e164: "+5215550002004" },
  { full_name: "TEST Sofía Torres", phone_e164: "+5215550002005" },
];

const customers = [];
for (const c of testCustomers) {
  const created = await rest("customers", { method: "POST", body: JSON.stringify(c) });
  customers.push(created[0]);
}
console.log("Clientes de prueba creados:", customers.length);

function ymdDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const hours = [7, 8, 9, 10, 11, 13, 14, 16, 17, 18, 19, 20];
const methods = ["CASH", "CARD", "TRANSFER"];
const rateDay = 350;
const rateNight = 400; // SWITCH_HOUR = 18

function amountFor(hour, durH) {
  return (hour >= 18 ? rateNight : rateDay) * durH;
}

const bookings = [];
let seed = 0;

// Últimos 30 días, densidad variable para que se vea orgánico
for (let dayAgo = 0; dayAgo < 30; dayAgo++) {
  const bookingsToday = dayAgo === 0 ? 6 : dayAgo % 7 === 0 ? 1 : dayAgo % 3 === 0 ? 5 : 3;
  const usedHoursToday = new Set();

  for (let i = 0; i < bookingsToday; i++) {
    seed++;
    const court = courts[seed % courts.length];
    let hour = hours[seed % hours.length];
    // evita duplicar exactamente el mismo hour+court el mismo día (no es
    // crítico por el constraint de overlap, pero se ve mejor repartido)
    let attempts = 0;
    while (usedHoursToday.has(`${court.id}-${hour}`) && attempts < 5) {
      hour = hours[(seed + attempts) % hours.length];
      attempts++;
    }
    usedHoursToday.add(`${court.id}-${hour}`);

    const dur = seed % 5 === 0 ? 2 : 1;
    const ymd = ymdDaysAgo(dayAgo);
    const startAt = `${ymd}T${String(hour).padStart(2, "0")}:00:00-06:00`;
    const endHour = hour + dur;
    const endAt = `${ymd}T${String(endHour).padStart(2, "0")}:00:00-06:00`;

    const roll = seed % 10;
    let status = "COMPLETED";
    let payment_status = "PAID";
    if (roll === 8) {
      status = "CANCELLED";
      payment_status = "UNPAID";
    } else if (roll === 9) {
      status = "NO_SHOW";
      payment_status = "PAID";
    } else if (dayAgo === 0) {
      status = "CONFIRMED";
      payment_status = roll % 2 === 0 ? "PAID" : "UNPAID";
    }

    const amount = amountFor(hour, dur);
    const customer = customers[seed % customers.length];

    bookings.push({
      court_id: court.id,
      start_at: startAt,
      end_at: endAt,
      status,
      source: "WEB",
      kind: "STANDARD",
      payment_status,
      paid_amount: payment_status === "PAID" ? amount : null,
      payment_method: payment_status === "PAID" ? methods[seed % methods.length] : null,
      paid_at: payment_status === "PAID" ? startAt : null,
      customer_id: customer.id,
    });
  }
}

console.log("Insertando", bookings.length, "reservas de prueba...");

const CHUNK = 20;
const insertedIds = [];
for (let i = 0; i < bookings.length; i += CHUNK) {
  const chunk = bookings.slice(i, i + CHUNK);
  const created = await rest("bookings", { method: "POST", body: JSON.stringify(chunk) });
  insertedIds.push(...created.map((b) => b.id));
}

console.log("Reservas creadas:", insertedIds.length);

fs.writeFileSync(
  new URL("./demo-data-ids.json", import.meta.url),
  JSON.stringify({ customerIds: customers.map((c) => c.id), bookingIds: insertedIds }, null, 2)
);
console.log("IDs guardados en scripts/demo-data-ids.json (para poder borrarlos después).");
