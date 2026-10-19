// `npm run conformance -- --impl ts|"<command>" [--tier 1a,1b,2,3] [--sample N]`: the conformance kit (WP-10.2,
// spec/conformance/PROTOCOL.md). Spawns the implementation's sidecar (`ts`: the TypeScript reference's, over
// @m3a/core), asks it every case of the chosen tiers, and reports per tier and per vector file, naming the first
// failing vector, its case, its field and both values. Exit 0 when every chosen tier is claimed and passes (a tier
// the implementation doesn't claim fails only when --tier names it).
import { join } from "node:path";
import { certify, TIER_NAMES, TIERS, type Tier } from "../../spec/conformance/kit/kit.ts";
import { PROTOCOL, Sidecar } from "../../spec/conformance/kit/wire.ts";
import { finish, fmtMs, parseArgs, ROOT, usage, UsageError, type Parsed, type Report, type Step } from "../run/cli.ts";

const FLAGS = [
  { name: "impl", takesValue: true, help: 'ts (the TypeScript reference) or the command that runs a sidecar, e.g. "target/release/codec --conformance"' },
  { name: "tier", takesValue: true, help: `the tiers, comma-separated (${TIER_NAMES.join(",")}; all by default)` },
  { name: "sample", takesValue: true, help: "at most N clips per vector file: a quick run, not a certification" },
];

let parsed: Parsed, tiers: Tier[], sample: number;
try {
  parsed = parseArgs(process.argv.slice(2), FLAGS);
  if (typeof parsed.flags.impl !== "string") throw new UsageError("--impl is required: ts, or the command that runs your sidecar");
  tiers = (typeof parsed.flags.tier === "string" ? parsed.flags.tier.split(",") : TIER_NAMES) as Tier[];
  const bad = tiers.find((t) => !(t in TIERS));
  if (bad) throw new UsageError(`there is no tier "${bad}"; the tiers are ${TIER_NAMES.join(", ")}`);
  sample = parsed.flags.sample === undefined ? Infinity : Number(parsed.flags.sample);
  if (!(Number.isInteger(sample) && sample > 0) && sample !== Infinity) throw new UsageError("--sample takes a whole number of clips, 1 or more");
} catch (e) {
  usage("conformance", e, FLAGS);
}

const impl = parsed.flags.impl as string, explicit = typeof parsed.flags.tier === "string", t0 = performance.now();
const side = impl === "ts" ? new Sidecar(process.execPath, [join(ROOT, "spec/conformance/adapters/ts.ts")], ROOT) : new Sidecar(impl, undefined, ROOT);
const show = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 100);
/** Print the verdict and exit; `extra` goes into report.json beside the steps (the whole certification). */
function report(r: Omit<Report, "tool" | "warnings" | "ms">, extra: object = {}): never {
  return finish({ tool: "conformance", warnings: [], ms: performance.now() - t0, ...r, ...extra }, parsed);
}

let result: Awaited<ReturnType<typeof certify>>;
try {
  result = await certify((op, fields) => side.ask(op, fields), tiers, sample);
} catch (e) {
  side.close();
  report({ ok: false, verdict: `conformance: ${impl} did not answer hello (${e instanceof Error ? e.message : String(e)})`, steps: [], next: `run the sidecar by hand and send it {"id":1,"op":"hello","protocol":"${PROTOCOL}"} (spec/conformance/PROTOCOL.md)` });
}
side.close();

const steps: Step[] = result.tiers.map((t) => ({
  name: `tier ${t.tier}`,
  ok: t.ok || (!t.claimed && !explicit),
  ms: t.ms,
  summary: !t.claimed
    ? `not claimed: it doesn't answer ${t.missing.join(", ")}`
    : `${t.cases - t.failed} of ${t.cases} cases pass in ${t.vectors.length} vector files` + Object.entries(t.worst).map(([k, v]) => `, worst ${k} ${v.toPrecision(3)}`).join("") + (t.skipped.length ? `; not claimed: ${t.skipped.join(", ")}` : ""),
  detail: t.vectors.filter((v) => v.first).map((v) => `${v.vector}: ${v.failed} of ${v.cases} fail; first ${v.first!.case}: ${v.first!.field}: ours ${show(v.first!.ours)}, want ${show(v.first!.want)}`),
}));
const ran = result.tiers.filter((t) => t.claimed), unclaimed = result.tiers.filter((t) => !t.claimed).map((t) => t.tier);
const failed = result.tiers.find((t) => t.claimed && !t.ok), first = failed?.vectors.find((v) => v.first)?.first;
const ok = ran.length > 0 && steps.every((s) => s.ok), who = `${result.impl.implementation} ${result.impl.version}`;
const plural = (ts: readonly string[]) => `tier${ts.length > 1 ? "s" : ""} ${ts.join(", ")}`;
let verdict: string;
if (ok) {
  const sampled = sample === Infinity ? "certifies" : `passes ${sample} clip(s) a vector file (a sample, not a certification) of`;
  verdict = `conformance: ${who} ${sampled} ${plural(ran.map((t) => t.tier))} (${PROTOCOL}), ${ran.reduce((s, t) => s + t.cases, 0)} cases in ${fmtMs(performance.now() - t0)}${unclaimed.length ? `; not claimed: ${unclaimed.join(", ")}` : ""}`;
} else if (first) verdict = `conformance: ${who} fails tier ${failed!.tier} at ${first.vector}, ${first.case}: ${first.field}: ours ${show(first.ours)}, want ${show(first.want)}`;
else if (failed) verdict = `conformance: ${who} certifies nothing: tier ${failed.tier} ran no cases`;
else verdict = `conformance: ${who} doesn't claim ${plural(unclaimed)}${explicit ? ", which --tier names" : ""}`;
report(
  {
    ok,
    verdict,
    steps,
    next: ok ? "keep the --json report with the release it certifies" : first ? `fix that answer, then rerun --tier ${failed!.tier} (the vectors' shapes: spec/conformance/PROTOCOL.md)` : "answer the ops each tier needs (spec/conformance/PROTOCOL.md)",
  },
  { certification: result },
);
