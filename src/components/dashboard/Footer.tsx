import Link from "next/link";

import dashboardContent from "@/content/contentConstants.json";

/**
 * Condensed footer for the dashboard shell. Visually echoes the
 * marketing-site footer (royal blue background, white type) but
 * strips the four-column link grid down to a single inline row to
 * keep vertical space free for actual dashboard content.
 *
 * Links are placeholders (`#`) for now — the marketing footer uses
 * the same hrefs and these will all be wired up once the public
 * Support / Terms / Privacy / Status pages exist.
 */
export function Footer() {
  const year = new Date().getFullYear();
  const copyright = dashboardContent.dashboard.footer.copyrightTemplate.replace(
    "{{year}}",
    String(year),
  );
  const links = dashboardContent.dashboard.footer.links;
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-gray-500 sm:flex-row sm:px-6 lg:px-8">
        <p className="order-2 text-center sm:order-1 sm:text-left">{copyright}</p>
        <ul className="order-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:order-2">
          <FooterLink href="#" label={links.support} />
          <FooterLink href="#" label={links.termsOfService} />
          <FooterLink href="#" label={links.privacyPolicy} />
          <FooterLink href="#" label={links.status} />
        </ul>
      </div>
    </footer>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="rounded text-gray-500 transition hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {label}
      </Link>
    </li>
  );
}
