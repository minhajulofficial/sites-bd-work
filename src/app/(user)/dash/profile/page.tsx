import { redirect } from "next/navigation";

import { ProfileEditForm } from "./ProfileEditForm";
import {
  AccountSuspendedError,
  ProfileIncompleteError,
  UnauthorizedError,
  requireProfileVerified,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * `/dash/profile` — view and edit profile fields. Server-rendered so
 * the initial paint already shows the current values without needing
 * an extra round-trip; the editable form is mounted as a client
 * component below.
 *
 * Auth: enforced by middleware (`(user)` route group) **and**
 * `requireProfileVerified()` here as defense-in-depth, so a stale
 * server render can never expose another user's profile.
 */
export default async function ProfilePage() {
  let ctx;
  try {
    ctx = await requireProfileVerified();
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    if (e instanceof AccountSuspendedError) {
      redirect("/login?error=suspended");
    }
    if (e instanceof ProfileIncompleteError) redirect("/complete-profile");
    throw e;
  }

  const { profile, user } = ctx;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update your display name and contact address. Email, mobile and
          customer ID are locked to keep your account records consistent —
          contact support if any of these need to change.
        </p>
      </header>
      <ProfileEditForm
        initial={{
          full_name: profile.full_name ?? "",
          address: profile.address ?? "",
          email: user.email ?? profile.email,
          mobile: profile.mobile,
          customer_id: profile.customer_id,
        }}
      />
    </div>
  );
}
