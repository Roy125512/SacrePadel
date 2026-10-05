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

export const metadata: Metadata = {
  title: { absolute: "Sacré Pádel | Canchas de pádel en Pátzcuaro" },
  alternates: { canonical: "/inicio" },
};

export default function InicioPage() {
  return (
    <main className="page">
      <LocalBusinessJsonLd />
      <SmoothScroll />
      <Cursor />
      <Hero />
      <SectionNav />
      <HowItWorks />
      <Marquee dark items={["Pátzcuaro", "Cristal panorámico", "Luz de torneo", "07:00 — 22:00"]} />
      <CourtShowcase />
      <PricingTeaser />
      <FAQ />
      <PhotoGallery />
      <LocationSection />
      <Offerings />
      <CommunitySection />
      <FinalCta />
    </main>
  );
}
