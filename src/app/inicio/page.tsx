import type { Metadata } from "next";
import Hero from "@/components/home/Hero";
import LocalBusinessJsonLd from "@/components/LocalBusinessJsonLd";
import SectionNav from "@/components/home/SectionNav";
import CourtShowcase from "@/components/home/CourtShowcase";
import HowItWorks from "@/components/home/HowItWorks";
import PhotoGallery from "@/components/home/PhotoGallery";
import PricingTeaser from "@/components/home/PricingTeaser";
import Offerings from "@/components/home/Offerings";
import FAQ from "@/components/home/FAQ";
import LocationSection from "@/components/home/LocationSection";
import CommunitySection from "@/components/home/CommunitySection";
import FinalCta from "@/components/home/FinalCta";
import SmoothScroll from "@/components/motion/SmoothScroll";
import Cursor from "@/components/motion/Cursor";
import Marquee from "@/components/motion/Marquee";
import { loadPricing } from "@/lib/pricingSettings";
import { DAY_RATE } from "@/lib/pricing-shared";

export const metadata: Metadata = {
  title: { absolute: "Sacré Pádel | Canchas de pádel en Pátzcuaro" },
  alternates: { canonical: "/inicio" },
};

// Las tarifas (horas valle) las ajusta el dueño; se regenera al guardarlas
// (revalidatePath en /api/reception/pricing) y, por si acaso, cada 10 min.
export const revalidate = 600;

export default async function InicioPage() {
  const offPeak = await loadPricing({ fresh: true });
  const fromPrice = offPeak.enabled ? Math.min(offPeak.rate, DAY_RATE) : DAY_RATE;
  return (
    <main className="page">
      <LocalBusinessJsonLd />
      <SmoothScroll />
      <Cursor />
      <Hero fromPrice={fromPrice} />
      <SectionNav />
      <HowItWorks />
      <Marquee dark items={["Pátzcuaro", "Cristal panorámico", "Luz de torneo", "07:00 — 22:00"]} />
      <CourtShowcase />
      <PricingTeaser offPeak={offPeak} />
      <FAQ />
      <PhotoGallery />
      <LocationSection />
      <Offerings />
      <CommunitySection />
      <FinalCta />
    </main>
  );
}
