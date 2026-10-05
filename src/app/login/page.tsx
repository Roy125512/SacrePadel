import type { Metadata } from "next";
import { Suspense } from "react";
import LoginClient from "./LoginClient";
import LoadingRacket from "@/components/LoadingRacket";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false } };

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="page page-gradient flex min-h-[60vh] items-center justify-center">
          <LoadingRacket size="lg" />
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
