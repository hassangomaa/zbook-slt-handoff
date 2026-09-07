/* ────────────────────────────────────────────────────────────────────────
 * VENDORED COPY — DO NOT EDIT.
 *
 * Canonical source: packages/slt-license-core/fingerprint.mjs
 * Regenerate:       node scripts/sync-license-core.mjs
 * Verified by:      node scripts/sync-license-core.mjs --check  (CI gate)
 *
 * An edit here is silently discarded on the next sync, and until then it makes
 * this product disagree with the other one about what a valid licence is.
 * ──────────────────────────────────────────────────────────────────────── */
/**
 * Machine identity — collection and quorum matching.
 *
 * Shared so the issuer records signals in exactly the shape the client later
 * compares against. A licence bound with one hashing scheme and verified with
 * another fails on a machine that is in fact the right machine, which is the
 * worst possible failure: it locks out a paying customer and looks like a bug
 * in the product rather than in the binding.
 *
 * ── Why a quorum and not an exact match ─────────────────────────────────
 *
 * Hardware identity drifts. A NIC is replaced, a VM is migrated, systemd
 * regenerates /etc/machine-id after a re-image. An exact match on all signals
 * would lock out a legitimate customer for a maintenance event, and support
 * would end up issuing a fresh licence every time somebody swapped a cable.
 *
 * A quorum tolerates that drift while still refusing a genuinely different
 * machine — a clone shares none of the strong signals. The rule below is:
 *
 *   at least one STRONG signal must match, AND
 *   at least half of the recorded signals must match.
 *
 * Requiring a strong signal is what stops a match on MAC + CPU model alone,
 * which two identical machines from the same batch would both satisfy.
 */
import crypto from "node:crypto";
import os from "node:os";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

/** Signals that identify a specific machine rather than a machine model. */
export const STRONG = ["machine_id", "product_uuid", "board_serial"];

/** Signals that narrow but do not identify. */
export const WEAK = ["mac", "cpu", "instance_id"];

export const ALL_SIGNALS = [...STRONG, ...WEAK];

/** Hash a raw signal. Salted per-signal so one value cannot be replayed as another. */
function h(kind, value) {
  if (!value) return undefined;
  return crypto
    .createHash("sha256")
    .update(`slt-ocr:${kind}:${String(value).trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

function readFirst(paths) {
  for (const p of paths) {
    try {
      const v = fs.readFileSync(p, "utf8").trim();
      if (v) return v;
    } catch { /* next */ }
  }
  return "";
}

function cmd(bin, args) {
  try {
    return execFileSync(bin, args, { encoding: "utf8", timeout: 4000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/**
 * Collect this host's signals, hashed.
 *
 * Every branch is best-effort: a container without DMI access simply yields
 * fewer signals, and the issuer refuses to bind rather than binding to
 * something weak. Silence is better than a false identity.
 */
export function collectSignals(env = process.env) {
  const platform = os.platform();
  let machineId = "";
  let productUuid = "";
  let boardSerial = "";

  if (platform === "linux") {
    machineId = readFirst(["/etc/machine-id", "/var/lib/dbus/machine-id"]);
    productUuid = readFirst(["/sys/class/dmi/id/product_uuid"]);
    boardSerial = readFirst(["/sys/class/dmi/id/board_serial", "/sys/class/dmi/id/product_serial"]);
  } else if (platform === "win32") {
    // `wmic` is absent on recent Windows; PowerShell CIM is the supported path.
    productUuid = cmd("powershell", ["-NoProfile", "-Command", "(Get-CimInstance Win32_ComputerSystemProduct).UUID"]);
    boardSerial = cmd("powershell", ["-NoProfile", "-Command", "(Get-CimInstance Win32_BaseBoard).SerialNumber"]);
    machineId = cmd("powershell", ["-NoProfile", "-Command", "(Get-ItemProperty 'HKLM:/SOFTWARE/Microsoft/Cryptography').MachineGuid"]);
  } else if (platform === "darwin") {
    const out = cmd("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"]);
    productUuid = (out.match(/IOPlatformUUID"\s*=\s*"([^"]+)"/) || [])[1] || "";
    boardSerial = (out.match(/IOPlatformSerialNumber"\s*=\s*"([^"]+)"/) || [])[1] || "";
    machineId = productUuid;
  }

  const mac = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && !n.internal && n.mac && n.mac !== "00:00:00:00:00:00")
    .map((n) => n.mac)
    .sort()[0] || "";

  const cpuModel = (os.cpus()[0]?.model || "") + `:${os.cpus().length}`;

  return {
    machine_id: h("machine_id", machineId),
    product_uuid: h("product_uuid", productUuid),
    board_serial: h("board_serial", boardSerial),
    mac: h("mac", mac),
    cpu: h("cpu", cpuModel),
    instance_id: h("instance_id", env.INSTANCE_ID || ""),
  };
}

/**
 * Compare recorded signals against this host.
 *
 * @param {object} recorded  hwsig from the licence.
 * @param {object} [current] Defaults to this host's signals.
 * @returns {{matched:boolean,score:number,max:number,ratio:number,matchedKeys:string[],strongMatched:string[],presentKeys:string[]}}
 */
export function matchSignals(recorded, current = collectSignals()) {
  const present = ALL_SIGNALS.filter((k) => recorded && recorded[k]);
  const matchedKeys = present.filter((k) => current[k] && current[k] === recorded[k]);
  const strongMatched = matchedKeys.filter((k) => STRONG.includes(k));

  const max = present.length;
  const score = matchedKeys.length;
  const ratio = max ? score / max : 0;

  // A licence recording no signals at all is unbound; that decision belongs to
  // the caller (allowUnbound), not here.
  const matched = max === 0 ? false : strongMatched.length >= 1 && ratio >= 0.5;

  return { matched, score, max, ratio, matchedKeys, strongMatched, presentKeys: present };
}

/**
 * A short, human-quotable identifier for this host.
 *
 * Printed when the client refuses to start, so the operator can send the
 * vendor one line instead of a JSON blob.
 */
export function shortFingerprint(signals = collectSignals()) {
  const basis = ALL_SIGNALS.map((k) => `${k}=${signals[k] || ""}`).join("|");
  return crypto.createHash("sha256").update(basis).digest("hex").slice(0, 16);
}

/** True when this host can be bound at all. */
export function hasStrongIdentity(signals = collectSignals()) {
  return STRONG.some((k) => signals[k]);
}
