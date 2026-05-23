import dashboardContent from "@/content/contentConstants.json";

/**
 * Static FAQ accordion shown on the dashboard home. Items come from
 * `contentConstants.dashboard.faq` (an array of `{ q, a }`).
 *
 * Implemented with the native `<details>` element so the open/close
 * behavior is fully keyboard-accessible and works with JavaScript
 * disabled — no client component or external library required.
 */
export function FaqAccordion() {
  const items = dashboardContent.dashboard.faq;
  return (
    <section
      aria-label="Frequently asked questions"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-3 text-base font-semibold text-gray-900">
        Frequently asked questions
      </h2>
      <ul className="divide-y divide-gray-100">
        {items.map((item, i) => (
          <li key={i}>
            <details className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="text-lg text-gray-400 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {item.a}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
