import { Suspense } from "react";
import ReservarClient from "./ReservarClient";

function ReservarFallback() {
  return (
    <div className="page page-gradient">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="card p-4 text-white/80">Cargando…</div>
      </div>
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
