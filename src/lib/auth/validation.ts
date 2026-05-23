import { z } from "zod";

/**
 * Zod schemas for the registration flow. Kept in one place so the
 * client wizard and the API routes share **the same** validation rules —
 * if the API rejects a value the client side already rejected it too.
 */

// RFC-5321 caps an email's local-part at 64 chars, the whole address at
// 254. Supabase echoes the lower bound, so we lowercase before persist.
export const emailSchema = z
  .string()
  .trim()
  .min(3, "Email is required")
  .max(254, "Email is too long")
  .email("Enter a valid email address")
  .transform((s) => s.toLowerCase());

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/u, "Enter the 6-digit code");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/u, "Password must contain at least one letter")
  .regex(/\d/u, "Password must contain at least one number");

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Full name is required")
  .max(120, "Full name is too long");

/**
 * Bangladeshi mobile number (current ITU pattern: 11 digits starting
 * with `01[3-9]`). Accepts the local form (`01XXXXXXXXX`) or the
 * international form (`+8801XXXXXXXXX` / `8801XXXXXXXXX`); normalises
 * to the local form for storage so unique-index lookups don't have to
 * worry about leading-`+880` variants.
 */
export const mobileBdRegex = /^(\+?880|0)1[3-9]\d{8}$/u;

export const mobileSchema = z
  .string()
  .trim()
  .regex(mobileBdRegex, "Enter a valid Bangladeshi mobile number")
  .transform((raw) => {
    if (raw.startsWith("+880")) return "0" + raw.slice(4);
    if (raw.startsWith("880")) return "0" + raw.slice(3);
    return raw;
  });

export const addressSchema = z
  .string()
  .trim()
  .min(5, "Complete address is required")
  .max(500, "Address is too long");

// ---------------------------------------------------------------------------
// Endpoint bodies
// ---------------------------------------------------------------------------

export const sendOtpBodySchema = z.object({
  email: emailSchema,
});

export const verifyOtpBodySchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});

export const setPasswordBodySchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const completeProfileBodySchema = z.object({
  full_name: fullNameSchema,
  mobile: mobileSchema,
  address: addressSchema,
});

/**
 * Login. We deliberately do *not* re-use `passwordSchema` here — the
 * sign-in path should accept whatever the user typed (even if it's
 * weaker than today's policy) so legacy / reset accounts can still
 * sign in.
 */
export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

/**
 * Profile-edit payload. Only the two fields the PRD allows the user to
 * change on their own. `email` / `mobile` / `customer_id` are
 * deliberately omitted; the DB trigger from PR-02 enforces immutability
 * even if a caller tries to PATCH them anyway.
 */
export const updateProfileBodySchema = z
  .object({
    full_name: fullNameSchema.optional(),
    address: addressSchema.optional(),
  })
  .refine((d) => d.full_name !== undefined || d.address !== undefined, {
    message: "Provide at least one field to update",
  });

export type SendOtpBody = z.infer<typeof sendOtpBodySchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpBodySchema>;
export type SetPasswordBody = z.infer<typeof setPasswordBodySchema>;
export type CompleteProfileBody = z.infer<typeof completeProfileBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
