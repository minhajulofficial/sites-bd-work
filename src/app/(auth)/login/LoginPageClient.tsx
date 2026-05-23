"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faEnvelope,
  faLock,
} from "@fortawesome/free-solid-svg-icons";

import { AuthCard } from "@/components/auth/AuthCard";
import { emailSchema } from "@/lib/auth/validation";
import { useCart } from "@/lib/hooks/useCart";
import authContent from "@/content/contentConstants.json";

const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

/** Maps `?error=...` to a user-visible string. */
function bannerForQuery(code: string | null): string | null {
  if (!code) return null;
  if (code === "suspended") return authContent.auth.errors.accountSuspended;
  if (code === "session_expired") return "Your session has expired. Please sign in again.";
  return null;
}

/**
 * Normalises the `?next=` query param into a safe internal path, or
 * `null` if it's missing / unsafe. Used by PR-13's guest-claim flow
 * to bounce the user to `/cart` after sign-in. Anything that is not a
 * single-leading-slash path (i.e. anything that could escape to an
 * external origin or to a protocol-relative URL) is rejected.
 */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  // Disallow trying to jump back into the auth wizard or admin routes
  // by way of `?next=` — keeps the post-login destination on the
  // user-facing app surface.
  if (raw.startsWith("/login") || raw.startsWith("/register")) return null;
  if (raw.startsWith("/admin")) return null;
  return raw;
}

export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBanner = bannerForQuery(searchParams.get("error"));
  const [pageError, setPageError] = useState<string | null>(initialBanner);
  const nextPath = safeNextPath(searchParams.get("next"));
  const { refresh: refreshCart } = useCart();

  useEffect(() => {
    setPageError(bannerForQuery(searchParams.get("error")));
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <AuthCard
      title="Sign in to your account"
      subtitle="Welcome back — sign in to manage your subdomains and services."
      footer={
        <span>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold underline underline-offset-2"
          >
            Register
          </Link>
        </span>
      }
    >
      {pageError ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {pageError}
        </div>
      ) : null}
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit(async (values) => {
          setPageError(null);
          try {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(values),
            });
            if (!res.ok) {
              const message = await readErrorMessage(res);
              setPageError(message);
              return;
            }
            const data = (await res.json()) as { ok: true; redirect: string };
            // Honour `?next=` (validated above) only when the server
            // says the user is fully verified — a half-onboarded user
            // still has to finish `/complete-profile` first.
            const serverRedirect = data.redirect ?? "/dash";
            const target =
              nextPath && serverRedirect === "/dash" ? nextPath : serverRedirect;
            // Pull the cart over from sessionStorage into the DB now
            // (PR-14 merge step). `refresh()` will POST any guest items
            // to `/api/cart/merge-guest`, clear sessionStorage, and
            // flip the provider into user mode so `/cart` lands with
            // a populated, merged cart on first paint.
            await refreshCart();
            router.replace(target);
          } catch (e) {
            console.error("[login] sign-in request failed", e);
            setPageError("Network error. Please try again.");
          }
        })}
      >
        <Field
          id="email"
          label="Email address"
          icon={faEnvelope}
          error={errors.email?.message}
        >
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            {...register("email")}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pl-10 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field
          id="password"
          label="Password"
          icon={faLock}
          error={errors.password?.message}
          trailing={
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          }
        >
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            {...register("password")}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pl-10 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <button
          type="submit"
          disabled={isSubmitting}
          className={clsx(
            "primary-gradient inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold text-white shadow-md transition",
            "hover:brightness-105 active:brightness-95",
            "disabled:cursor-not-allowed disabled:opacity-70",
          )}
        >
          {isSubmitting ? (
            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
          ) : null}
          Sign in
        </button>
      </form>
    </AuthCard>
  );
}

function Field({
  id,
  label,
  icon,
  error,
  trailing,
  children,
}: {
  id: string;
  label: string;
  icon?: Parameters<typeof FontAwesomeIcon>[0]["icon"];
  error?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {trailing}
      </div>
      <div className="relative mt-1">
        {icon ? (
          <FontAwesomeIcon
            icon={icon}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
        ) : null}
        {children}
      </div>
      {error ? (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string };
    };
    return body.error?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}
