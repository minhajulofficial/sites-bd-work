# Cloudflare zone setup (one-time per TLD)

SITES.BD is a multi-TLD platform. Each parent domain (`sites.bd`,
`esite.top`, `esite.in`, and any new TLD the operator decides to add
later) is a **separate Cloudflare zone with its own API token**. This
keeps blast radius small (a leaked token only affects one zone) and lets
the client keep `sites.bd` on their personal Cloudflare account while
`esite.top` / `esite.in` live in the shared operations account.

This document is the operator runbook for wiring up a TLD. It is
referenced from the PR-24 TLD admin page.

## Architecture

```
src/config/domains.json   ← bootstrap defaults (id, name, envPrefix, order)
public.tlds (DB row)      ← runtime source of truth (enabled flag, primary, etc.)
process.env.CF_<PREFIX>_* ← per-TLD Cloudflare creds (token + zone id + zone name)
```

Every server-side caller goes through
[`getCloudflareClient(tldId)`](../src/lib/cloudflare/client.ts), which
internally calls
[`getTldEnv(id)`](../src/lib/domains/registry.ts#L66) to look up
`CF_<envPrefix>_API_TOKEN`, `CF_<envPrefix>_ZONE_ID`, and
`CF_<envPrefix>_ZONE_NAME`. No code anywhere reads `process.env.CF_*`
directly — adding a new TLD is therefore a config + DB + env-var change
only.

## Adding a TLD (the full checklist)

### 1. Get the domain into Cloudflare

If the TLD is on the **client's personal Cloudflare account** (this is
the case for `sites.bd`):

1. Ask the client to add the domain to their Cloudflare account (Sites
   → Add a Site → enter `sites.bd`).
2. Have them switch the registrar's nameservers to the Cloudflare pair
   they're assigned.
3. Wait for Cloudflare to mark the zone **Active** in the dashboard.
4. Ask the client for the **Zone ID** (Overview page, right column)
   and a scoped API token (see step 3 below).

If the TLD is on the **shared ops Cloudflare account** (`esite.top`,
`esite.in`, anything new):

1. Log into the shared account.
2. Sites → **Add a Site** → enter the domain (e.g. `esite.top`).
3. Pick the **Free** plan and continue. Cloudflare will scan existing
   DNS records.
4. Cloudflare shows two NS records — go to the domain registrar and
   replace whatever NS pair they had with those Cloudflare values.
5. Wait for the zone status to flip to **Active** (usually < 1 hour
   after registrar propagates).

### 2. Copy the Zone ID

On the zone's **Overview** page, in the right column, copy the **Zone
ID** (UUID-shaped, 32 hex chars). This is the value for
`CF_<PREFIX>_ZONE_ID`.

### 3. Mint a scoped API token

Profile (top-right) → **My Profile** → **API Tokens** → **Create
Token** → **Custom token**.

- **Permissions**:
  - `Zone` · `DNS` · **Edit**
  - `Zone` · `Zone` · **Read**
- **Zone Resources**:
  - `Include` · `Specific zone` · pick the zone you just added.
- **Client IP Address Filtering**: leave blank (Vercel egress IPs are
  not static).
- **TTL**: leave blank (no expiry) unless you have a key-rotation
  schedule.

Click **Continue to summary** → **Create Token**. Cloudflare shows the
token **once** — copy it immediately. This is the value for
`CF_<PREFIX>_API_TOKEN`.

### 4. Decide the prefix

The prefix is what `domains.json` calls `envPrefix`. By convention it's
the TLD name uppercased with `.` replaced by `_`. Examples:

| TLD          | envPrefix       |
| ------------ | --------------- |
| `sites.bd`   | `CF_SITES_BD`   |
| `esite.top`  | `CF_ESITE_TOP`  |
| `esite.in`   | `CF_ESITE_IN`   |
| `example.co` | `CF_EXAMPLE_CO` |

### 5. Add env vars to every environment

For each environment that runs the app (local `.env.local`, Vercel
Preview, Vercel Production, and any CI runner):

```
CF_<PREFIX>_API_TOKEN=<token from step 3>
CF_<PREFIX>_ZONE_ID=<zone id from step 2>
CF_<PREFIX>_ZONE_NAME=<the parent domain, e.g. esite.top>
```

For Vercel: project Settings → **Environment Variables** → add each
of the three with the appropriate scope (Production + Preview +
Development).

### 6. Add the TLD to `domains.json`

Edit [`src/config/domains.json`](../src/config/domains.json) and add a
new entry:

```json
{
  "id": "example-co",
  "name": "example.co",
  "enabled": true,
  "envPrefix": "CF_EXAMPLE_CO",
  "label": "example.co",
  "order": 4,
  "isPrimary": false
}
```

Rules:

- `id` is the slug — letters, digits, `-` only. It's what appears in
  URLs like `/api/dns/<id>`. **Must match `tlds.slug` in the DB.**
- `envPrefix` must match the prefix you used in step 4.
- Only **one** entry should have `isPrimary: true` — that's the one the
  homepage defaults to.

### 7. Insert the matching `tlds` row in Supabase

Run from `psql` against your Supabase instance:

```sql
insert into public.tlds (slug, name, env_prefix, cloudflare_zone_id, enabled, is_primary, display_order, label)
values ('example-co', 'example.co', 'CF_EXAMPLE_CO',
        '<zone id from step 2>', true, false, 4, 'example.co');
```

`slug` here equals `domains.json.id`. `display_order` mirrors
`domains.json.order`. The DB row is the runtime source of truth for the
`enabled` flag once the app is wired to read it (PR-24).

### 8. Verify

From the repo root:

```bash
npm run cf:verify
```

The script iterates every enabled TLD in `domains.json`, instantiates
its Cloudflare client, and prints zone metadata + the first 5 DNS
records. Non-zero exit on the first failure — typically that's
**missing env vars** (caught by `getTldEnv()`) or a **token without the
required scopes** (`Zone:DNS:Edit` + `Zone:Zone:Read`).

## Removing or disabling a TLD

You almost never want to actually delete a TLD — historical domains and
orders still reference it. Prefer one of:

1. **Soft disable** (recommended): set `enabled = false` on the matching
   `public.tlds` row, and `"enabled": false` on the `domains.json`
   entry. The `/api/dns/<id>` endpoints will start returning
   `404 tld_disabled` and the homepage TLD picker will hide it.
2. **Hard remove**: in addition to the above, delete the entry from
   `domains.json`. Any existing `domains` row with that `tld_id` will
   still be queryable in the DB (for audit), but no new claims can be
   made and the API routes return `404 unknown_tld`. The env vars can
   then be removed from Vercel.

Either way you do **not** need to touch any code under `src/app/api/dns/`
or `src/lib/cloudflare/` — they auto-discover TLDs from the registry.

## Token rotation

To rotate a TLD's token:

1. Create a new token following step 3 above (the old token stays valid
   until you delete it, so this is zero-downtime).
2. Update `CF_<PREFIX>_API_TOKEN` in every environment.
3. Redeploy (Vercel) / restart (local).
4. Confirm with `npm run cf:verify`.
5. Delete the old token in Cloudflare → My Profile → API Tokens.

## Common failures

| Symptom                                                          | Cause                                                       | Fix                                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `cf:verify` prints `Missing env vars for TLD "..."`              | One of the three `CF_<PREFIX>_*` vars not set               | Set them in `.env.local` / Vercel env settings                                                       |
| `Cloudflare returned HTTP 403`                                   | Token missing `Zone:DNS:Edit` or `Zone:Zone:Read`           | Re-mint token with both perms (step 3)                                                               |
| `Cloudflare returned HTTP 400 ... not authorized to access zone` | Token scoped to a different zone than `CF_<PREFIX>_ZONE_ID` | Confirm the zone selected in step 3 matches `ZONE_ID`                                                |
| `Cloudflare returned HTTP 429`                                   | API rate limit (1200 / 5 min)                               | Client auto-retries 3× with 200/600/1800 ms backoff; if it still fails, throttle the caller upstream |
| `Unknown TLD "xyz"`                                              | URL slug doesn't match any `domains.json` entry             | Add the entry (step 6) or fix the slug in the request                                                |
