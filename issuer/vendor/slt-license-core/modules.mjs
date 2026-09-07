/* ────────────────────────────────────────────────────────────────────────
 * VENDORED COPY — DO NOT EDIT.
 *
 * Canonical source: packages/slt-license-core/modules.mjs
 * Regenerate:       node scripts/sync-license-core.mjs
 * Verified by:      node scripts/sync-license-core.mjs --check  (CI gate)
 *
 * An edit here is silently discarded on the next sync, and until then it makes
 * this product disagree with the other one about what a valid licence is.
 * ──────────────────────────────────────────────────────────────────────── */
/**
 * THE MODULE REGISTRY — the contract between the issuer and the client.
 *
 * Every capability the SLT OCR client can sell is one entry here. The issuer
 * offers exactly these when a licence is written; the client gates exactly
 * these when a licence is read. Neither side keeps its own list, because two
 * lists become two different lists the first time one is edited alone.
 *
 * ── The display rule (product owner, 2026-09-05) ─────────────────────────
 * Every module is ALWAYS DISPLAYED in the client, licensed or not. A customer
 * must be able to see what the product does and what their licence covers,
 * side by side, without calling anyone. A module they have not bought shows
 * as locked with the reason — never hidden, never missing.
 *
 * ── The enforcement rule ────────────────────────────────────────────────
 * Displaying a locked module is a UI concern. REFUSING it is a server
 * concern. `requireModule()` on the route is what actually enforces the
 * licence; hiding a card only tidies the screen. A build that hides the card
 * and leaves the route open has not gated anything.
 *
 * ── Adding a module ─────────────────────────────────────────────────────
 * 1. Add the entry here.
 * 2. Call `requireModule('<key>')` in every route that serves it.
 * 3. Run the QC gates. `modules.contract.test.mjs` fails if a module is
 *    declared with no gate, or gated with no declaration.
 *
 * ── Credits: one credit is one unit, per service (rule, 2026-09-05) ─────
 *
 * A metered module declares `creditUnit` — the thing one credit buys. There is
 * NO multiplier and NO shared pool:
 *
 *     extraction_nid   1 credit = one card / one page
 *     classification   1 credit = one contract
 *     bookmarking      1 credit = one document
 *
 * A licence granting 20 extraction_nid and 10 classification credits permits
 * exactly 20 pages and exactly 10 contracts. Spending one must never reduce
 * the other, and exhausting one must never block the other.
 *
 * Why separate pools: a single balance cannot answer "what did I pay for and
 * what have I used". Heavy use of a cheap service silently eats the budget of
 * an expensive one, and the invoice reconciles against nothing. Separate pools
 * make the ledger line and the licence line the same shape, so a billing
 * dispute is settled by reading rather than arguing.
 *
 * A service added later gets its OWN credit line. A service that borrows
 * another's credits is a billing defect, and the customer finds it first.
 */

/** @typedef {'core'|'extraction'|'documents'|'operations'|'integration'} ModuleCategory */

/**
 * @typedef {object} ModuleDef
 * @property {string}  key        Stable identifier. NEVER rename — it is written into issued licences.
 * @property {string}  name       Shown on the dashboard card.
 * @property {string}  summary    One line an operator can act on.
 * @property {ModuleCategory} category
 * @property {boolean} core       true = always available, cannot be sold or withheld.
 * @property {string[]} routes    Client paths this module serves. Used by the QC gate.
 * @property {string[]} apis      API paths this module serves. Used by the QC gate.
 */

/** @type {ModuleDef[]} */
export const MODULES = [
  {
    key: "dashboard",
    name: "Licence dashboard",
    summary:
      "Shows which licence this installation holds and which modules it covers. Always available — it is where a locked module is explained.",
    category: "core",
    core: true,
    routes: ["/app/:locale/dashboard", "/app/:locale/profile"],
    apis: ["/api/app/subscription", "/api/app/license"],
  },
  {
    key: "projects",
    name: "Projects and documents",
    summary:
      "Create a project, upload documents, see their status. The workspace every other module operates inside.",
    category: "core",
    core: true,
    routes: ["/app/:locale/projects"],
    apis: ["/api/app/projects", "/api/app/files"],
  },
  {
    key: "extraction_nid",
    name: "National ID extraction",
    summary:
      "Reads Egyptian national ID cards — number, name, address and the rest of the card — using the YOLO detector and the CRNN recogniser.",
    category: "extraction",
    core: false,
    /** Each page of a national-ID scan costs exactly one credit. A two-page document costs two. */
    creditUnit: "one card / one page",
    routes: ["/app/:locale/extractions"],
    apis: ["/api/app/files/:id/extract", "/api/app/files/bulk-extract"],
  },
  {
    key: "extraction_crn",
    name: "Gas contract CRN / serial",
    summary:
      "Reads the customer reference number and meter serial from scanned gas contracts, including handwritten grid and serial-only layouts.",
    category: "extraction",
    core: false,
    /** Each gas-contract page read costs exactly one credit. */
    creditUnit: "one contract page",
    routes: ["/app/:locale/contracts"],
    apis: ["/api/app/contracts/extract"],
  },
  {
    key: "classification",
    name: "Page classification",
    summary:
      "Sorts a scanned batch into page types before extraction, so the right reader runs on the right page.",
    category: "extraction",
    core: false,
    /** Each contract classified costs exactly one credit, regardless of its page count. */
    creditUnit: "one contract",
    routes: [],
    apis: ["/api/app/classify"],
  },
  {
    key: "bookmarking",
    name: "PDF bookmarking",
    summary:
      "Finds section boundaries in a long scanned PDF and writes real PDF bookmarks, so a 600-page file becomes navigable.",
    category: "documents",
    core: false,
    /** Each PDF bookmarked costs exactly one credit, regardless of its page count. */
    creditUnit: "one document",
    routes: ["/app/:locale/bookmarks"],
    apis: ["/api/documents/bookmark"],
  },
  {
    key: "batch",
    name: "Batch operations",
    summary:
      "Runs a whole folder through the pipeline unattended, with resume after interruption and a per-item audit trail.",
    category: "operations",
    core: false,
    routes: ["/app/:locale/operations"],
    apis: ["/api/batches"],
  },
  {
    key: "records",
    name: "Records archive",
    summary:
      "Every document this installation has processed, searchable, with its extraction result attached.",
    category: "documents",
    core: false,
    routes: ["/app/:locale/records"],
    apis: ["/api/records"],
  },
  {
    key: "workbook_export",
    name: "Workbook export",
    summary:
      "Exports results as the Keys .xlsx workbook in the delivery format, rather than raw JSON.",
    category: "operations",
    core: false,
    routes: [],
    apis: ["/api/app/files/export", "/api/workbook-template", "/api/batches/:id/export"],
  },
  {
    key: "assistant",
    name: "Assistant",
    summary: "Answers questions about the documents in this installation.",
    category: "integration",
    core: false,
    /** Each question answered costs exactly one credit. */
    creditUnit: "one question",
    routes: ["/app/:locale/assistant"],
    apis: ["/api/app/assistant"],
  },
  {
    key: "team",
    name: "Team accounts",
    summary:
      "Sub-accounts for the site team, each with its own sign-in, under one licence.",
    category: "core",
    core: false,
    routes: ["/app/:locale/users"],
    apis: ["/api/app/users/sub-users"],
  },
  {
    key: "audit",
    name: "Activity log",
    summary:
      "Who did what, when. Needed wherever processing personal documents has to be accountable.",
    category: "operations",
    core: false,
    routes: ["/app/:locale/audit-logs"],
    apis: ["/api/app/audit-logs"],
  },
  {
    key: "api_access",
    name: "Programmatic API",
    summary:
      "Lets the customer's own systems submit documents and collect results without the web interface.",
    category: "integration",
    core: false,
    routes: ["/app/:locale/docs"],
    apis: ["/api/v1"],
  },
];

/** Every module key, in registry order. */
export const MODULE_KEYS = MODULES.map((m) => m.key);

/** Keys that are always on and may not be sold or withheld. */
export const CORE_MODULE_KEYS = MODULES.filter((m) => m.core).map((m) => m.key);

/** Keys an issuer may actually put in a licence. */
export const SELLABLE_MODULE_KEYS = MODULES.filter((m) => !m.core).map((m) => m.key);

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

/** @returns {ModuleDef|undefined} */
export function getModule(key) {
  return BY_KEY.get(key);
}

/**
 * Resolve what a licence actually entitles.
 *
 * Returns one entry per module in the registry — never a filtered list —
 * because the dashboard must render every module, including the locked ones.
 *
 * The reasons are ordered deliberately. A licence that is expired or bound to
 * another machine grants nothing at all, and saying "your licence has expired"
 * is more useful than saying "this module is not included", which would send
 * the operator to buy something they already own.
 *
 * @param {object|null} licenseState  Result of verifyLicense(); null when absent.
 * @returns {{key:string,name:string,summary:string,category:string,core:boolean,enabled:boolean,reason:string}[]}
 */
export function resolveEntitlements(licenseState) {
  const ok = Boolean(licenseState?.ok);
  // Prefer the list verifyLicense already resolved — it has folded a
  // pre-registry `features` licence forward onto module keys. Falling straight
  // to payload.modules would silently grant nothing to every install issued
  // before the registry existed.
  const granted = licenseState?.modules
    ? normaliseModules(licenseState.modules)
    : licenseState?.payload?.modules
      ? normaliseModules(licenseState.payload.modules)
      : modulesFromLegacyFeatures(licenseState?.payload?.features);

  return MODULES.map((m) => {
    let enabled;
    let reason;

    if (m.core) {
      // Core modules survive an invalid licence on purpose: the dashboard is
      // how an operator discovers WHY everything else is locked. A product
      // that hides its own explanation when the licence lapses is unusable at
      // exactly the moment somebody needs to read it.
      enabled = true;
      reason = "included in every installation";
    } else if (!licenseState) {
      enabled = false;
      reason = "no licence is installed";
    } else if (!ok) {
      enabled = false;
      reason = licenseReason(licenseState.reason);
    } else if (granted.has(m.key)) {
      enabled = true;
      reason = "covered by your licence";
    } else {
      enabled = false;
      reason = "not included in your licence";
    }

    return {
      key: m.key,
      name: m.name,
      summary: m.summary,
      category: m.category,
      core: m.core,
      enabled,
      reason,
    };
  });
}

/** Human sentence for a verification failure, for the dashboard card. */
function licenseReason(reason) {
  switch (reason) {
    case "missing": return "no licence file is installed";
    case "unreadable": return "the licence file cannot be read";
    case "malformed": return "the licence file is not a valid licence";
    case "bad_signature": return "the licence signature does not verify";
    case "wrong_product": return "this licence is for a different product";
    case "expired": return "your licence has expired";
    case "fingerprint_mismatch": return "this licence is issued to a different machine";
    case "revoked": return "this licence has been revoked";
    default: return "the licence is not valid";
  }
}

/**
 * Accept both shapes a licence may carry its modules in.
 *
 * `modules` is the current form: an array of keys, or an object of
 * key -> boolean. Licences issued before the module registry carried
 * `features: {nid: true, classification: true}` and are mapped forward here so
 * a rotation never bricks a live install.
 *
 * @returns {Set<string>}
 */
export function normaliseModules(modules) {
  const out = new Set();
  if (!modules) return out;
  if (Array.isArray(modules)) {
    for (const k of modules) if (typeof k === "string") out.add(k);
    return out;
  }
  if (typeof modules === "object") {
    for (const [k, v] of Object.entries(modules)) if (v === true) out.add(k);
  }
  return out;
}

/**
 * Map a pre-registry licence's `features` onto module keys.
 *
 * Licences issued before 2026-09-05 carry {nid, classification} and no
 * `modules`. Refusing them would brick every install already in the field, so
 * they are honoured with the modules those flags actually bought.
 */
export function modulesFromLegacyFeatures(features) {
  const out = new Set();
  if (!features || typeof features !== "object") return out;
  if (features.nid === true) out.add("extraction_nid");
  if (features.classification === true) out.add("classification");
  // A legacy licence predates these being separable, and they were shipped as
  // part of the product it paid for.
  out.add("records");
  out.add("workbook_export");
  return out;
}

/** Modules that consume credits. A module with no `creditUnit` is not metered. */
export const METERED_MODULE_KEYS = MODULES.filter((m) => m.creditUnit).map((m) => m.key);

/** What one credit buys for a module, or null when the module is not metered. */
export function creditUnit(key) {
  return BY_KEY.get(key)?.creditUnit ?? null;
}

/**
 * Normalise a licence's credit grants.
 *
 * Accepts `{ extraction_nid: 20, classification: 10 }`. Unknown keys, keys for
 * modules that are not metered, and non-positive numbers are dropped — a
 * licence must never grant credits the client cannot account for.
 *
 * @returns {Record<string, number>}
 */
export function normaliseCredits(credits) {
  const out = {};
  if (!credits || typeof credits !== "object") return out;
  for (const [k, v] of Object.entries(credits)) {
    if (!METERED_MODULE_KEYS.includes(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

/**
 * The credit balance a verified licence grants, per service.
 *
 * A module that is licensed but carries no credit line is UNMETERED for this
 * licence — it works without consuming anything. That is deliberate: an
 * on-premises site licence often sells capability rather than volume, and
 * inventing a zero balance would refuse work the customer has paid for.
 */
export function licensedCredits(payload) {
  return normaliseCredits(payload?.credits);
}
