"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useNearViewport } from "@/hooks/useNearViewport";
import { ArrowRight } from "lucide-react";
import ReservarButton from "@/components/ReservarButton";
import TodayAvailability from "@/components/brand/TodayAvailability";
import ContourLines from "@/components/three/ContourLines";

const BallScene = dynamic(() => import("@/components/three/BallScene"), { ssr: false });

/** Cierre de la portada: la pelota 3D cae, bota y te invita a reservar. */
export default function FinalCta() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const near = useNearViewport(sectionRef);

  return (
    <section ref={sectionRef} className="relative isolate overflow-hidden" style={{ background: "var(--dark)", color: "var(--dark-foreground)" }}>
      <ContourLines color="rgba(201,162,126,0.1)" />
      <div className="relative mx-auto grid min-h-[100svh] max-w-7xl grid-cols-1 items-center gap-4 px-6 py-20 sm:px-10 lg:grid-cols-[1fr_1.1fr] lg:py-0">
        <div className="order-last lg:order-first">
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-[var(--brand-highlight)]">Tu turno</p>
          <h2 className="font-display mt-5 max-w-[12ch] text-[clamp(2.8rem,6vw,5.6rem)] leading-[0.98]">
            Te esperamos en la <em className="text-[var(--brand-highlight)]">cancha</em>.
          </h2>
          <p className="mt-6 max-w-sm leading-relaxed text-[rgba(241,236,227,.72)]">
            Elige día y hora, paga en línea y llega a jugar. Así de simple.
          </p>
          <div className="mt-9">
            <ReservarButton className="btn-primary !bg-[var(--dark-foreground)] !text-[var(--dark)] hover:!bg-[var(--brand-highlight)]">
              Reservar cancha
              <ArrowRight className="h-4 w-4" />
            </ReservarButton>
          </div>
          <div className="mt-10">
            <TodayAvailability dark />
          </div>
        </div>

        <div className="relative h-[46svh] lg:h-[86svh]">
          {failed ? (
            <Image src="/images/gallery-court-night.jpg" alt="" fill sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover opacity-60" />
          ) : (
            <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: ready ? 1 : 0 }}>
              {near && <BallScene onReady={() => setReady(true)} onFail={() => setFailed(true)} />}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
