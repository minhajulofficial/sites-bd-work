import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client tied to the caller's auth cookie. Use this
 * from React Server Components, server actions, and route handlers that
 * should run **as the signed-in user** and respect Row Level Security.
 *
 * The matching auth refresh hop runs in `middleware.ts` so the user's
 * access token is always fresh by the time it reaches a handler.
 *
 * Note: the public schema generic is intentionally NOT applied here —
 * piping `Database` through `@supabase/ssr`'s `createServerClient`
 * conflicts with `@supabase/supabase-js`'s internal `SchemaName`
 * generic. Callers narrow at the call site via `@/types/supabase` when
 * they need typed rows.
 */
export function createServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "[supabase/server] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required",
    );
  }
  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // React Server Components cannot set cookies. The middleware
          // hop is responsible for refresh; ignore the write here.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // ignored — see comment above
        }
      },
    },
  });
}

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * **Server-only.** Never import this from a client component, never log
 * the key, never return data fetched via this client through an API
 * without re-checking auth + ownership manually.
 *
 * Typical callers:
 *   - OTP issuance/verification (the `otp_codes` table is intentionally
 *     not user-readable).
 *   - Admin background actions (cron, system audit writes).
 *   - One-shot bootstrap helpers that need to read `auth.users` directly.
 *
 * Per call the function returns a fresh client — there is no cookie or
 * session state to share, so there is no value in caching, and the
 * @supabase/supabase-js client is cheap to construct.
 */
export function createServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "[supabase/server] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
