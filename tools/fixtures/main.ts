// `npm run fixtures -- fetch [--manifest <file>] [--check] | check [--manifest <file>] | heldout <gate>` (PLAN.md
// WP-4.2): the real CC0 rigs, fetched by SHA-256 into .cache/fixtures/ with their license files, never committed.
// `fetch` downloads what the cache lacks (--check then checks the cache); `check` reads the cache alone. --manifest names
// another manifest (a gate's held-out rig, a benchmark variant's), fetched and verified the same way. `heldout G4` says
// whether the gate's latest held-out run is fit for a gate run (D57): unused, its license pinned, its rig cached.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { closest, finish, fmtMs, parseArgs, usage, type Report, type Step } from "../run/cli.ts";
import { checkRigs, fetchRigs, freshHeldout, lintManifest, MANIFEST, type Manifest } from "./fixtures.ts";

if (import.meta.main) {
  const specs = [
    { name: "manifest", takesValue: true, help: "the manifest to read (tools/fixtures/rigs.json by default)" },
    { name: "check", help: "after fetching, check the cache against the manifest" },
  ];
  let parsed;
  const verbs = ["fetch", "check", "heldout"];
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    const v = parsed.positionals[0];
    if (!v || !verbs.includes(v)) throw new Error(`expected one of ${verbs.join(", ")}${v ? `, got "${v}"; did you mean ${closest(v, verbs)}?` : ""}`);
  } catch (err) {
    usage("fixtures", err, specs);
  }
  if (parsed.positionals[0] === "heldout") {
    const gate = parsed.positionals[1] ?? "", t0 = performance.now(), h = freshHeldout(gate), ok = h.problems.length === 0, ms = performance.now() - t0;
    finish({ tool: "fixtures", ok, verdict: `fixtures heldout ${gate}: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)}`, steps: [{ name: "heldout", ok, ms, summary: ok ? `${h.run} is fresh: no gate run used it, its rigs pinned and cached` : `${h.problems.length} problem(s) with ${h.run ?? "the held-out run"}`, detail: h.problems }], warnings: [], ms, next: ok ? `npm run gate -- ${gate}` : "a fresh subagent writes the next held-out run (PLAN.md §7); fetch its rig, then rerun" }, parsed);
  }
  const path = typeof parsed.flags.manifest === "string" ? resolve(parsed.flags.manifest) : MANIFEST;
  const m = JSON.parse(readFileSync(path, "utf8")) as Manifest, t0 = performance.now(), steps: Step[] = [];
  const bad = lintManifest(m);
  steps.push({ name: "manifest", ok: bad.length === 0, ms: 0, summary: bad.length ? `${bad.length} problem(s) in ${path}` : `${m.rigs.length} rigs in ${path}`, detail: bad });
  const line = (s: { id: string; how: string; why?: string }) => `${s.id}: ${s.how}${s.why ? `, ${s.why}` : ""}`;
  if (!bad.length && parsed.positionals[0] === "fetch") {
    const s0 = performance.now(), got = fetchRigs(m);
    steps.push({ name: "fetch", ok: got.every((s) => s.ok), ms: performance.now() - s0, summary: `${got.filter((s) => s.how === "fetched").length} fetched, ${got.filter((s) => s.how === "cached").length} cached, ${got.filter((s) => !s.ok).length} failed`, detail: got.filter((s) => !s.ok).map(line) });
  }
  if (!bad.length && (parsed.positionals[0] === "check" || parsed.flags.check)) {
    const got = checkRigs(m);
    steps.push({ name: "check", ok: got.every((s) => s.ok), ms: 0, summary: `${got.filter((s) => s.ok).length} of ${got.length} rigs in the cache, each matching its SHA-256 and its license`, detail: got.filter((s) => !s.ok).map(line) });
  }
  const ms = performance.now() - t0, ok = steps.every((s) => s.ok);
  const report: Report = { tool: "fixtures", ok, verdict: `fixtures ${parsed.positionals[0]}: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)}`, steps, warnings: [], ms, next: ok ? "npm test -- test-characters" : "fix the listed rigs (a changed file needs a new hash in its manifest, in a commit that says why)" };
  finish(report, parsed);
}
