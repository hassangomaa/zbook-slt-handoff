#!/usr/bin/env node
/**
 * slt-license — the command line for licences.
 *
 * Two audiences, one binary, because the customer needs exactly one of these
 * commands and shipping them a second tool to run it would be silly:
 *
 *   CUSTOMER runs, on the machine that will run SLT OCR:
 *     slt-license signals            print this host's hardware signals
 *     slt-license check FILE         does this licence work on THIS machine?
 *
 *   VENDOR runs, on the issuing machine:
 *     slt-license keygen             create the Ed25519 signing key pair
 *     slt-license issue …            issue a signed licence
 *     slt-license verify FILE        verify against the vendor public key
 *
 * `issue` and `keygen` need the private key and are useless without it, so
 * there is no harm in the customer holding the same script.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  generateKeyPair,
  publicKeyFromPrivate,
  issueLicense,
  verifyLicense,
  collectSignals,
  shortFingerprint,
  hasStrongIdentity,
  matchSignals,
  MODULES,
  SELLABLE_MODULE_KEYS,
  METERED_MODULE_KEYS,
  creditUnit,
  resolveEntitlements,
} from "../vendor/slt-license-core/index.mjs";

const argv = process.argv.slice(2);
const cmd = argv[0];

function arg(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : fallback;
}
const flag = (name) => argv.includes(`--${name}`);

function fail(msg, code = 1) {
  console.error(`\nerror: ${msg}\n`);
  process.exit(code);
}

/* ── signals ───────────────────────────────────────────────────────────── */

if (cmd === "signals") {
  const sig = collectSignals();
  const present = Object.entries(sig).filter(([, v]) => v);

  if (flag("json")) {
    // Machine-readable: exactly what gets pasted into the issuer console.
    console.log(JSON.stringify(Object.fromEntries(present), null, 2));
    process.exit(0);
  }

  console.log("\nSLT OCR — hardware signals for this machine\n");
  console.log(JSON.stringify(Object.fromEntries(present), null, 2));
  console.log(`\nfingerprint: ${shortFingerprint(sig)}`);
  console.log(`signals present: ${present.length ? present.map(([k]) => k).join(", ") : "none"}`);

  if (!hasStrongIdentity(sig)) {
    console.log(
      "\nWARNING: this host exposes no strong identity (machine_id or product_uuid).\n" +
      "A licence cannot be safely bound to it — the binding would match any\n" +
      "similar machine. On Linux, make sure /etc/machine-id and /sys/class/dmi\n" +
      "are readable by this process; in Docker, mount /etc/machine-id read-only.",
    );
  }
  console.log("\nSend the JSON block above to your vendor to have a licence issued.\n");
  process.exit(0);
}

/* ── keygen ────────────────────────────────────────────────────────────── */

if (cmd === "keygen") {
  const out = arg("out", "vendor-private.pem");
  if (fs.existsSync(out) && !flag("force")) {
    fail(
      `${out} already exists.\n\n` +
      `       Overwriting the signing key INVALIDATES EVERY LICENCE ALREADY ISSUED,\n` +
      `       including the ones running in customer plants today. If you genuinely\n` +
      `       intend to rotate, move the old key somewhere safe first and pass --force.`,
    );
  }
  const { publicKeyB64, privateKeyPem } = generateKeyPair();
  fs.writeFileSync(out, privateKeyPem, { mode: 0o600 });
  console.log(`\nwrote ${out}  (mode 600)\n`);
  console.log("PRIVATE KEY — vault it. Never commit it, never ship it, never paste it.\n");
  console.log("Public key — bake this into the client build (SLT_LICENSE_PUBKEY / license.ts):\n");
  console.log(publicKeyB64 + "\n");
  process.exit(0);
}

/* ── issue ─────────────────────────────────────────────────────────────── */

if (cmd === "issue") {
  const keyPath = arg("key", process.env.SLT_SIGNING_KEY);
  const licensee = arg("licensee");
  const months = Number(arg("months", "12"));
  const signalsFile = arg("signals-file");
  const out = arg("out");

  if (!keyPath) fail("--key (or SLT_SIGNING_KEY) is required");
  if (!licensee) {
    fail(
      "--licensee is required\n\n" +
      "usage: slt-license issue --key vendor-private.pem --licensee NAME [--months 12]\n" +
      "                         [--signals-file signals.json | --unbound]\n" +
      "                         [--modules a,b,c] [--seats N] [--out FILE]\n\n" +
      `sellable modules: ${SELLABLE_MODULE_KEYS.join(", ")}`,
    );
  }

  let hwsig = null;
  if (signalsFile) {
    try {
      let parsed = JSON.parse(fs.readFileSync(signalsFile, "utf8"));
      if (parsed.signals) parsed = parsed.signals;
      hwsig = Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "string" && v));
    } catch (e) {
      fail(`could not read ${signalsFile}: ${e.message}`);
    }
  }

  const modules = (arg("modules") || SELLABLE_MODULE_KEYS.join(",")).split(",").map((s) => s.trim()).filter(Boolean);

  // Credits are per service and 1-to-1 — one credit is one unit. Repeatable:
  //   --credits extraction_nid=20 --credits classification=10
  const credits = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--credits") continue;
    const [k, v] = String(argv[i + 1] || "").split("=");
    if (k && v) credits[k.trim()] = Number(v);
  }
  const limits = {};
  if (arg("seats")) limits.seats = Number(arg("seats"));
  if (arg("pages-per-month")) limits.pages_per_month = Number(arg("pages-per-month"));

  let privateKeyPem;
  try { privateKeyPem = fs.readFileSync(keyPath, "utf8"); }
  catch (e) { fail(`signing key unreadable: ${e.message}`); }

  const r = issueLicense(
    { licensee, months, modules, credits, limits, hwsig, unbound: flag("unbound"), notes: arg("notes", "") },
    privateKeyPem,
  );
  if (!r.ok) fail(r.errors.map((e) => "  • " + e).join("\n"), 2);

  const text = JSON.stringify(r.file, null, 2);
  if (out) {
    fs.writeFileSync(out, text);
    console.log(`\nwrote ${out}`);
    console.log(`  licence  ${r.payload.id}`);
    console.log(`  licensee ${r.payload.licensee}`);
    console.log(`  expires  ${r.payload.expires.slice(0, 10)}`);
    console.log(`  modules  ${r.payload.modules.join(", ")}`);
    if (r.payload.credits) {
      for (const [k, v] of Object.entries(r.payload.credits)) {
        console.log(`  credits  ${k}: ${v}  (1 credit = ${creditUnit(k)})`);
      }
    }
    if (r.unmetered?.length) {
      console.log(`  UNMETERED ${r.unmetered.join(", ")} — licensed with no credit cap`);
    }
    console.log(`  bound    ${hwsig ? "yes" : "NO — this works on any machine"}\n`);
  } else {
    console.log(text);
  }
  process.exit(0);
}

/* ── verify (vendor) ───────────────────────────────────────────────────── */

if (cmd === "verify") {
  const file = argv[1] || arg("file");
  const pub = arg("pubkey", process.env.SLT_LICENSE_PUBKEY) ||
    (arg("key") ? publicKeyFromPrivate(fs.readFileSync(arg("key"), "utf8")) : null);
  if (!file) fail("usage: slt-license verify FILE [--pubkey B64 | --key vendor-private.pem]");
  if (!pub) fail("need --pubkey or --key to know what to verify against");

  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch (e) { fail(`cannot read ${file}: ${e.message}`); }

  const state = verifyLicense(raw, { publicKeyB64: pub, allowUnbound: true });
  console.log(`\n${state.ok ? "VALID" : "REFUSED"} — ${state.reason.replace(/_/g, " ")}\n`);
  if (state.payload) {
    console.log(`  licence  ${state.payload.id}`);
    console.log(`  licensee ${state.payload.licensee}`);
    console.log(`  expires  ${state.payload.expires.slice(0, 10)}  (${state.daysRemaining} days)`);
    console.log(`  modules  ${(state.modules || []).join(", ") || "none"}`);
    console.log(`  bound    ${state.payload.hwsig || state.payload.fingerprint ? "yes" : "no"}\n`);
  }
  process.exit(state.ok ? 0 : 1);
}

/* ── check (customer) ──────────────────────────────────────────────────── */

if (cmd === "check") {
  const file = argv[1] || arg("file") || process.env.SLT_LICENSE_PATH || "/run/license/slt-ocr.license";
  const pub = arg("pubkey", process.env.SLT_LICENSE_PUBKEY);
  if (!pub) fail("SLT_LICENSE_PUBKEY (or --pubkey) is required — it is printed in the installation guide");

  let raw = null;
  try { raw = fs.readFileSync(file, "utf8"); }
  catch { console.log(`\nNo licence found at ${file}\n`); process.exit(1); }

  const state = verifyLicense(raw, {
    publicKeyB64: pub,
    matchSignals: (rec) => matchSignals(rec),
    allowUnbound: process.env.SLT_ALLOW_UNBOUND === "1",
  });

  console.log(`\nSLT OCR licence — ${file}\n`);
  console.log(`  ${state.ok ? "VALID" : "NOT VALID"} — ${state.reason.replace(/_/g, " ")}`);
  if (state.payload) {
    console.log(`  licensee ${state.payload.licensee}`);
    console.log(`  expires  ${state.payload.expires.slice(0, 10)}  (${state.daysRemaining} days)`);
  }
  if (state.reason === "fingerprint_mismatch") {
    console.log(`\n  This licence is not issued to this machine.`);
    console.log(`  This host's fingerprint: ${shortFingerprint()}`);
    console.log(`  Send that, and the output of \`slt-license signals\`, to your vendor.`);
  }

  console.log("\n  Modules on this installation:\n");
  for (const m of resolveEntitlements(state)) {
    console.log(`   ${m.enabled ? "[x]" : "[ ]"} ${m.name.padEnd(24)} ${m.reason}`);
  }
  console.log("");
  process.exit(state.ok ? 0 : 1);
}

/* ── modules ───────────────────────────────────────────────────────────── */

if (cmd === "modules") {
  console.log("\nSLT OCR modules\n");
  for (const m of MODULES) {
    console.log(`  ${m.key.padEnd(18)} ${m.core ? "[core]    " : "[sellable]"} ${m.name}`);
    console.log(`  ${" ".repeat(18)}            ${m.summary}\n`);
  }
  process.exit(0);
}

console.error(`
slt-license — SLT OCR licensing

  CUSTOMER
    signals [--json]        print this host's hardware signals for the vendor
    check [FILE]            is this licence valid on THIS machine, and what does it unlock

  VENDOR
    keygen [--out FILE]     create the Ed25519 signing key pair
    issue --licensee NAME   issue a signed licence
    verify FILE             verify a licence against the vendor key
    modules                 list the modules a licence can grant
`);
process.exit(2);
