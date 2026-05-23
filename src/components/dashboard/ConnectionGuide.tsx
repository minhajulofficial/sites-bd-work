import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";

import dashboardContent from "@/content/contentConstants.json";

/**
 * Sidebar block on the dashboard home explaining how to point an
 * external domain at the platform. Text is sourced from
 * `contentConstants.dashboard.connectionGuide` so an operator can
 * tweak the wording without touching the component.
 */
export function ConnectionGuide() {
  const guide = dashboardContent.dashboard.connectionGuide;
  return (
    <section
      aria-label={guide.title}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <header className="mb-3">
        <h2 className="text-base font-semibold text-gray-900">{guide.title}</h2>
        <p className="mt-1 text-sm text-gray-600">{guide.intro}</p>
      </header>
      <ol className="space-y-3">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
            >
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900">{step.title}</p>
              <p className="text-sm text-gray-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
        <FontAwesomeIcon icon={faCircleCheck} className="mr-1 h-3 w-3" />
        {guide.tip}
      </div>
      <Link
        href={guide.cta.href}
        className="mt-4 inline-flex items-center text-sm font-semibold text-primary hover:text-primary-deep"
      >
        {guide.cta.label}
        <span aria-hidden="true" className="ml-1">
          →
        </span>
      </Link>
    </section>
  );
}
