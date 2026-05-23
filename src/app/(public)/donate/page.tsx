import Link from "next/link";
import type { Metadata } from "next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart } from "@fortawesome/free-solid-svg-icons";

export const metadata: Metadata = {
  title: "Support SITES.BD",
  description:
    "Help keep SITES.BD's free subdomains and dashboard running. A full donation experience is coming soon.",
};

/**
 * `/donate` — placeholder page reached from the dashboard's bottom
 * CTA. Ships in PR-09 so the link target exists; an admin will
 * replace the content (or redirect) once a donation flow is in
 * place.
 */
export default function DonatePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <span
        aria-hidden="true"
        className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <FontAwesomeIcon icon={faHeart} className="h-6 w-6" />
      </span>
      <h1 className="text-3xl font-bold text-gray-900">
        Support SITES.BD
      </h1>
      <p className="mt-3 max-w-md text-base text-gray-600">
        Donations help us keep free subdomains and dashboard hosting
        running for the Bangladeshi developer community. A full
        donation page is coming soon.
      </p>
      <Link
        href="/dash"
        className="mt-8 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
