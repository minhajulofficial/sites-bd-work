import { Navbar } from "@/components/home/Navbar";
import { Hero } from "@/components/home/Hero";
import { DomainCheck } from "@/components/home/DomainCheck";
import { Features } from "@/components/home/Features";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Pricing } from "@/components/home/Pricing";
import { Contact } from "@/components/home/Contact";
import { Footer } from "@/components/home/Footer";
import { SmoothScroll } from "@/components/home/SmoothScroll";
import { getEnabledTlds } from "@/lib/domains/registry";

export default function HomePage() {
  const tlds = getEnabledTlds();
  return (
    <>
      <SmoothScroll />
      <Navbar />
      <Hero />
      <DomainCheck tlds={tlds} />
      <Features />
      <HowItWorks />
      <Pricing />
      <Contact />
      <Footer />
    </>
  );
}
