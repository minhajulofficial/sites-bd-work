import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";

import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { DomainSearchPanel } from "@/components/domain/DomainSearchPanel";
import { getCurrentUser } from "@/lib/auth/session";
import { getEnabledTlds } from "@/lib/domains/registry";

export const metadata: Metadata = {
  title: "Check Domain Availability | SITES.BD",
  description:
    "Check availability of one or more subdomain names across every parent domain SITES.BD operates.",
  alternates: { canonical: "/check" },
};

// Reading the auth cookie via `getCurrentUser()` makes this page
// per-request; static rendering would cache the wrong claim-button
// branch (logged-in vs guest) for the next visitor.
export const dynamic = "force-dynamic";

/**
 * `/check` — dedicated multi-TLD domain availability page.
 *
 * The page itself is a server component so we can read
 * `getEnabledTlds()` once at request time; the interactive UI is
 * inside `DomainSearchPanel`. `useSearchParams` inside the panel
 * requires a `<Suspense>` boundary in the App Router; provide one here.
 */
export default async function CheckPage() {
  const tlds = getEnabledTlds();
  const session = await getCurrentUser();
  const isLoggedIn = Boolean(session);

  return (
    <>
      <Navbar />
      <main className="bg-blue-50 min-h-screen pt-24 pb-16">
        <section className="container mx-auto px-6">
          <div className="text-center mb-8">
            <h1 className="inline-flex items-center text-3xl md:text-4xl font-bold text-gray-800">
              <FontAwesomeIcon
                icon={faGlobe}
                className="mr-3 text-primary"
                aria-hidden
              />
              Check Domain Availability
            </h1>
            <p className="mt-3 text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
              Check one or many names at once across every TLD SITES.BD
              operates. Results are grouped by name so you can pick the
              perfect match.
            </p>
          </div>

          <div className="max-w-3xl mx-auto rounded-2xl bg-white shadow-sm border border-gray-100 p-5 md:p-8">
            <Suspense
              fallback={
                <div className="py-12 text-center text-gray-500">
                  Loading search…
                </div>
              }
            >
              <DomainSearchPanel
                tlds={tlds}
                syncUrl
                autoRun
                isLoggedIn={isLoggedIn}
                claimRedirect="/cart"
              />
            </Suspense>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            Need to register a new TLD instead?{" "}
            <Link
              href="/login"
              className="text-primary font-semibold hover:underline"
            >
              Sign in
            </Link>{" "}
            and head to your dashboard.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
