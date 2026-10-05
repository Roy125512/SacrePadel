import type { Metadata } from "next";
import Hero from "@/components/home/Hero";
import LocalBusinessJsonLd from "@/components/LocalBusinessJsonLd";
import SectionNav from "@/components/home/SectionNav";
import ValueProps from "@/components/home/ValueProps";
import HowItWorks from "@/components/home/HowItWorks";
import PhotoGallery from "@/components/home/PhotoGallery";
import PricingTeaser from "@/components/home/PricingTeaser";
import Offerings from "@/components/home/Offerings";
import FAQ from "@/components/home/FAQ";
import LocationSection from "@/components/home/LocationSection";
import CommunitySection from "@/components/home/CommunitySection";

export const metadata: Metadata = {
  title: { absolute: "Sacré Pádel | Canchas de pádel en Pátzcuaro" },
  alternates: { canonical: "/inicio" },
};

export default function InicioPage() {
  return (
    <main className="page">
      <LocalBusinessJsonLd />
      <Hero />
      <SectionNav />
      <ValueProps />
      <HowItWorks />
      <PhotoGallery />
      <PricingTeaser />
      <FAQ />
      <LocationSection />
      <Offerings />
      <CommunitySection />
    </main>
  );
}
