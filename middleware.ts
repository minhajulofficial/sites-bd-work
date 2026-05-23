import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Minimal middleware. Auth guards for (user) and (admin) route groups are
 * added in PR-04 + PR-08; for now this is a pass-through so the request
 * chain is wired and the file is committed.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
