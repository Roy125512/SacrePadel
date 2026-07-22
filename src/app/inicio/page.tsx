import Hero from "@/components/home/Hero";
import SectionNav from "@/components/home/SectionNav";
import ValueProps from "@/components/home/ValueProps";
import HowItWorks from "@/components/home/HowItWorks";
import PhotoGallery from "@/components/home/PhotoGallery";
import PricingTeaser from "@/components/home/PricingTeaser";
import Offerings from "@/components/home/Offerings";
import FAQ from "@/components/home/FAQ";
import CommunitySection from "@/components/home/CommunitySection";

export default function InicioPage() {
  return (
    <main className="page">
      <Hero />
      <SectionNav />
      <ValueProps />
      <HowItWorks />
      <PhotoGallery />
      <PricingTeaser />
      <Offerings />
      <FAQ />
      <CommunitySection />
    </main>
  );
}
