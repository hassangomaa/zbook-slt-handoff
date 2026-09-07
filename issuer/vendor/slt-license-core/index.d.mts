/* ────────────────────────────────────────────────────────────────────────
 * VENDORED COPY — DO NOT EDIT.
 *
 * Canonical source: packages/slt-license-core/index.d.mts
 * Regenerate:       node scripts/sync-license-core.mjs
 * Verified by:      node scripts/sync-license-core.mjs --check  (CI gate)
 *
 * An edit here is silently discarded on the next sync, and until then it makes
 * this product disagree with the other one about what a valid licence is.
 * ──────────────────────────────────────────────────────────────────────── */
/**
 * Type declarations for the licence core.
 *
 * The implementation is plain ESM so the issuer can run it with nothing but
 * Node — no build step in front of the thing that signs licences. These
 * declarations exist so the TypeScript client gets the same guarantees at
 * compile time.
 *
 * Kept in step with the implementation by hand. `contract.test.mjs` exercises
 * every function below, so a signature that drifts is caught by a failing
 * test rather than by a customer.
 */

export type ModuleCategory = "core" | "extraction" | "documents" | "operations" | "integration";

export interface ModuleDef {
  key: string;
  name: string;
  summary: string;
  category: ModuleCategory;
  core: boolean;
  routes: string[];
  apis: string[];
}

export interface ModuleCard {
  key: string;
  name: string;
  summary: string;
  category: ModuleCategory | string;
  core: boolean;
  enabled: boolean;
  reason: string;
}

export type LicenseReason =
  | "valid" | "missing" | "unreadable" | "malformed" | "bad_signature"
  | "wrong_product" | "expired" | "fingerprint_mismatch" | "revoked";

export interface LicensePayload {
  v: number;
  product: "slt-ocr";
  licensee: string;
  id: string;
  issued: string;
  expires: string;
  modules?: string[];
  limits?: Record<string, number>;
  /** Pre-registry licences carry this instead of `modules`. */
  features?: Record<string, boolean | number | string>;
  hwsig?: Record<string, string>;
  fingerprint?: string;
  notes?: string;
}

export interface LicenseFile {
  payload: LicensePayload;
  signature: string;
}

export interface SignalMatch {
  matched: boolean;
  score: number;
  max: number;
  ratio: number;
  matchedKeys: string[];
  strongMatched: string[];
  presentKeys: string[];
}

export interface LicenseState {
  ok: boolean;
  reason: LicenseReason;
  payload?: LicensePayload;
  daysRemaining?: number;
  modules?: string[];
  binding?: { kind: "hwsig" | "legacy" | "none" } & Partial<SignalMatch>;
}

export interface VerifyOptions {
  publicKeyB64: string;
  matchSignals?: (recorded: Record<string, string>) => { matched: boolean } & Partial<SignalMatch>;
  allowUnbound?: boolean;
  now?: Date;
  isRevoked?: (payload: LicensePayload) => boolean;
}

export interface BuildInput {
  licensee: string;
  months: number | string;
  modules?: string[];
  limits?: Record<string, number | string>;
  hwsig?: Record<string, string> | null;
  fingerprint?: string | null;
  unbound?: boolean;
  notes?: string;
  now?: Date;
}

export type BuildResult =
  | { ok: true; payload: LicensePayload }
  | { ok: false; errors: string[] };

export type IssueResult =
  | { ok: true; payload: LicensePayload; signature: string; digest: string; file: LicenseFile }
  | { ok: false; errors: string[] };

/* ── crypto ────────────────────────────────────────────────────────────── */
export const LICENSE_SCHEMA_VERSION: number;
export const PRODUCT: "slt-ocr";
export function canonicalJson(value: unknown): string;
export function signingBytes(payload: object): Buffer;
export function licenseDigest(payload: object): string;
export function signPayload(payload: object, privateKey: string | Buffer | object): string;
export function verifySignature(payload: object, signatureB64: string, publicKeyB64: string): boolean;
export function generateKeyPair(): { publicKeyB64: string; privateKeyPem: string };
export function publicKeyFromPrivate(privateKey: string | Buffer | object): string;
export function safeEqual(a: unknown, b: unknown): boolean;

/* ── modules ───────────────────────────────────────────────────────────── */
export const MODULES: ModuleDef[];
export const MODULE_KEYS: string[];
export const CORE_MODULE_KEYS: string[];
export const SELLABLE_MODULE_KEYS: string[];
export function getModule(key: string): ModuleDef | undefined;
export function resolveEntitlements(licenseState: LicenseState | null): ModuleCard[];
export function normaliseModules(modules: unknown): Set<string>;
export function modulesFromLegacyFeatures(features: unknown): Set<string>;

/* ── licence ───────────────────────────────────────────────────────────── */
export const STRONG_SIGNALS: string[];
export function buildLicense(input: BuildInput): BuildResult;
export function issueLicense(input: BuildInput, privateKey: string | Buffer | object): IssueResult;
export function verifyLicense(file: LicenseFile | string | null | undefined, opts: VerifyOptions): LicenseState;
export function effectiveModules(payload: LicensePayload): string[];

/* ── fingerprint ───────────────────────────────────────────────────────── */
export const STRONG: string[];
export const WEAK: string[];
export const ALL_SIGNALS: string[];
export function collectSignals(env?: NodeJS.ProcessEnv | Record<string, string | undefined>): Record<string, string | undefined>;
export function matchSignals(recorded: Record<string, string>, current?: Record<string, string | undefined>): SignalMatch;
export function shortFingerprint(signals?: Record<string, string | undefined>): string;
export function hasStrongIdentity(signals?: Record<string, string | undefined>): boolean;
