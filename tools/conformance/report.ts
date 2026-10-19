// The conformance CLI's parts (tools/conformance/main.ts): the tiers and the deadline it takes on its command line, a
// value as its verdict prints it, and the checkout a certification names (the repository's version and commit), so
// report.json says which kit and which vectors certified an implementation.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TIER_NAMES, TIERS, type Tier } from "../../spec/conformance/kit/kit.ts";
import { line, TIMEOUT_S } from "../../spec/conformance/kit/wire.ts";
import { UsageError } from "../run/cli.ts";

/** The tiers `--tier` names, comma-separated, each once in the order given; every tier when the flag is absent. */
export function tierList(flag: string | boolean | undefined): Tier[] {
  if (flag === undefined) return [...TIER_NAMES];
  const names = typeof flag === "string" ? flag.split(",").map((t) => t.trim()) : [""];
  const bad = names.find((t) => !Object.hasOwn(TIERS, t));
  if (bad !== undefined) throw new UsageError(`${bad ? `there is no tier "${bad}"` : `--tier ${JSON.stringify(flag)} has an empty tier name`}; the tiers are ${TIER_NAMES.join(", ")}`);
  return [...new Set(names)] as Tier[];
}

/** The seconds `--timeout` gives each request to be answered: TIMEOUT_S when absent, else more than 0 and at most a day. */
export function timeoutOf(flag: string | boolean | undefined): number {
  if (flag === undefined) return TIMEOUT_S;
  const s = Number(flag);
  if (typeof flag !== "string" || !flag.trim() || !(s > 0 && s <= 86_400)) throw new UsageError(`--timeout takes the seconds each answer may take, more than 0 and at most 86400 (${TIMEOUT_S} by default), not ${String(flag)}`);
  return s;
}

/** A value as the verdict prints it, at most 100 characters: a string as it is, "nothing" for no value, anything else
 *  as the wire writes it (so -0 reads -0); never throws, whatever the answer held. */
export function show(v: unknown): string {
  let s: string;
  if (typeof v === "string") s = v;
  else if (v === undefined) s = "nothing";
  else {
    try {
      s = typeof v === "function" || typeof v === "symbol" ? String(v) : line(v);
    } catch {
      s = String(v);
    }
  }
  return s.slice(0, 100);
}

/** The checkout a certification is made from: the repository's version and its commit, "-dirty" when the kit or the
 *  vectors differ from it ("unknown" outside git). */
export function checkout(root: string): { version: string; commit: string } {
  const version = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version;
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  let commit = "unknown";
  try {
    commit = git("rev-parse", "HEAD") + (git("status", "--porcelain", "--", "spec/vectors", "spec/conformance", "tools/conformance") ? "-dirty" : "");
  } catch {
    // not a git checkout: the manifest's SHA-256 still names the vectors
  }
  return { version, commit };
}
