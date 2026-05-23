import { Navbar } from "@/components/home/Navbar";
import { Hero } from "@/components/home/Hero";
import { DomainCheck } from "@/components/home/DomainCheck";
import { Features } from "@/components/home/Features";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Pricing } from "@/components/home/Pricing";
import { Contact } from "@/components/home/Contact";
import { Footer } from "@/components/home/Footer";
import { SmoothScroll } from "@/components/home/SmoothScroll";
import { getCurrentUser } from "@/lib/auth/session";
import { getEnabledTlds } from "@/lib/domains/registry";

// `<DomainCheck>` needs to know whether the visitor is signed in so it
// can pick the right branch of the PR-13 claim flow (T&C modal vs.
// guest sessionStorage handoff). Reading the auth cookie makes the
// page per-request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tlds = getEnabledTlds();
  const session = await getCurrentUser();
  const isLoggedIn = Boolean(session);
  return (
    <>
      <SmoothScroll />
      <Navbar />
      <Hero />
      <DomainCheck tlds={tlds} isLoggedIn={isLoggedIn} />
      <Features />
      <HowItWorks />
      <Pricing />
      <Contact />
      <Footer />
    </>
  );
}
