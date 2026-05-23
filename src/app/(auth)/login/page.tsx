import { Suspense } from "react";

import { LoginPageClient } from "./LoginPageClient";

export const dynamic = "force-dynamic";

/**
 * `/login` is rendered as a server component shell so we can read the
 * `?error=...` query param synchronously and pass it into the client
 * component below. The middleware already redirects signed-in +
 * verified users to `/dash`, so anyone who lands here is by definition
 * not signed in (or not yet verified).
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageClient />
    </Suspense>
  );
}
