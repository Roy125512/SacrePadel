import { Suspense } from "react";
import ReservarClient from "./ReservarClient";
import LoadingRacket from "@/components/LoadingRacket";

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
