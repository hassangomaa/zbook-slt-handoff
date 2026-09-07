/* ────────────────────────────────────────────────────────────────────────
 * VENDORED COPY — DO NOT EDIT.
 *
 * Canonical source: packages/slt-license-core/index.mjs
 * Regenerate:       node scripts/sync-license-core.mjs
 * Verified by:      node scripts/sync-license-core.mjs --check  (CI gate)
 *
 * An edit here is silently discarded on the next sync, and until then it makes
 * this product disagree with the other one about what a valid licence is.
 * ──────────────────────────────────────────────────────────────────────── */
/**
 * @slt/license-core — the shared contract between the SLT OCR client and the
 * SLT Licence Issuer.
 *
 * Two separate applications, two separate databases, one cryptographic
 * agreement. Everything both sides must agree on lives here and nowhere else.
 */
export * from "./crypto.mjs";
export * from "./modules.mjs";
export * from "./license.mjs";
export * from "./fingerprint.mjs";
