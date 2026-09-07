/* ────────────────────────────────────────────────────────────────────────
 * VENDORED COPY — DO NOT EDIT.
 *
 * Canonical source: packages/slt-license-core/crypto.mjs
 * Regenerate:       node scripts/sync-license-core.mjs
 * Verified by:      node scripts/sync-license-core.mjs --check  (CI gate)
 *
 * An edit here is silently discarded on the next sync, and until then it makes
 * this product disagree with the other one about what a valid licence is.
 * ──────────────────────────────────────────────────────────────────────── */
/**
 * THE CRYPTOGRAPHIC CONTRACT between the issuer and the client.
 *
 * The two applications are separate products with separate databases and
 * separate deployments. This file is the ONE thing they share, and it exists
 * so that "the hashing must be in sync" is a property of the code rather than
 * a promise somebody has to keep.
 *
 * Both sides import `canonicalJson` and `licenseDigest` from here. If they
 * ever disagree by a single byte, every licence the issuer produces fails in
 * the client — and it fails at the customer's site, at boot, with no obvious
 * cause. Duplicating thirty lines of serialisation into each app is exactly
 * how that happens, so it is not duplicated.
 *
 * ── The design, stated plainly so nobody oversells it ────────────────────
 *
 *  · A licence is a JSON payload signed with Ed25519. The private key never
 *    leaves the issuer; the client holds only the public key. A licence
 *    therefore cannot be forged or altered — change one byte of the payload
 *    and the signature fails.
 *
 *  · The signature covers the CANONICAL serialisation (sorted keys, no
 *    whitespace), so both sides serialise byte-identically regardless of the
 *    order a field happened to be written in.
 *
 *  · A licence may be bound to a machine fingerprint, so a file issued for
 *    one installation does not quietly become ten.
 *
 *  · Verification runs at boot and on a timer, so an expiry takes effect
 *    without waiting for a restart.
 *
 * ── The threat model, honestly ──────────────────────────────────────────
 *
 * Signature verification makes licences unforgeable, and binding makes casual
 * copying not work. A determined attacker with root on their own host can
 * patch any client-side check ever written. For an on-premises product a
 * licence is a contract-enforcement aid, not DRM, and claiming otherwise
 * would be snake oil. What this design does guarantee is that every VALID
 * licence traces to a key only the vendor holds.
 */
import crypto from "node:crypto";

/** Licence schema version. Bump only for a breaking payload change. */
export const LICENSE_SCHEMA_VERSION = 2;

/** The product string every licence must carry. */
export const PRODUCT = "slt-ocr";

/**
 * Canonical JSON: sorted keys, no whitespace, `undefined` dropped.
 *
 * This is the exact byte sequence that gets signed and verified. Do not
 * "improve" it — a formatting change here invalidates every licence already
 * issued, including the ones running in a plant today.
 */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * The bytes that are signed.
 *
 * Kept as its own function so the issuer and the client cannot possibly sign
 * and verify over different inputs.
 */
export function signingBytes(payload) {
  return Buffer.from(canonicalJson(payload), "utf8");
}

/**
 * A short, stable digest of a payload.
 *
 * Used as a human-quotable licence identity in support conversations and as
 * the primary key in the issuer's own database. It is NOT a security
 * boundary — the signature is. It is an identifier.
 */
export function licenseDigest(payload) {
  return crypto.createHash("sha256").update(signingBytes(payload)).digest("hex").slice(0, 16);
}

/**
 * Sign a payload. ISSUER ONLY — needs the private key.
 *
 * @param {object} payload
 * @param {crypto.KeyObject|string|Buffer} privateKey
 * @returns {string} base64 signature
 */
export function signPayload(payload, privateKey) {
  const key = privateKey instanceof crypto.KeyObject ? privateKey : crypto.createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error(`signing key is ${key.asymmetricKeyType}, expected ed25519`);
  }
  return crypto.sign(null, signingBytes(payload), key).toString("base64");
}

/**
 * Verify a signature against a public key. CLIENT AND ISSUER.
 *
 * Never throws — a malformed key or signature is a `false`, because every
 * caller here is deciding whether to trust something hostile.
 */
export function verifySignature(payload, signatureB64, publicKeyB64) {
  try {
    return crypto.verify(
      null,
      signingBytes(payload),
      crypto.createPublicKey({
        key: Buffer.from(publicKeyB64, "base64"),
        format: "der",
        type: "spki",
      }),
      Buffer.from(signatureB64, "base64"),
    );
  } catch {
    return false;
  }
}

/** Generate a vendor key pair. Run once; the private key goes into the vault. */
export function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    publicKeyB64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
  };
}

/** Derive the public key from a private key, so the issuer can publish it. */
export function publicKeyFromPrivate(privateKey) {
  const key = privateKey instanceof crypto.KeyObject ? privateKey : crypto.createPrivateKey(privateKey);
  return crypto.createPublicKey(key).export({ format: "der", type: "spki" }).toString("base64");
}

/**
 * Constant-time string comparison.
 *
 * Used for the issuer console token. A plain `===` on a secret leaks its
 * length and prefix through timing.
 */
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
