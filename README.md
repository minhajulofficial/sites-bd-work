# SITES.BD — multi-TLD subdomain provider

SITES.BD is a free multi-TLD subdomain platform. Visitors claim subdomains
under any of the parent domains configured in
[`src/config/domains.json`](src/config/domains.json) — currently `sites.bd`,
`esite.top`, and `esite.in`.

This repository (`sites-bd-work`) is the development working copy. The owner
performs the final domain swap to `sites.bd` at the end of the project.

## Stack

- **Next.js 14** (App Router) + **TypeScript** (strict)
- **React 18** + **Tailwind CSS** + **AOS** (scroll animations) + **Font
  Awesome Free**
- **Supabase** (auth + Postgres + RLS)
- **Cloudflare API v4** (multi-zone — one zone per TLD)
- **Nodemailer** + SMTP
- Deployed on **Vercel** (`sites-bd-work.vercel.app`)

## Setup

```bash
npm install
cp .env.example .env.local
# fill the three Cloudflare token/zone sets and the Supabase keys
npm run dev
```

Local dev server runs on http://localhost:3000.

### Scripts

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `npm run dev`      | Next.js dev server           |
| `npm run build`    | Production build             |
| `npm run start`    | Run the production build     |
| `npm run lint`     | ESLint (Next.js core config) |
| `npm run typecheck`| `tsc --noEmit`               |

## How to add a new parent domain

The parent-domain list is config-only — no code changes required. Four steps:

1. **Add an entry** to [`src/config/domains.json`](src/config/domains.json)
   with a unique `id`, an `envPrefix`, the `name` (e.g. `example.bd`), an
   `order` index, and `enabled: true`. Only one entry should have
   `isPrimary: true`.
2. **Add the matching env vars** to `.env.local` and the Vercel project envs
   (Production, Preview, Development):
   - `CF_<PREFIX>_API_TOKEN`
   - `CF_<PREFIX>_ZONE_ID`
   - `CF_<PREFIX>_ZONE_NAME`
3. **Insert a row** into the `tlds` Supabase table (added in PR-02). This
   row is what the admin panel reads for runtime overrides.
4. **Redeploy** — that's it. The homepage dropdown, `/api/health`,
   `/api/dns/[tldId]`, and every future search/admin/DNS module pick up the
   new TLD automatically through
   [`src/lib/domains/registry.ts`](src/lib/domains/registry.ts).

## Route map

| Path                            | Purpose                            | Lands in |
| ------------------------------- | ---------------------------------- | -------- |
| `/`                             | Marketing homepage (ported)        | PR-01    |
| `/login`, `/register`           | Auth flows                         | PR-06    |
| `/forgot-password`              | Password reset                     | PR-06    |
| `/complete-profile`             | Post-signup profile completion     | PR-07    |
| `/check`                        | Domain availability search         | PR-12    |
| `/dash`, `/dash/profile`        | User dashboard                     | PR-09    |
| `/domains`                      | User's owned subdomains            | PR-13    |
| `/domains/[fullDomain]`         | Domain detail / DNS editor         | PR-14    |
| `/services`                     | Hosting catalog                    | PR-15    |
| `/cart`, `/cart/addons`         | Cart + add-ons                     | PR-16    |
| `/cart/review`                  | Cart review + checkout             | PR-17    |
| `/invoices`, `/invoices/[n]`    | Billing                            | PR-18    |
| `/tickets`, `/tickets/[n]`      | Support tickets                    | PR-19    |
| `/admin`                        | Admin home                         | PR-22    |
| `/admin/tlds`                   | TLD registry management            | PR-24    |
| `/admin/dns-overwrite`          | Manual DNS overwrite tool          | PR-25    |
| `/api/health`                   | Liveness + enabled-TLD list        | PR-01    |
| `/api/dns/[tldId]`              | Per-TLD Cloudflare DNS API         | PR-03    |

## Database setup

The Supabase schema lives under [`supabase/`](supabase/):

- [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) —
  one self-contained migration that creates all 14 tables, every status
  ENUM, the trigger functions (`set_updated_at`, `generate_customer_id`,
  `is_admin`, plus per-table triggers), and enables RLS with explicit
  policies on every table.
- [`supabase/seed.sql`](supabase/seed.sql) — idempotent seed that inserts
  the three TLDs from
  [`src/config/domains.json`](src/config/domains.json), one bootstrap
  admin user (`admin@sites.bd`, hardcoded UUID
  `00000000-0000-0000-0000-000000000001`), and three placeholder banners.

### Run locally against your Supabase project

The recommended path is the official Supabase CLI:

```bash
# one-time
npm i -g supabase

supabase link --project-ref <your-project-ref>
supabase db push                                    # applies 0001_init.sql
psql "$SUPABASE_DB_URL" -f supabase/seed.sql        # inserts TLDs/admin/banners
```

Or apply directly via the Supabase dashboard's SQL editor: paste
`supabase/migrations/0001_init.sql` first, then `supabase/seed.sql`.

After the seed runs, set the bootstrap admin password manually via
**Supabase Dashboard → Authentication → Users → `admin@sites.bd` → Send
password reset**.

### Regenerating TypeScript types

The repo ships hand-written types at
[`src/types/supabase.ts`](src/types/supabase.ts) that match
`0001_init.sql` exactly. To regenerate from a live Supabase project (the
output should be byte-identical to the committed file modulo whitespace):

```bash
npx supabase gen types typescript --schema public > src/types/supabase.ts
```

Use the named exports `Database`, `Tables<…>`, `TablesInsert<…>`,
`TablesUpdate<…>`, and `Enums<…>` from this file in app code:

```ts
import type { Tables, Enums } from "@/types/supabase";

type Domain = Tables<"domains">;
type Status = Enums<"domain_operational_status">;
```

## Multi-domain registry

All DNS, search, admin, and email code paths **must** read parent-domain
metadata via [`src/lib/domains/registry.ts`](src/lib/domains/registry.ts) —
never via hard-coded TLD lists, never via `process.env.CF_*` directly.

```ts
import {
  getEnabledTlds,
  getTldById,
  getTldEnv,
} from "@/lib/domains/registry";

const tlds = getEnabledTlds();              // sorted, only enabled
const sitesBd = getTldById("sites-bd");      // ← throws? no, returns null
const { apiToken, zoneId, zoneName } =
  getTldEnv("sites-bd");                     // ← throws if env missing
```

## Cron schedule placeholders (PR-23)

PR-23 will wire up the scheduled jobs below in `vercel.json` under the
`crons` key. They are intentionally left empty for now so this PR does not
trigger any background work.

| Schedule        | Path                      | Purpose                                |
| --------------- | ------------------------- | -------------------------------------- |
| `0 0 * * *`     | `/api/cron/cleanup`       | Reap unconfirmed sign-ups / claims     |
| `*/30 * * * *`  | `/api/cron/dns-reconcile` | Reconcile Supabase domains ↔ CF zones  |
| `0 1 * * 0`     | `/api/cron/weekly-report` | Owner weekly digest                    |

## Legacy reference

The original marketing homepage (pure HTML + embedded CSS/JS) is preserved
at [`legacy/index.html`](legacy/index.html) so future PRs can diff against
the pixel-perfect baseline.
