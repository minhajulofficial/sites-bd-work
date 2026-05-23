/**
 * `/dash` — authenticated home page. PR-08 only ships the shell, so
 * this is intentionally a placeholder card; PR-09 will fill in the
 * actual widgets (active services, recent invoices, etc.).
 */
export const dynamic = "force-dynamic";

export default function DashPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard home — PR-09
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          The shell (header, sidebar, footer) is in place. Real
          widgets ship in PR-09.
        </p>
      </div>
    </div>
  );
}
