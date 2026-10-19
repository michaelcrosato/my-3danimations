// The QA run (WP-3.3): each clip's row carries its verdict's text and its findings with their times and repairs; the
// distributions have a capture group; the committed baseline holds every clip's readings and a run names what it
// changed; `npm run qa -- --dist` prints the distributions, and --json writes the run's report beside the clips' rows
// instead of over them; the verdicts line names the metrics that fail most; --fix lints and fixes clips (WP-3.5), none
// coming out worse or invalid.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ROOT } from "../run/cli.ts";
import { fix } from "@m3a/sensors";
import { BASELINE, baselineOf, CAPTURE, compare, distributions, fixAll, libraryClips, qa, worse, type LibraryClip } from "./qa.ts";

/** The library, read once for this file (on first use); each test picks copies of its clips, as a read of its own gave. */
let library: LibraryClip[] | undefined;
const all = () => (library ??= libraryClips());
const pick = (ids: string[]) => structuredClone(all().filter((c) => ids.includes(c.clip.id)));

describe("the QA rows and distributions", () => {
  it("carry each clip's verdict text and findings with times and repairs", () => {
    const [row] = qa(pick(["QUATERNIUS_3D2DGE/Walk_Loop"]));
    expect(row!.text.split("\n")[0]).toMatch(/^QUATERNIUS_3D2DGE\/Walk_Loop: (PASS|WARN|FAIL)/);
    expect(row!.findings.length).toBeGreaterThan(0);
    for (const f of row!.findings) expect([typeof f.t0, typeof f.t1, f.message]).toEqual(["number", "number", expect.stringMatching(/: .+ \(fix: |: [a-z]/)]);
    expect(Object.values(row!.counts).reduce((a, b) => a + b, 0)).toBe(row!.findings.length);
  });
  it("group real capture's clips as 'capture'", () => {
    const rows = qa(pick(["CMU_CURATED/Walk_Loop", "STYLE100/Neutral_Walk", "QUATERNIUS_3D2DGE/Walk_Loop"]));
    const d = distributions(rows);
    expect(CAPTURE).toEqual(["CMU_CURATED", "STYLE100"]);
    expect([d.all!.slide.n, d.capture!.slide.n, d.STYLE100!.slide.n]).toEqual([3, 2, 1]);
  });
});

describe("the committed baseline", () => {
  it("holds every clip's verdict, values and finding counts, and names what a run changed", () => {
    const rows = qa(pick(["QUATERNIUS_3D2DGE/Walk_Loop", "STYLE100/Neutral_Walk"])), base = baselineOf(rows);
    expect(compare(base, rows, true)).toEqual([]);
    const moved = structuredClone(base);
    moved["QUATERNIUS_3D2DGE/Walk_Loop"]!.values.slide = 999;
    moved["QUATERNIUS_3D2DGE/Walk_Loop"]!.verdict = "pass";
    delete moved["STYLE100/Neutral_Walk"];
    expect(compare(moved, rows, true)).toEqual([expect.stringMatching(/^QUATERNIUS_3D2DGE\/Walk_Loop: pass → (warn|fail)$/), expect.stringMatching(/^QUATERNIUS_3D2DGE\/Walk_Loop: slide 999 → [\d.]+$/), "STYLE100/Neutral_Walk: not in the baseline"]);
    const committed = JSON.parse(readFileSync(join(ROOT, BASELINE), "utf8")) as { clips: Record<string, unknown> };
    expect(Object.keys(committed.clips)).toHaveLength(all().length);
  });
});

describe("lint and fix over clips", () => {
  it("fixes the clips lint flags, none worse, every one valid, and says which steps it held back", () => {
    const rows = fixAll(pick(["MESH2MOTION/Swim_Fwd", "QUATERNIUS_3D2DGE/Swim_Fwd_Loop", "STYLE100/InTheDark_Walk", "MESH2MOTION/Run_Anime", "QUATERNIUS_3D2DGE/Walk_Loop"]));
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const r of rows) expect([r.clip, worse(r), r.errors], r.clip).toEqual([r.clip, false, []]);
    expect(rows.some((r) => r.after.findings < r.before.findings)).toBe(true);
    for (const r of rows) for (const x of r.rejected) expect(x).toMatch(/^\w+: \w+ [\d.]+ → [\d.]+, past its (warn|fail) level/);
  }, 60_000);
});

describe("lint and fix over clips, caught out", () => {
  it("flags a fixed clip that comes out invalid, or with a worse verdict or more findings", () => {
    const clips = pick(["MESH2MOTION/Swim_Fwd"]);
    const nan: typeof fix = (clip, R) => ({ ...fix(clip, R), clip: { ...clip, keys: clip.keys.map((k, i) => (i === 1 ? { ...k, head: [Number.NaN, 0, 0] } : k)) } });
    const [bad] = fixAll(clips, nan);
    expect(bad!.errors.length).toBeGreaterThan(0);
    const more: typeof fix = (clip, R) => {
      const out = fix(clip, R);
      return { ...out, after: { ...out.after, findings: [...out.before.findings, ...out.before.findings] } };
    };
    expect(worse(fixAll(clips, more)[0]!)).toBe(true);
    const fails: typeof fix = (clip, R) => {
      const out = fix(clip, R);
      return { ...out, after: { ...out.after, verdict: "fail", findings: [] } };
    };
    expect(worse({ ...fixAll(clips, fails)[0]!, before: { verdict: "warn", findings: 3 } })).toBe(true);
  });
});

describe("npm run qa", () => {
  // the run writes into a scratch check-output, so a test never replaces the files a person's run left (D118)
  const scratch = mkdtempSync(join(tmpdir(), "m3a-qa-"));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));
  const run = (...args: string[]) => execFileSync(process.execPath, [join(ROOT, "tools/qa/main.ts"), ...args], { cwd: ROOT, encoding: "utf8", env: { ...process.env, M3A_CHECK_OUTPUT: scratch } });
  it("prints the distributions with --dist, and --json keeps the clips' rows; names the metrics that fail most", () => {
    const out = run("--clip", "CMU_CURATED/Walk_Loop", "--dist", "--json");
    expect(out).toMatch(/^ {2}slide: capture [\d.]+ \/ [\d.]+ \/ [\d.]+ \/ [\d.]+ \/ [\d.]+ \(n 1\); all /m);
    expect(out).toMatch(/^ {2}skate: capture /m);
    const clips = JSON.parse(readFileSync(join(scratch, "qa/clips.json"), "utf8"));
    expect(clips.rows.map((r: { clip: string }) => r.clip)).toEqual(["CMU_CURATED/Walk_Loop"]);
    expect(clips.distributions.capture.slide.n).toBe(1);
    expect(JSON.parse(readFileSync(join(scratch, "qa/report.json"), "utf8")).tool).toBe("qa");
    // the verdicts line names the metrics that fail most
    expect(run("--clip", "CMU_CURATED/Backflip")).toMatch(/verdicts .*: 0 pass, 0 warn, 1 fail; failing most: \w+ 1/);
  });
});
