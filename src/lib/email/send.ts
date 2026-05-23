import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import contentConstants from "@/content/contentConstants.json";

/**
 * SMTP send helper.
 *
 * In production every transactional email goes through Nodemailer + the
 * configured SMTP relay. In development if the SMTP env vars are not
 * populated, we log the email to the console instead of throwing so
 * `npm run dev` works without a mail server set up.
 *
 * Templates live in `src/content/contentConstants.json` under the
 * `auth.*` keys and use a minimal `{{token}}` placeholder grammar.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text: string;
}

export interface EmailTemplateVars {
  [key: string]: string | number | undefined;
}

/**
 * Replaces every `{{name}}` token in `template` with the matching value
 * from `vars`. Missing values render as the empty string.
 */
export function renderTemplate(
  template: string,
  vars: EmailTemplateVars,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/**
 * Lazy SMTP transporter — built on first send so missing env vars in dev
 * don't crash the app at import time.
 */
let cachedTransporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !portRaw || !user || !pass) return null;

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) return null;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransporter;
}

/**
 * Sends `input` via the configured SMTP transport. In dev with no SMTP
 * vars set, logs the email to the console and returns. In any other
 * environment a missing transporter throws.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const transporter = getTransporter();
  const from =
    process.env.SMTP_FROM ?? "SITES.BD <no-reply@sites.bd>";

  if (!transporter) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[email] DEV MODE — SMTP not configured, would have sent:\n  from: ${from}\n  to: ${input.to}\n  subject: ${input.subject}\n  text:\n${input.text}\n`,
      );
      return;
    }
    throw new Error(
      "[email/send] SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS must be set in non-development environments",
    );
  }

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

/**
 * Typed accessor for the auth-related templates so callers don't have to
 * reach into the JSON shape directly. The strings come from
 * `src/content/contentConstants.json` so PR-04 (and future PRs) can
 * tweak copy without touching code.
 */
export const authTemplates = contentConstants.auth as {
  otpEmailSubject: string;
  otpEmailBody: string;
  otpEmailHtml: string;
  forgotPasswordEmailSubject: string;
  forgotPasswordEmailBody: string;
  forgotPasswordEmailHtml: string;
  welcomeEmailSubject: string;
  welcomeEmailBody: string;
  welcomeEmailHtml: string;
  errors: Record<string, string>;
};
