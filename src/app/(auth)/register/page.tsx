"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faEnvelope, faLock, faShieldHalved } from "@fortawesome/free-solid-svg-icons";

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

type WizardStep = "email" | "otp" | "password";

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
 * Single-page wizard at `/register`. States 1-3 (email → OTP → password)
 * live inside this component as discriminated unions over `step`; the
 * forced state-4 page lives at `/complete-profile`.
 *
 * Per PRD-§3.1 the inter-step `token` returned by `verify-otp` lives
 * **only in component state**, never `localStorage`. Refreshing the
 * page wipes the wizard's progress, which is the desired behavior (the
 * user has to OTP again — they haven't been signed in yet so nothing
 * persists).
 */
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("email");
  const [email, setEmail] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);
  const [otpDeadline, setOtpDeadline] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <AuthCard
      title={titleForStep(step)}
      subtitle={subtitleForStep(step, email)}
      footer={
        step === "email" ? (
          <span>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold underline underline-offset-2"
            >
              Login
            </Link>
          </span>
        ) : null
      }
    >
      <StepIndicator step={step} />
      {pageError ? <ErrorBanner message={pageError} /> : null}
      {step === "email" ? (
        <EmailStep
          defaultEmail={email}
          onSubmitted={(submitted) => {
            setEmail(submitted);
            setOtpDeadline(Date.now() + OTP_WINDOW_MS);
            setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
            setPageError(null);
            setStep("otp");
          }}
          onError={setPageError}
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
            setStep("password");
          }}
          onResent={() => {
            setOtpDeadline(Date.now() + OTP_WINDOW_MS);
            setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
            setPageError(null);
          }}
          onError={setPageError}
          onChangeEmail={() => {
            setStep("email");
            setPageError(null);
          }}
        />
      ) : null}
      {step === "password" ? (
        <PasswordStep
          token={token ?? ""}
          onSuccess={(redirectTo) => router.replace(redirectTo)}
          onError={setPageError}
        />
      ) : null}
    </AuthCard>
  );
}

function titleForStep(step: WizardStep): string {
  switch (step) {
    case "email":
      return "Create your account";
    case "otp":
      return "Verify your email";
    case "password":
      return "Set a password";
  }
}

function subtitleForStep(step: WizardStep, email: string): string | undefined {
  switch (step) {
    case "email":
      return "Sign up with your email to claim a free subdomain.";
    case "otp":
      return email
        ? `We sent a 6-digit code to ${email}.`
        : "We sent a 6-digit verification code to your email.";
    case "password":
      return "Choose a strong password — at least 8 characters with letters and numbers.";
  }
}

function StepIndicator({ step }: { step: WizardStep }) {
  const order: WizardStep[] = ["email", "otp", "password"];
  const idx = order.indexOf(step);
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs font-medium text-gray-500">
      {order.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2">
          <span
            className={clsx(
              "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
              i < idx
                ? "bg-primary text-white"
                : i === idx
                  ? "bg-primary text-white ring-4 ring-primary/20"
                  : "bg-gray-200 text-gray-500",
            )}
            aria-current={i === idx ? "step" : undefined}
          >
            {i + 1}
          </span>
          <span className={clsx(i === idx && "text-gray-700")}>
            {s === "email" ? "Email" : s === "otp" ? "Verify" : "Password"}
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

// ---------------------------------------------------------------------------
// Step 1 — email
// ---------------------------------------------------------------------------

function EmailStep({
  defaultEmail,
  onSubmitted,
  onError,
}: {
  defaultEmail: string;
  onSubmitted: (email: string) => void;
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
          const res = await fetch("/api/auth/register/send-otp", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: values.email }),
          });
          if (!res.ok) {
            const message = await readErrorMessage(res);
            onError(message);
            return;
          }
          onSubmitted(values.email);
        } catch (e) {
          console.error("[register] send-otp request failed", e);
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
      <SubmitButton loading={isSubmitting}>Next — Send OTP</SubmitButton>
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
  onResent: () => void;
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
  const canResend = useMemo(() => now >= resendAvailableAt, [now, resendAvailableAt]);
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
      const res = await fetch("/api/auth/register/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const message = await readErrorMessage(res);
        onError(message);
        return;
      }
      onResent();
    } catch (e) {
      console.error("[register] resend OTP failed", e);
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
          const res = await fetch("/api/auth/register/verify-otp", {
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
          console.error("[register] verify-otp request failed", e);
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

      <SubmitButton
        loading={isSubmitting}
        disabled={otpValue.length < 6}
      >
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
// Step 3 — password
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
          onError("Verification session expired. Please restart registration.");
          return;
        }
        try {
          const res = await fetch("/api/auth/register/set-password", {
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
          onSuccess(data.redirect ?? "/complete-profile");
        } catch (e) {
          console.error("[register] set-password request failed", e);
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
        label="Confirm password"
        icon={faLock}
        error={errors.confirmPassword?.message}
      >
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          {...register("confirmPassword")}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pl-10 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>
      <SubmitButton loading={isSubmitting}>Save Password</SubmitButton>
    </form>
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
