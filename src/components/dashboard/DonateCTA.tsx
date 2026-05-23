import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart } from "@fortawesome/free-solid-svg-icons";

/**
 * Bottom CTA on the dashboard home. Plain link to `/donate`, which
 * ships as a placeholder page in this PR; an admin can replace the
 * destination later without touching the dashboard.
 */
export function DonateCTA() {
  return (
    <section
      aria-label="Support SITES.BD"
      className="flex justify-center"
    >
      <Link
        href="/donate"
        className="inline-flex items-center gap-3 rounded-full bg-primary-gradient px-6 py-3 text-base font-semibold text-white shadow-md transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <FontAwesomeIcon icon={faHeart} className="h-4 w-4" aria-hidden="true" />
        Donate / Support Our Project
      </Link>
    </section>
  );
}
