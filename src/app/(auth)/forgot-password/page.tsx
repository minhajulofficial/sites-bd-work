"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faEnvelope,
  faLock,
  faShieldHalved,
  faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";

import { AuthCard } from "@/components/auth/AuthCard";
import { CountdownTimer } from "@/components/auth/CountdownTimer";
import { OtpInput } from "@/components/auth/OtpInput";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import {
  emailSchema,
  otpCodeSchema,
  passwordSchema,
} from "@/lib/auth/validation";

const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_WINDOW_MS = 5 * 60 * 1000;
const SUCCESS_REDIRECT_DELAY_MS = 1500;

type WizardStep = "email" | "otp" | "password" | "done";

const emailFormSchema = z.object({ email: emailSchema });
const otpFormSchema = z.object({ code: otpCodeSchema });
const passwordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type EmailFormValues = z.infer<typeof emailFormSchema>;
type OtpFormValues = z.infer<typeof otpFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;

/**
 * Single-page wizard at `/forgot-password`. Three steps:
 *
 *   1. Email — submits `email`, requests an OTP.
 *   2. OTP — 5-minute countdown, resend allowed after 60s, exchanges
 *      a valid 6-digit code for a short-lived reset token.
 *   3. New password — submits `{ token, password, confirmPassword }`
 *      to update the password and revoke all existing sessions, then
 *      redirects to `/login` so the user can sign in fresh.
 *
 * The reset token lives in component state only (matching the
 * registration wizard) so refreshing the page wipes the wizard.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("email");
  const [email, setEmail] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);
  const [otpDeadline, setOtpDeadline] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  );
  const [now, setNow] = useState<number>(() => Date.now());
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <AuthCard
      title={titleForStep(step)}
      subtitle={subtitleForStep(step, email)}
      footer={
        step === "email" || step === "done" ? (
          <span>
            Remember your password?{" "}
            <Link
              href="/login"
              className="font-semibold underline underline-offset-2"
            >
              Sign in
            </Link>
          </span>
        ) : null
      }
    >
      <StepIndicator step={step} />
      {pageError ? <ErrorBanner message={pageError} /> : null}
      {pageNotice && !pageError ? (
        <NoticeBanner message={pageNotice} />
      ) : null}
      {step === "email" ? (
        <EmailStep
          defaultEmail={email}
          onSubmitted={(submitted, message) => {
            setEmail(submitted);
            setOtpDeadline(Date.now() + OTP_WINDOW_MS);
            setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
            setPageError(null);
            setPageNotice(message);
            setStep("otp");
          }}
          onError={(msg) => {
            setPageNotice(null);
            setPageError(msg);
          }}
        />
      ) : null}
      {step === "otp" ? (
        <OtpStep
          email={email}
          deadlineMs={otpDeadline ?? Date.now() + OTP_WINDOW_MS}
          resendAvailableAt={resendAvailableAt ?? Date.now()}
          now={now}
          onVerified={(t) => {
            setToken(t);
            setPageError(null);
            setPageNotice(null);
            setStep("password");
          }}
          onResent={(message) => {
            setOtpDeadline(Date.now() + OTP_WINDOW_MS);
            setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
            setPageError(null);
            setPageNotice(message);
          }}
          onError={(msg) => {
            setPageNotice(null);
            setPageError(msg);
          }}
          onChangeEmail={() => {
            setStep("email");
            setPageError(null);
            setPageNotice(null);
          }}
        />
      ) : null}
      {step === "password" ? (
        <PasswordStep
          token={token ?? ""}
          onSuccess={(redirectTo) => {
            setStep("done");
            setPageError(null);
            setPageNotice(null);
            setTimeout(() => router.replace(redirectTo), SUCCESS_REDIRECT_DELAY_MS);
          }}
          onError={(msg) => {
            setPageNotice(null);
            setPageError(msg);
          }}
        />
      ) : null}
      {step === "done" ? <DoneStep /> : null}
    </AuthCard>
  );
}

function titleForStep(step: WizardStep): string {
  switch (step) {
    case "email":
      return "Forgot your password?";
    case "otp":
      return "Verify your email";
    case "password":
      return "Set a new password";
    case "done":
      return "Password reset";
  }
}

function subtitleForStep(step: WizardStep, email: string): string | undefined {
  switch (step) {
    case "email":
      return "Enter the email you signed up with — we'll send you a 6-digit code to reset your password.";
    case "otp":
      return email
        ? `We sent a 6-digit code to ${email} if that account exists.`
        : "We sent a 6-digit code to your email if that account exists.";
    case "password":
      return "Choose a strong new password — at least 8 characters with letters and numbers.";
    case "done":
      return "All set. Redirecting you to sign in…";
  }
}

function StepIndicator({ step }: { step: WizardStep }) {
  const order: WizardStep[] = ["email", "otp", "password"];
  const renderedStep: WizardStep = step === "done" ? "password" : step;
  const idx = order.indexOf(renderedStep);
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs font-medium text-gray-500">
      {order.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2">
          <span
            className={clsx(
              "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
              i < idx || step === "done"
                ? "bg-primary text-white"
                : i === idx
                  ? "bg-primary text-white ring-4 ring-primary/20"
                  : "bg-gray-200 text-gray-500",
            )}
            aria-current={i === idx && step !== "done" ? "step" : undefined}
          >
            {i + 1}
          </span>
          <span className={clsx(i === idx && step !== "done" && "text-gray-700")}>
            {s === "email" ? "Email" : s === "otp" ? "Verify" : "New password"}
          </span>
          {i < order.length - 1 ? (
            <span className="flex-1 border-t border-dashed border-gray-200" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

function NoticeBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — email
// ---------------------------------------------------------------------------

function EmailStep({
  defaultEmail,
  onSubmitted,
  onError,
}: {
  defaultEmail: string;
  onSubmitted: (email: string, message: string | null) => void;
  onError: (msg: string | null) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: { email: defaultEmail },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        onError(null);
        try {
          const res = await fetch("/api/auth/forgot-password/send-otp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: values.email }),
          });
          if (!res.ok) {
            const message = await readErrorMessage(res);
            onError(message);
            return;
          }
          const data = (await res.json()) as {
            ok: true;
            message?: string;
          };
          onSubmitted(values.email, data.message ?? null);
        } catch (e) {
          console.error("[forgot-password] send-otp request failed", e);
          onError("Network error. Please try again.");
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
      <SubmitButton loading={isSubmitting}>Send OTP</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — OTP
// ---------------------------------------------------------------------------

function OtpStep({
  email,
  deadlineMs,
  resendAvailableAt,
  now,
  onVerified,
  onResent,
  onError,
  onChangeEmail,
}: {
  email: string;
  deadlineMs: number;
  resendAvailableAt: number;
  now: number;
  onVerified: (token: string) => void;
  onResent: (message: string | null) => void;
  onError: (msg: string | null) => void;
  onChangeEmail: () => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: { code: "" },
  });

  const [resending, setResending] = useState(false);
  const otpValue = watch("code");
  const canResend = useMemo(
    () => now >= resendAvailableAt,
    [now, resendAvailableAt],
  );
  const resendCountdownSec = Math.max(
    0,
    Math.ceil((resendAvailableAt - now) / 1000),
  );
  const expired = now >= deadlineMs;

  const onResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    onError(null);
    try {
      const res = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const message = await readErrorMessage(res);
        onError(message);
        return;
      }
      const data = (await res.json()) as { ok: true; message?: string };
      onResent(data.message ?? null);
    } catch (e) {
      console.error("[forgot-password] resend OTP failed", e);
      onError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        onError(null);
        try {
          const res = await fetch("/api/auth/forgot-password/verify-otp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, code: values.code }),
          });
          if (!res.ok) {
            const message = await readErrorMessage(res);
            setError("code", { message });
            return;
          }
          const data = (await res.json()) as { ok: true; token: string };
          onVerified(data.token);
        } catch (e) {
          console.error("[forgot-password] verify-otp request failed", e);
          onError("Network error. Please try again.");
        }
      })}
    >
      <div className="space-y-1">
        <label
          htmlFor="otp-input"
          className="block text-sm font-medium text-gray-700"
        >
          Enter the 6-digit code
        </label>
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <OtpInput
              id="otp-input"
              value={field.value}
              onChange={field.onChange}
              disabled={isSubmitting}
              hasError={!!errors.code}
            />
          )}
        />
        {errors.code?.message ? (
          <p className="text-center text-sm text-red-600">
            {errors.code.message}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span className="inline-flex items-center gap-2">
          <FontAwesomeIcon icon={faShieldHalved} className="text-primary" />
          {expired ? (
            <span className="font-medium text-red-600">Code expired</span>
          ) : (
            <>
              Expires in{" "}
              <CountdownTimer
                targetMs={deadlineMs}
                className="font-mono font-semibold text-gray-700"
              />
            </>
          )}
        </span>
        <button
          type="button"
          onClick={onResend}
          disabled={!canResend || resending}
          className={clsx(
            "font-medium underline-offset-2",
            canResend && !resending
              ? "text-primary hover:underline"
              : "cursor-not-allowed text-gray-400",
          )}
        >
          {resending
            ? "Resending…"
            : canResend
              ? "Resend code"
              : `Resend in ${resendCountdownSec}s`}
        </button>
      </div>

      <SubmitButton loading={isSubmitting} disabled={otpValue.length < 6}>
        Verify
      </SubmitButton>

      <p className="text-center text-xs text-gray-500">
        Wrong email?{" "}
        <button
          type="button"
          onClick={onChangeEmail}
          className="font-medium text-primary hover:underline"
        >
          Change it
        </button>
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — new password
// ---------------------------------------------------------------------------

function PasswordStep({
  token,
  onSuccess,
  onError,
}: {
  token: string;
  onSuccess: (redirectTo: string) => void;
  onError: (msg: string | null) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = watch("password");

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        onError(null);
        if (!token) {
          onError(
            "Reset session expired. Please restart the password reset.",
          );
          return;
        }
        try {
          const res = await fetch("/api/auth/forgot-password/reset", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              token,
              password: values.password,
              confirmPassword: values.confirmPassword,
            }),
          });
          if (!res.ok) {
            const message = await readErrorMessage(res);
            onError(message);
            return;
          }
          const data = (await res.json()) as { ok: true; redirect: string };
          onSuccess(data.redirect ?? "/login");
        } catch (e) {
          console.error("[forgot-password] reset request failed", e);
          onError("Network error. Please try again.");
        }
      })}
    >
      <Field
        id="password"
        label="New password"
        icon={faLock}
        error={errors.password?.message}
      >
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          {...register("password")}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pl-10 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>
      <PasswordStrength password={password ?? ""} />
      <Field
        id="confirmPassword"
        label="Confirm new password"
        icon={faLock}
        error={errors.confirmPassword?.message}
      >
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          {...register("confirmPassword")}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pl-10 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>
      <SubmitButton loading={isSubmitting}>Reset Password</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — done (transient, just a friendly confirmation while we redirect)
// ---------------------------------------------------------------------------

function DoneStep() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
      <FontAwesomeIcon
        icon={faCircleCheck}
        className="text-4xl text-emerald-500"
      />
      <p className="text-sm text-gray-700">
        Your password has been reset. All other sessions have been signed
        out. Redirecting you to sign in…
      </p>
      <Link
        href="/login"
        className="text-sm font-semibold text-primary hover:underline"
      >
        Go to login now
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared primitives
// ---------------------------------------------------------------------------

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

function SubmitButton({
  loading,
  disabled,
  children,
}: {
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={clsx(
        "primary-gradient inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold text-white shadow-md transition",
        "hover:brightness-105 active:brightness-95",
        "disabled:cursor-not-allowed disabled:opacity-70",
      )}
    >
      {loading ? (
        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
      ) : null}
      {children}
    </button>
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
