/* ────────────────────────────────────────────────────────────────────────
 * VENDORED COPY — DO NOT EDIT.
 *
 * Canonical source: packages/slt-license-core/license.mjs
 * Regenerate:       node scripts/sync-license-core.mjs
 * Verified by:      node scripts/sync-license-core.mjs --check  (CI gate)
 *
 * An edit here is silently discarded on the next sync, and until then it makes
 * this product disagree with the other one about what a valid licence is.
 * ──────────────────────────────────────────────────────────────────────── */
/**
 * Licence construction and verification.
 *
 * `buildLicense` runs in the ISSUER. `verifyLicense` runs in the CLIENT. They
 * live in the same file so that a change to the shape of a licence cannot be
 * made on one side without the other being visibly, immediately adjacent.
 */
import crypto from "node:crypto";
import {
  LICENSE_SCHEMA_VERSION,
  PRODUCT,
  signPayload,
  verifySignature,
  licenseDigest,
} from "./crypto.mjs";
import {
  SELLABLE_MODULE_KEYS,
  METERED_MODULE_KEYS,
  normaliseModules,
  normaliseCredits,
  modulesFromLegacyFeatures,
} from "./modules.mjs";

/**
 * @typedef {object} LicensePayload
 * @property {number} v
 * @property {'slt-ocr'} product
 * @property {string} licensee    Who this installation belongs to.
 * @property {string} id          Quoted in support conversations.
 * @property {string} issued      ISO timestamp.
 * @property {string} expires     ISO timestamp; refused after this.
 * @property {string[]} modules   Module keys this licence covers.
 * @property {object} [limits]    Optional caps, e.g. {seats: 25, pages_per_month: 50000}.
 * @property {object} [hwsig]     Per-signal hashes recorded at issue time.
 * @property {string} [fingerprint] Legacy single-hash binding.
 * @property {string} [notes]
 */

/** Signals strong enough to bind a licence to one machine. */
export const STRONG_SIGNALS = ["machine_id", "product_uuid"];

/**
 * Build an unsigned payload.
 *
 * Validation is deliberately strict and returns errors rather than throwing:
 * the issuer console renders them next to the field that caused them, and an
 * operator gets a sentence they can act on instead of a stack trace.
 *
 * @returns {{ok:true,payload:LicensePayload}|{ok:false,errors:string[]}}
 */
export function buildLicense({
  licensee,
  months,
  modules = [],
  credits = {},
  limits = {},
  hwsig = null,
  fingerprint = null,
  unbound = false,
  notes = "",
  now = new Date(),
}) {
  const errors = [];

  const who = String(licensee ?? "").trim();
  if (!who) {
    errors.push("Licensee is required — it is the name shown on the customer's dashboard.");
  } else if (who.length > 120) {
    errors.push("Licensee must be 120 characters or fewer.");
  }

  const m = Number(months);
  if (!Number.isFinite(m) || !Number.isInteger(m) || m < 1 || m > 120) {
    errors.push("Duration must be a whole number of months between 1 and 120.");
  }

  const wanted = [...normaliseModules(Array.isArray(modules) ? modules : [])];
  const unknown = wanted.filter((k) => !SELLABLE_MODULE_KEYS.includes(k));
  if (unknown.length) {
    errors.push(
      `Unknown module${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. ` +
        `A licence may only grant modules the client knows how to gate.`,
    );
  }
  if (wanted.length === 0) {
    errors.push(
      "Select at least one module. A licence granting nothing would install successfully and then do nothing, which reads as a broken product.",
    );
  }

  // Binding. An unbound licence works on every machine it is copied to, so it
  // is allowed only when somebody deliberately says so.
  let binding = null;
  if (hwsig && typeof hwsig === "object" && Object.keys(hwsig).length) {
    const strong = STRONG_SIGNALS.filter((k) => hwsig[k]);
    if (strong.length === 0) {
      errors.push(
        "These hardware signals carry no strong machine identity (machine_id or product_uuid), " +
          "so the binding would be trivially cloneable. Re-run the signals command on the " +
          "customer host with permission to read /etc/machine-id and the DMI tables.",
      );
    } else {
      binding = { hwsig };
    }
  } else if (fingerprint) {
    if (!/^[0-9a-f]{16,64}$/i.test(String(fingerprint))) {
      errors.push("Fingerprint must be 16 to 64 hexadecimal characters.");
    } else {
      binding = { fingerprint: String(fingerprint).toLowerCase() };
    }
  } else if (!unbound) {
    errors.push(
      "No machine binding supplied. A licence with no binding works on every machine it is " +
        "copied to — tick 'unbound' only for a development or evaluation licence.",
    );
  }

  // Credits are per service and 1-to-1 — one credit is one unit. Granting
  // credits for a module the licence does not include would be unaccountable,
  // and granting them for an unmetered module is meaningless.
  const cleanCredits = normaliseCredits(credits);
  for (const key of Object.keys(cleanCredits)) {
    if (!wanted.includes(key)) {
      errors.push(
        `Credits were given for "${key}", but that module is not included in this licence. ` +
        `Either add the module or remove its credits.`,
      );
    }
  }
  const meteredWithoutCredits = wanted.filter(
    (k) => METERED_MODULE_KEYS.includes(k) && !(k in cleanCredits),
  );

  const cleanLimits = {};
  for (const [k, v] of Object.entries(limits || {})) {
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) cleanLimits[k] = Math.floor(n);
  }

  if (errors.length) return { ok: false, errors };

  const issued = new Date(now);
  const expires = new Date(issued);
  expires.setMonth(expires.getMonth() + m);

  /** @type {LicensePayload} */
  const payload = {
    v: LICENSE_SCHEMA_VERSION,
    product: PRODUCT,
    licensee: who,
    id: `SLT-${issued.getUTCFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    issued: issued.toISOString(),
    expires: expires.toISOString(),
    // Sorted so two licences granting the same modules serialise identically.
    modules: wanted.slice().sort(),
    // Sorted so two licences granting the same credits serialise identically.
    ...(Object.keys(cleanCredits).length
      ? { credits: Object.fromEntries(Object.entries(cleanCredits).sort(([a], [b]) => (a < b ? -1 : 1))) }
      : {}),
    ...(Object.keys(cleanLimits).length ? { limits: cleanLimits } : {}),
    ...(binding || {}),
    ...(notes ? { notes: String(notes).slice(0, 300) } : {}),
  };

  return {
    ok: true,
    payload,
    // Not an error: an on-premises site licence often sells capability rather
    // than volume. Surfaced so the issuer can say so on screen instead of the
    // operator discovering it when nothing ever runs out.
    unmetered: meteredWithoutCredits,
  };
}

/** Build and sign in one step. ISSUER ONLY. */
export function issueLicense(input, privateKey) {
  const built = buildLicense(input);
  if (!built.ok) return built;
  const signature = signPayload(built.payload, privateKey);
  return {
    ok: true,
    payload: built.payload,
    signature,
    digest: licenseDigest(built.payload),
    file: { payload: built.payload, signature },
    unmetered: built.unmetered,
  };
}

/**
 * @typedef {object} LicenseState
 * @property {boolean} ok
 * @property {'valid'|'missing'|'unreadable'|'malformed'|'bad_signature'|'wrong_product'|'expired'|'fingerprint_mismatch'|'revoked'} reason
 * @property {LicensePayload} [payload]
 * @property {number} [daysRemaining]
 * @property {object} [binding]
 */

/**
 * Verify a licence. CLIENT (and the issuer, to check its own work).
 *
 * Never throws. Every failure is a `reason` the dashboard can render, because
 * the input is by definition untrusted and an exception here would be a boot
 * crash with no explanation.
 *
 * @param {object|string|null} file  Parsed licence, raw JSON, or null.
 * @param {object} opts
 * @param {string} opts.publicKeyB64
 * @param {(hwsig:object)=>{matched:boolean,score?:number,max?:number,matchedKeys?:string[]}} [opts.matchSignals]
 *        Injected so this module stays platform-free and testable. Omit to skip binding checks.
 * @param {boolean} [opts.allowUnbound=false]
 * @param {Date}   [opts.now]
 * @param {(payload:object)=>boolean} [opts.isRevoked]
 * @returns {LicenseState}
 */
export function verifyLicense(file, opts) {
  const {
    publicKeyB64,
    matchSignals,
    allowUnbound = false,
    now = new Date(),
    isRevoked,
  } = opts || {};

  if (file === null || file === undefined || file === "") {
    return { ok: false, reason: "missing" };
  }

  let parsed = file;
  if (typeof file === "string") {
    try {
      parsed = JSON.parse(file);
    } catch {
      return { ok: false, reason: "malformed" };
    }
  }
  if (!parsed || typeof parsed !== "object" || !parsed.payload || typeof parsed.signature !== "string") {
    return { ok: false, reason: "malformed" };
  }

  const payload = parsed.payload;
  if (!payload.product || typeof payload.expires !== "string" || typeof payload.licensee !== "string") {
    return { ok: false, reason: "malformed" };
  }

  // Signature FIRST. Every field below is attacker-controlled until this
  // passes, so reading `expires` or `modules` before verifying would be
  // trusting a document we have not authenticated.
  if (!verifySignature(payload, parsed.signature, publicKeyB64)) {
    return { ok: false, reason: "bad_signature" };
  }

  if (payload.product !== PRODUCT) {
    return { ok: false, reason: "wrong_product", payload };
  }

  if (typeof isRevoked === "function" && isRevoked(payload)) {
    return { ok: false, reason: "revoked", payload };
  }

  const expires = new Date(payload.expires);
  if (Number.isNaN(expires.getTime())) {
    return { ok: false, reason: "malformed" };
  }
  const daysRemaining = Math.floor((expires.getTime() - now.getTime()) / 86_400_000);
  if (expires.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired", payload, daysRemaining };
  }

  // Machine binding.
  if (payload.hwsig && typeof matchSignals === "function") {
    const m = matchSignals(payload.hwsig);
    if (!m.matched) {
      return { ok: false, reason: "fingerprint_mismatch", payload, daysRemaining, binding: { kind: "hwsig", ...m } };
    }
    return { ok: true, reason: "valid", payload, daysRemaining, binding: { kind: "hwsig", ...m }, modules: effectiveModules(payload) };
  }
  if (payload.fingerprint && typeof matchSignals === "function") {
    const m = matchSignals({ legacy: payload.fingerprint });
    if (!m.matched) {
      return { ok: false, reason: "fingerprint_mismatch", payload, daysRemaining, binding: { kind: "legacy", ...m } };
    }
    return { ok: true, reason: "valid", payload, daysRemaining, binding: { kind: "legacy", ...m }, modules: effectiveModules(payload) };
  }
  if (!payload.hwsig && !payload.fingerprint && !allowUnbound) {
    // An unbound licence is valid paper but works on any host. Accepting one
    // silently is how one sale becomes a site-wide deployment.
    return { ok: false, reason: "fingerprint_mismatch", payload, daysRemaining, binding: { kind: "none" } };
  }

  return {
    ok: true,
    reason: "valid",
    payload,
    daysRemaining,
    binding: { kind: "none" },
    modules: effectiveModules(payload),
  };
}

/**
 * The module keys a verified payload grants.
 *
 * Handles the pre-registry `features` shape so licences already in the field
 * keep working after the upgrade.
 */
export function effectiveModules(payload) {
  const direct = normaliseModules(payload.modules);
  if (direct.size) return [...direct];
  return [...modulesFromLegacyFeatures(payload.features)];
}
