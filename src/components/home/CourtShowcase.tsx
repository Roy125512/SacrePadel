"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useNearViewport } from "@/hooks/useNearViewport";

const CourtScene = dynamic(() => import("@/components/three/CourtScene"), { ssr: false });

const STEPS = [
  { title: "Cristal panorámico", body: "Cristal templado sin postes intermedios: ves toda la jugada y el rebote es limpio." },
  { title: "Luz de torneo", body: "Reflectores LED de alta potencia, sin sombras ni deslumbramiento por la noche." },
  { title: "Césped profesional", body: "Sintético de última generación para moverte rápido y seguro." },
  { title: "Ambiente reservado", body: "Cuatro canchas en un lugar tranquilo, frente a los cerros de Pátzcuaro." },
];

/**
 * "El club": la cancha en 3D se queda fija en pantalla mientras haces scroll;
 * la cámara la recorre y las características cambian en cada tramo.
 */
export default function CourtShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const near = useNearViewport(sectionRef);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = sectionRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
        // la cámara se detiene en p = 0 (aérea), .25, .5, .75 y 1; cada texto
        // acompaña a su toma y cambia a medio camino entre una y otra
        setStep(Math.min(STEPS.length - 1, Math.max(0, Math.round(p * STEPS.length) - 1)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="el-club" ref={sectionRef} className="relative h-[340vh] scroll-mt-16" style={{ background: "var(--dark)", color: "var(--dark-foreground)" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {failed ? (
          <Image src="/images/gallery-two-courts-mountain.jpg" alt="" fill sizes="100vw" className="object-cover opacity-50" />
        ) : (
          <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: ready ? 1 : 0 }}>
            {near && <CourtScene onReady={() => setReady(true)} onFail={() => setFailed(true)} />}
          </div>
        )}

        {/* velo para que el texto se lea sobre la escena */}
        <div className="pointer-events-none absolute inset-0 hidden md:block" style={{ background: "linear-gradient(90deg, rgba(14,13,11,.88) 0%, rgba(14,13,11,.35) 45%, transparent 70%)" }} />
        {/* en celular el texto va arriba y abajo: el velo también */}
        <div className="pointer-events-none absolute inset-0 md:hidden" style={{ background: "linear-gradient(180deg, rgba(14,13,11,.9) 0%, transparent 32%, transparent 52%, rgba(14,13,11,.94) 80%)" }} />

        <div className="relative z-10 flex h-full flex-col justify-between px-6 py-24 sm:px-10 lg:px-14">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.3em] text-[var(--brand-highlight)]">El club</p>
            <h2 className="font-display mt-5 max-w-[14ch] text-[clamp(2.4rem,4.4vw,4.2rem)] leading-[1.02]">Una cancha pensada al detalle.</h2>
          </div>

          <div className="max-w-sm">
            <div className="relative min-h-[9.5rem]">
              {STEPS.map((s, i) => (
                <div
                  key={s.title}
                  className="absolute inset-x-0 top-0 transition-all duration-700"
                  style={{ opacity: step === i ? 1 : 0, transform: `translateY(${step === i ? 0 : step > i ? -16 : 16}px)` }}
                  aria-hidden={step !== i}
                >
                  <div className="font-display text-sm italic text-[var(--brand-highlight)]">{["I", "II", "III", "IV"][i]}</div>
                  <h3 className="mt-2 text-[0.75rem] font-semibold uppercase tracking-[0.22em]">{s.title}</h3>
                  <p className="mt-3 leading-relaxed text-[rgba(241,236,227,.72)]">{s.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex gap-2" aria-hidden>
              {STEPS.map((s, i) => (
                <span key={s.title} className="h-px flex-1 transition-colors duration-500" style={{ background: i <= step ? "var(--brand-highlight)" : "rgba(241,236,227,.18)" }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
