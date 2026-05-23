/**
 * scripts/verify-cloudflare.ts
 *
 * CLI sanity check for the multi-zone Cloudflare service layer. For every
 * enabled TLD in `src/config/domains.json`, instantiates a Cloudflare
 * client and prints the zone metadata (name, status, name servers) plus
 * the first 5 DNS records. Exits non-zero on the first failure so it can
 * be used as a deploy / cron pre-check.
 *
 * Usage:
 *   npm run cf:verify
 *
 * Reads creds from process.env. Honors `.env.local` then `.env` (no
 * runtime dotenv dependency — see `loadEnvFile()` below).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getCloudflareClient } from "../src/lib/cloudflare/client";
import { CloudflareError } from "../src/lib/cloudflare/types";
import { getEnabledTlds } from "../src/lib/domains/registry";

function loadEnvFile(relPath: string): void {
  let text: string;
  try {
    text = readFileSync(resolve(process.cwd(), relPath), "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (process.env[key]) continue;
    let val = rawVal.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

// ES imports above don't read env at module load — registry only reads
// `process.env.CF_*` inside `getTldEnv()`, which we call below.
loadEnvFile(".env.local");
loadEnvFile(".env");

interface TldResult {
  id: string;
  name: string;
  ok: boolean;
  error?: string;
}

async function verifyOne(id: string, name: string): Promise<TldResult> {
  console.log(`\n=== ${name} (${id}) ===`);
  try {
    const client = getCloudflareClient(id);
    const zone = await client.getZoneInfo();
    console.log(`  zone id      : ${zone.id}`);
    console.log(`  zone name    : ${zone.name}`);
    console.log(`  zone status  : ${zone.status}`);
    console.log(
      `  name servers : ${zone.name_servers.length > 0 ? zone.name_servers.join(", ") : "(none reported)"}`,
    );

    const records = await client.listDnsRecords({ per_page: 5, page: 1 });
    if (records.length === 0) {
      console.log("  records      : (none)");
    } else {
      console.log(`  first ${records.length} record(s):`);
      for (const r of records) {
        const pad = r.type.padEnd(5);
        console.log(`    - ${pad} ${r.name} -> ${r.content} (ttl ${r.ttl})`);
      }
    }
    return { id, name, ok: true };
  } catch (e) {
    const message =
      e instanceof CloudflareError
        ? `${e.message}${e.errors.length > 0 ? ` (${e.errors.map((er) => `${er.code} ${er.message}`).join("; ")})` : ""}`
        : e instanceof Error
          ? e.message
          : String(e);
    console.error(`  FAILED: ${message}`);
    return { id, name, ok: false, error: message };
  }
}

async function main(): Promise<void> {
  const tlds = getEnabledTlds();
  if (tlds.length === 0) {
    console.error("No enabled TLDs in src/config/domains.json — nothing to verify.");
    process.exit(1);
  }

  console.log(
    `[cf:verify] checking ${tlds.length} enabled TLD(s): ${tlds.map((t) => t.name).join(", ")}`,
  );

  const results: TldResult[] = [];
  for (const tld of tlds) {
    results.push(await verifyOne(tld.id, tld.name));
  }

  const failures = results.filter((r) => !r.ok);
  console.log("\n=== Summary ===");
  for (const r of results) {
    console.log(`  [${r.ok ? "OK  " : "FAIL"}] ${r.name} (${r.id})`);
  }
  if (failures.length > 0) {
    console.error(
      `\n${failures.length} of ${results.length} TLD check(s) failed.`,
    );
    process.exit(1);
  }
  console.log(`\nAll ${results.length} TLD(s) verified OK.`);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.stack ?? e.message : String(e);
  console.error("[cf:verify] unhandled error:\n" + msg);
  process.exit(1);
});
