"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { clsx } from "clsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faUserPen,
  faRightFromBracket,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

/**
 * Header profile dropdown used by the dashboard layout (PR-08). Self
 * contained — caller passes a `profile` object with the bits to
 * render, and the component owns its open/closed state, outside-click
 * dismissal, keyboard handling, and the logout fetch.
 *
 * Designed to be re-used elsewhere (e.g. an admin layout) without
 * pulling in extra context — the `onAfterLogout` callback lets the
 * embedding layout decide where to send the user after the cookie is
 * cleared (defaults to `/login`).
 */
export interface ProfileDropdownProps {
  profile: {
    full_name: string | null;
    email: string;
    customer_id: string;
    /** Optional avatar URL; falls back to initials. */
    avatar_url?: string | null;
  };
  /**
   * Where to drop the user after logout. Defaults to `/login`. Pass
   * `null` to disable the redirect (useful if the embedder wants to
   * handle the post-logout state itself).
   */
  postLogoutRedirect?: string | null;
}

export function ProfileDropdown({
  profile,
  postLogoutRedirect = "/login",
}: ProfileDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  const displayName = profile.full_name?.trim() || profile.email;
  const initials = computeInitials(profile.full_name, profile.email);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      // Even if the request fails we still want to drop the user out
      // of the authenticated UI — the cookies are cleared client-side
      // either way on the server response.
      if (!res.ok) {
        console.error(
          "[ProfileDropdown] /api/auth/logout returned",
          res.status,
        );
      }
    } catch (e) {
      console.error("[ProfileDropdown] logout request failed", e);
    } finally {
      setLoggingOut(false);
      setOpen(false);
      if (postLogoutRedirect) {
        router.replace(postLogoutRedirect);
        router.refresh();
      }
    }
  }, [loggingOut, postLogoutRedirect, router]);

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex items-center gap-2 rounded-full bg-white/10 px-2 py-1.5 text-left text-sm text-white",
          "transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40",
        )}
      >
        <Avatar
          name={displayName}
          initials={initials}
          avatarUrl={profile.avatar_url}
        />
        <div className="hidden min-w-0 max-w-[160px] sm:block">
          <div className="truncate text-sm font-semibold leading-tight">
            {displayName}
          </div>
          <div className="truncate text-[11px] uppercase tracking-wide text-white/70">
            {profile.customer_id}
          </div>
        </div>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={clsx(
            "ml-1 text-[10px] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 origin-top-right rounded-lg border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 focus:outline-none"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="truncate text-sm font-semibold text-gray-900">
              {displayName}
            </div>
            <div className="truncate text-xs text-gray-500">{profile.email}</div>
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              {profile.customer_id}
            </div>
          </div>
          <ul className="py-1 text-sm text-gray-700">
            <MenuItem
              icon={faUserPen}
              href="/dash/profile"
              onClick={() => setOpen(false)}
            >
              Edit Profile
            </MenuItem>
            <li>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FontAwesomeIcon
                  icon={loggingOut ? faSpinner : faRightFromBracket}
                  className={clsx("text-xs", loggingOut && "animate-spin")}
                />
                {loggingOut ? "Signing out…" : "Logout"}
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  href,
  icon,
  onClick,
  children,
}: {
  href: string;
  icon: Parameters<typeof FontAwesomeIcon>[0]["icon"];
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        role="menuitem"
        onClick={onClick}
        className="flex items-center gap-2 px-4 py-2 transition hover:bg-gray-50"
      >
        <FontAwesomeIcon icon={icon} className="text-xs text-gray-400" />
        {children}
      </Link>
    </li>
  );
}

function Avatar({
  name,
  initials,
  avatarUrl,
}: {
  name: string;
  initials: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="h-8 w-8 rounded-full object-cover ring-1 ring-white/30"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary ring-1 ring-white/30"
    >
      {initials}
    </span>
  );
}

function computeInitials(
  fullName: string | null | undefined,
  email: string,
): string {
  const source = fullName?.trim() || email.split("@")[0];
  if (!source) return "?";
  const parts = source.split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return source.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
