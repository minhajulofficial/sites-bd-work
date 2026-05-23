"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faUser,
  faLocationDot,
  faEnvelope,
  faMobileScreen,
  faIdBadge,
  faLock,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";

import { addressSchema, fullNameSchema } from "@/lib/auth/validation";
import authContent from "@/content/contentConstants.json";

const formSchema = z.object({
  full_name: fullNameSchema,
  address: addressSchema,
});

type FormValues = z.infer<typeof formSchema>;

export interface ProfileEditFormProps {
  initial: {
    full_name: string;
    address: string;
    email: string;
    mobile: string;
    customer_id: string;
  };
}

export function ProfileEditForm({ initial }: ProfileEditFormProps) {
  const router = useRouter();
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: initial.full_name,
      address: initial.address,
    },
  });

  return (
    <form
      noValidate
      className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
      onSubmit={handleSubmit(async (values) => {
        setPageError(null);
        setSuccessMessage(null);
        try {
          const res = await fetch("/api/profile", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(values),
          });
          if (!res.ok) {
            const payload = (await res.json().catch(() => ({}))) as {
              error?: { code?: string; message?: string };
            };
            if (payload.error?.code === "account_suspended") {
              router.replace("/login?error=suspended");
              return;
            }
            if (payload.error?.code === "unauthenticated") {
              router.replace("/login?error=session_expired");
              return;
            }
            setPageError(
              payload.error?.message ?? `Request failed (${res.status})`,
            );
            return;
          }
          setSuccessMessage("Profile updated.");
          // Reset form's dirty state so the disabled-when-not-dirty
          // button goes back to "Save changes" state.
          reset(values, { keepDirty: false });
          router.refresh();
        } catch (e) {
          console.error("[profile] update failed", e);
          setPageError("Network error. Please try again.");
        }
      })}
    >
      {pageError ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {pageError}
        </div>
      ) : null}
      {successMessage ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          <FontAwesomeIcon icon={faCheck} className="text-emerald-500" />
          {successMessage}
        </div>
      ) : null}

      <section>
        <SectionHeader title="Editable details" />
        <div className="mt-4 grid gap-4">
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
              {...register("full_name")}
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
              {...register("address")}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pl-10 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Account identifiers"
          subtitle={authContent.auth.errors.immutableField}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ReadOnlyField
            id="email"
            label="Email address"
            icon={faEnvelope}
            value={initial.email}
          />
          <ReadOnlyField
            id="mobile"
            label="Mobile number"
            icon={faMobileScreen}
            value={initial.mobile}
          />
          <ReadOnlyField
            id="customer_id"
            label="Customer ID"
            icon={faIdBadge}
            value={initial.customer_id}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className={clsx(
            "inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
            "hover:brightness-105 active:brightness-95",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {isSubmitting ? (
            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
          ) : null}
          Save changes
        </button>
      </div>
    </form>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-xs text-gray-400">{subtitle}</p> : null}
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  error,
  children,
}: {
  id: string;
  label: string;
  icon?: Parameters<typeof FontAwesomeIcon>[0]["icon"];
  error?: string;
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
      {error ? (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ReadOnlyField({
  id,
  label,
  icon,
  value,
}: {
  id: string;
  label: string;
  icon: Parameters<typeof FontAwesomeIcon>[0]["icon"];
  value: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div
        className="group relative mt-1 cursor-not-allowed"
        title={authContent.auth.errors.immutableField}
      >
        <FontAwesomeIcon
          icon={icon}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          id={id}
          type="text"
          value={value}
          readOnly
          disabled
          aria-readonly="true"
          className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 pl-10 pr-10 text-gray-500 shadow-sm"
        />
        <FontAwesomeIcon
          icon={faLock}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
