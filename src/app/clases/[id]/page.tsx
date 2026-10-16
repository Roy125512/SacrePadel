import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabaseServer";
import { mpPayment } from "@/lib/mercadopago";
import { finalizeMpBooking } from "@/lib/mpBookings";
import { getCoach } from "@/lib/classes";
import { DEMO } from "@/lib/demo/flag";
import ClassBooker from "./ClassBooker";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const c = UUID.test(id) ? await getCoach(id).catch(() => null) : null;
  return c ? { title: `Clases con ${c.name}` } : { title: "Clases", robots: { index: false } };
}

/** Reservar una clase con este entrenador. Recibe también el regreso de Mercado Pago. */
export default async function CoachPage({ params, searchParams }: Params) {
  const { id } = await params;
  const sp = await searchParams;
  const coach = UUID.test(id) ? await getCoach(id).catch(() => null) : null;

  if (!coach || !coach.active) {
    return (
      <div className="page">
        <div className="mx-auto max-w-xl px-6 pb-24 pt-28 sm:pt-32">
          <h1 className="font-display text-4xl">No encontramos a este entrenador.</h1>
          <Link href="/clases" className="mt-6 inline-block underline underline-offset-4">Ver clases</Link>
        </div>
      </div>
    );
  }

  let flash: string | null = null;
  const status = sp.status ?? sp.collection_status;
  const paymentId = sp.payment_id ?? sp.collection_id;
  if (status && sp.external_reference && UUID.test(sp.external_reference)) {
    if (status === "approved" && paymentId && paymentId !== "null" && !DEMO) {
      try {
        const payment = await mpPayment.get({ id: paymentId });
        const r = await finalizeMpBooking(sp.external_reference, payment);
        flash = r.ok ? "¡Listo! Tu clase quedó reservada y pagada. Te mandamos la confirmación por correo." : "Tu pago se registró; si no ves tu clase en Mis reservas, escríbenos.";
      } catch {
        flash = "Tu pago fue aprobado; en unos momentos verás tu clase en Mis reservas.";
      }
    } else if (status !== "approved") flash = "El pago no se completó. Puedes intentar de nuevo.";
  }

  let loggedIn = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    loggedIn = !!data?.user;
  } catch {}

  const byDay = new Map<number, string[]>();
  for (const w of coach.weekly_hours) byDay.set(w.dow, [...(byDay.get(w.dow) ?? []), `${w.start}–${w.end}`]);
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="page">
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-28 sm:pt-32">
        <Link href="/clases" className="text-sm text-[var(--muted)] underline underline-offset-4">
          ← Clases
        </Link>
        <p className="mt-6 text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">Entrenador</p>
        <h1 className="font-display mt-4 text-5xl leading-[1.02] sm:text-6xl">{coach.name}</h1>
        {coach.bio && <p className="mt-5 max-w-xl whitespace-pre-line leading-relaxed text-[var(--muted)]">{coach.bio}</p>}
        <p className="mt-5 text-sm">
          Individual <b>${coach.rate_individual}</b>/h
          {coach.rate_pair ? (
            <>
              {" "}
              · En pareja <b>${coach.rate_pair}</b>/h (los dos)
            </>
          ) : null}
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {order
            .filter((d) => byDay.has(d))
            .map((d) => `${DAY_NAMES[d]} ${byDay.get(d)!.join(", ")}`)
            .join(" · ")}
        </p>

        {flash && <p role="status" className="mt-6 border-l-2 border-[var(--brand)] pl-3 text-sm font-medium">{flash}</p>}

        <ClassBooker
          coachId={coach.id}
          rateIndividual={coach.rate_individual}
          ratePair={coach.rate_pair}
          workDays={[...byDay.keys()]}
          loggedIn={loggedIn}
        />
      </div>
    </div>
  );
}
