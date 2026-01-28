import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="page page-gradient">
          <div className="mx-auto max-w-xl px-6 py-16">
            <div className="card">Cargando…</div>
          </div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
