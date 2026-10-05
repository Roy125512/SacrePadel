"use client";

import { ArrowRight } from "lucide-react";
import { DAY_RATE, EVENING_RATE, SWITCH_HOUR, PADDLE_RENTAL_PRICE } from "@/lib/pricing-shared";
import ReservarButton from "@/components/ReservarButton";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function fmtHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export default function PricingTeaser() {
  const revealRef = useScrollReveal<HTMLDivElement>();
  const rows = [
    { label: "Día", hours: `${fmtHour(7)} — ${fmtHour(SWITCH_HOUR)}`, price: DAY_RATE },
    { label: "Noche", hours: `${fmtHour(SWITCH_HOUR)} — ${fmtHour(22)}`, price: EVENING_RATE },
  ];

  return (
    <section id="tarifas" className="scroll-mt-16 py-28 sm:py-36" style={{ background: "var(--surface)" }}>
      <div ref={revealRef} className="mx-auto grid max-w-7xl gap-16 px-6 sm:px-10 lg:grid-cols-[1fr_1.4fr] lg:gap-24 lg:px-14">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">Tarifas</p>
          <h2 className="font-display mt-6 text-[clamp(2.4rem,4.4vw,4.2rem)] leading-[1.02]">Por hora, sin membresías.</h2>
          <p className="mt-6 max-w-sm leading-relaxed text-[var(--muted)]">
            Se cobra por tiempo jugado. Si tu reserva cruza las {fmtHour(SWITCH_HOUR)}, cada parte se cobra con su tarifa.
          </p>
        </div>

        <div className="flex flex-col justify-center">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-6 border-t py-8" style={{ borderColor: "var(--line)" }}>
              <div>
                <div className="font-display text-3xl">{r.label}</div>
                <div className="mt-2 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">{r.hours}</div>
              </div>
              <div className="text-right">
                <span className="font-display text-[clamp(2.8rem,5vw,4.4rem)] leading-none">${r.price}</span>
                <span className="ml-2 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--muted)]">MXN / hora</span>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-6 border-t pt-8" style={{ borderColor: "var(--line)" }}>
            <p className="text-[var(--muted)]">Renta de pala: ${PADDLE_RENTAL_PRICE}. Palas y pelotas a la venta en recepción.</p>
            <ReservarButton className="btn-primary">
              Reservar
              <ArrowRight className="h-4 w-4" />
            </ReservarButton>
          </div>
        </div>
      </div>
    </section>
  );
}
