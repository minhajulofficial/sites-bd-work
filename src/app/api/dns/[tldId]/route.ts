import { NextResponse } from "next/server";

/**
 * Placeholder for the per-TLD Cloudflare DNS API. The real implementation
 * lands in PR-03 (multi-zone factory) and PR-13 (DNS write paths). Folder
 * convention is established here so future routes plug in cleanly.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Not Implemented" },
    { status: 501 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Not Implemented" },
    { status: 501 },
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Not Implemented" },
    { status: 501 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Not Implemented" },
    { status: 501 },
  );
}
