import Link from "next/link";

/**
 * Centered auth-page chrome shared by `/register` and
 * `/complete-profile` (and reused later by `/login`).
 *
 * Mobile-first: a single 480px column over a royal-blue gradient that
 * matches the landing-page hero. The heading + subtitle slots support
 * AOS fade-in animations via the `data-aos` attributes we already wire
 * up globally.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="primary-gradient min-h-screen flex items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-[480px]"
        data-aos="fade-up"
        data-aos-duration="700"
      >
        <Link
          href="/"
          className="block text-center text-2xl font-extrabold text-white drop-shadow"
        >
          SITES.BD
        </Link>
        <div className="mt-6 rounded-2xl bg-white shadow-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? (
          <div className="mt-4 text-center text-sm text-white/90">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
