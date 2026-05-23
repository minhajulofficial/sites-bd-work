/**
 * Multi-zone Cloudflare client factory.
 *
 * Implemented in PR-03. Future callers will go through this module to read
 * per-TLD Cloudflare credentials via `@/lib/domains/registry#getTldEnv`,
 * never via `process.env.CF_*` directly, so adding a new parent domain
 * stays a config-only change.
 */
export {};
