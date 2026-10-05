import type { Metadata } from "next";
import { Suspense } from "react";
import ReservarClient from "./ReservarClient";
import LoadingRacket from "@/components/LoadingRacket";

export const metadata: Metadata = {
  title: "Reservar cancha",
  description: "Elige cancha y horario, y reserva en línea. Disponibilidad en vivo de las canchas de Sacré Pádel en Pátzcuaro.",
  alternates: { canonical: "/reservar" },
};

function ReservarFallback() {
  return (
    <div className="page page-gradient flex min-h-[60vh] items-center justify-center">
      <LoadingRacket size="lg" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ReservarFallback />}>
      <ReservarClient />
    </Suspense>
  );
}
