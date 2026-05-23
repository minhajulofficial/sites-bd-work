"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faUser,
  faMobileScreen,
  faLocationDot,
} from "@fortawesome/free-solid-svg-icons";

import { AuthCard } from "@/components/auth/AuthCard";
import {
  addressSchema,
  fullNameSchema,
  mobileSchema,
} from "@/lib/auth/validation";
import { useState } from "react";

const formSchema = z.object({
  full_name: fullNameSchema,
  mobile: mobileSchema,
  address: addressSchema,
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Forced step 4 of the registration flow. Reachable only by signed-in
 * users whose profile is **not yet** `profile_verified` — the existing
 * `middleware.ts` route guards (PR-04) handle both
 *
 *   - unauthenticated users (→ `/login`), and
 *   - already-completed users (→ `/dash`)
 *
 * so this page can focus purely on rendering the form. We still
 * defensively re-check the API response and follow whatever `redirect`
 * it returns.
 */
export default function CompleteProfilePage() {
  const router = useRouter();
  const [pageError, setPageError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { full_name: "", mobile: "", address: "" },
  });

  return (
    <AuthCard
      title="Complete your profile"
      subtitle="One more step before you can claim a subdomain. We use these details on invoices and support tickets."
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
            const res = await fetch("/api/auth/register/complete-profile", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(values),
            });
            if (!res.ok) {
              const message = await readErrorMessage(res);
              setPageError(message);
              return;
            }
            const data = (await res.json()) as {
              ok: true;
              customer_id: string;
              redirect: string;
            };
            router.replace(data.redirect ?? "/dash");
          } catch (e) {
            console.error("[complete-profile] submit failed", e);
            setPageError("Network error. Please try again.");
          }
        })}
      >
        <Field
          id="full_name"
          label="Full name"
          icon={faUser}
          error={errors.full_name?.message}
        >
          <input
            id="full_name"
            type="text"
            autoComplete="name"
            placeholder="e.g. Rahim Uddin"
            {...register("full_name")}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pl-10 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field
          id="mobile"
          label="Active mobile number"
          icon={faMobileScreen}
          error={errors.mobile?.message}
          hint="Bangladeshi format: 01XXXXXXXXX or +8801XXXXXXXXX"
        >
          <input
            id="mobile"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="01XXXXXXXXX"
            {...register("mobile")}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pl-10 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field
          id="address"
          label="Complete address"
          icon={faLocationDot}
          error={errors.address?.message}
        >
          <textarea
            id="address"
            rows={3}
            placeholder="House / road, area, city, postal code, Bangladesh"
            {...register("address")}
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
          Submit
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
  hint,
  children,
}: {
  id: string;
  label: string;
  icon?: Parameters<typeof FontAwesomeIcon>[0]["icon"];
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative mt-1">
        {icon ? (
          <FontAwesomeIcon
            icon={icon}
            className="pointer-events-none absolute left-3 top-3 text-gray-400"
          />
        ) : null}
        {children}
      </div>
      {hint && !error ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
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
