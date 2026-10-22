// Library QA (WP-5.8): a clip's verdict as its writer records it (pass, or baselined with a reason that names the level
// and the metrics past it, then the hand reason for a metric, its set's, the warn level's, or how it stands to its
// source, and the metrics its tags turn off); the check compares each clip's whole reason with what the reasons file and
// its writer give and names one whose finding (or whose set's fail) is gone; the reasons and the record are checked
// against their schemas; the census reads a category from the tags and counts copies by `orig`, re-exports (by name,
// or by pose at the re-export's rate) and near-duplicates by pose (still poses whatever their length) once; its floors
// are PLAN.md's; the record of the distributions may only improve, and a floor short is named; the summary lists them;
// the float check finds an upright body off the floor for a second or more, unless its tags put it in the air or the
// reasons answer it; the off-feet check names a loop with no contact that its tags don't put off its feet or the
// reasons don't answer (D104), and an answer whose loop has contacts or sits in the field its loop doesn't need (D108);
// the still check names a clip that never moves that its tags don't call a pose and the reasons don't answer, and an
// answer whose clip moves or is tagged a pose (F.13).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { metrics, checks, type Report } from "@m3a/sensors";
import type { Clip } from "@m3a/core";
import { ROOT } from "../run/cli.ts";
import { CATEGORIES, categoryOf, census, type Census } from "./census.ts";
import { againstRecord, checkFloats, checkOffFeet, checkStill, checkVerdicts, contextsOf, DISTRIBUTIONS, FLOAT, floatOf, floorsMissed, libraryDoc, offFeetStep, reachOf, recordOf, recordProblems, STILL, stillStep, UNIQUE_FLOOR, type Recorded } from "./library.ts";
import { libraryClips, qa, sample, type LibraryClip } from "./qa.ts";
import { QA_REASONS, qualityOf, readReasons, reasonOf, reasonsProblems, type QaReasons } from "./verdict.ts";

const all = libraryClips(), lib = sample(all, 24);
const reasons: QaReasons = { warn: "short of every fail level", sets: { SOME_SET: "the set's reason" }, clips: { "A_SET/Hang": { penetration: "it hangs" } } };
const finding = (metric: string, level: "warn" | "fail") => ({ metric, level }) as unknown as checks.Finding;
const report = (verdict: Report["verdict"], f: checks.Finding[], off: string[] = []) => ({ verdict, findings: f, off }) as unknown as Report;
const stub = (id: string, method = "captured") => ({ id, provenance: { method }, quality: { fit: [12, 80], qa: "unchecked", qaVersion: "none" } }) as unknown as Clip;
const schema = (f: string) => new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(join(import.meta.dirname, f), "utf8")) as object);

describe("a clip's recorded verdict", () => {
  it("is pass when the sensors pass it, read with their revision, its fit kept", () => {
    const passing = lib.find((c) => metrics(c.clip, c.rest).verdict === "pass")!;
    expect(qualityOf(passing.clip, passing.rest, reasons)).toEqual({ fit: passing.clip.quality.fit, qa: "pass", qaVersion: checks.QA_VERSION });
  });
  it("is baselined with a reason: the level and the metrics past it, then why, then what its tags turn off", () => {
    const r = report("fail", [finding("twistFlip", "fail"), finding("penetration", "fail"), finding("pop", "warn")]);
    // a hand reason for one metric, the source for the rest
    expect(reasonOf(stub("A_SET/Hang"), r, reasons, { unrepaired: "no step makes it better" })).toBe("fail on penetration, twistFlip: penetration: it hangs; twistFlip: as captured, fitted within 12 mm of it on average; the sensors' fix: no step makes it better");
    // its set's reason, ahead of the source's
    expect(reasonOf(stub("SOME_SET/X"), r, reasons)).toBe("fail on penetration, twistFlip: the set's reason");
    // a warn: short of every fail level, and the metrics its profile turns off named
    expect(reasonOf(stub("OTHER/X"), report("warn", [finding("jitter", "warn")], ["intersection", "bodyPenetration"]), reasons)).toBe("warn on jitter: short of every fail level; not measured for its tags: bodyPenetration, intersection");
    // keyed, repaired and still failing; the migrated version kept
    expect(reasonOf(stub("OTHER/X", "keyed"), report("fail", [finding("pop", "fail")]), reasons, { repaired: ["jitter"] })).toBe("fail on pop: as keyed in its source, fitted within 12 mm of it on average; repaired (jitter), and still past it");
    expect(reasonOf(stub("OTHER/X"), report("fail", [finding("pop", "fail")]), reasons, { migrated: "the sensors judge the re-import worse (warn → fail)" })).toMatch(/; kept as migrated: the sensors judge the re-import worse \(warn → fail\)$/);
    const flagged = lib.find((c) => metrics(c.clip, c.rest).verdict !== "pass")!, q = qualityOf(flagged.clip, flagged.rest, reasons);
    expect([q.qa, q.baseline]).toEqual(["baselined", expect.stringMatching(/^(warn|fail) on \w+/)]);
  });
  it("is checked against the sensors and the reasons: another revision, a verdict they no longer give, a reason they no longer write", () => {
    const rows = qa(lib), real = readReasons(), ctx = contextsOf();
    expect(checkVerdicts(lib, rows, real, ctx)).toEqual({ problems: [], gone: expect.any(Array) });
    const i = rows.findIndex((r) => r.verdict !== "pass"), j = rows.findIndex((r) => r.verdict === "pass"), k = rows.findIndex((r, n) => r.verdict !== "pass" && n !== i);
    const edited = lib.map((c, n): LibraryClip => (n === i ? { ...c, clip: { ...c.clip, quality: { ...c.clip.quality, qa: "pass", baseline: undefined } } } : n === j ? { ...c, clip: { ...c.clip, quality: { ...c.clip.quality, qaVersion: "m3a-sensors@0" } } } : n === k ? { ...c, clip: { ...c.clip, quality: { ...c.clip.quality, baseline: `${c.clip.quality.baseline}, edited` } } } : c));
    const r = checkVerdicts(edited, rows, { ...real, clips: { ...real.clips, ...reasons.clips }, sets: { ...real.sets, ...reasons.sets } }, ctx);
    expect(r.problems.sort()).toEqual([`${lib[j]!.clip.id}: its verdict was read with m3a-sensors@0, not ${checks.QA_VERSION}`, `${lib[i]!.clip.id}: recorded pass, the sensors give ${rows[i]!.verdict}`, `${lib[k]!.clip.id}: its reason isn't what library/baselines/qa.json and its writer give now`].sort());
    // a hand reason whose clip is gone, a set reason whose set has no clip that fails
    expect(r.gone).toEqual(expect.arrayContaining(["A_SET/Hang penetration", "SOME_SET (no clip in it fails)"]));
  });
  it("reads only reasons and records of the shape their schemas give", () => {
    const qaSchema = schema("qa.schema.json"), distSchema = schema("distributions.schema.json");
    const file = JSON.parse(readFileSync(QA_REASONS, "utf8")) as unknown, rec = JSON.parse(readFileSync(DISTRIBUTIONS, "utf8")) as unknown;
    expect([qaSchema(file) ? [] : qaSchema.errors, reasonsProblems(file)]).toEqual([[], []]);
    expect([distSchema(rec) ? [] : distSchema.errors, recordProblems(rec)]).toEqual([[], []]);
    // a reasons file without its warn reason, a set's reason that isn't text, a clip that isn't an id
    expect(reasonsProblems({ sets: { S: 3 }, clips: { nope: { pop: "x" } } })).toEqual(["warn is the reason a warn is kept, a text", "sets maps a set to its reason, a text", '"nope" is not a clip id']);
    expect(qaSchema({ sets: {}, clips: {} })).toBe(false);
    expect(reasonsProblems({ warn: "w", sets: {}, clips: {}, floats: { "A/B": "" } })).toEqual(["floats maps a clip id to why it stands off the floor, a text"]);
    // a clip whose slug has a hyphen, as the format allows (spec/MOTION.md §11), is a clip id in every field
    const blast = "MESH2MOTION/Two-hand_Blast", hyphen = { ...reasons, clips: { [blast]: { slide: "r" } }, floats: { [blast]: "r" }, offFeet: { [blast]: "r" }, unplanted: { [blast]: "r" } };
    expect([reasonsProblems(hyphen), qaSchema(hyphen)]).toEqual([[], true]);
    expect(recordProblems({ verdicts: { pass: 1, warn: -1, fail: 0 }, metrics: { slide: { p50: 1 } } })).toEqual(["verdicts counts pass, warn and fail", "metrics gives each metric's p50, p95 and max"]);
  });
});

describe("the census", () => {
  it("reads a clip's category from its tags, the first that takes it", () => {
    expect(["walk hurt", "hurt", "sword idle", "throw sport", "jump run", "idle style", "reference"].map((t) => categoryOf(t.split(" ")))).toEqual(["locomotion", "reactions", "combat", "work", "traversal", "idles", "other"]);
  });
  it("counts a copy by orig, a re-export and a near-duplicate by pose once, and the CC0 pack's apart", () => {
    const [a, b] = [lib[0]!, lib.find((c) => c.clip.dur > lib[0]!.clip.dur * 1.5 || c.clip.dur < lib[0]!.clip.dur / 1.5)!];
    const as = (c: LibraryClip, set: string, edit: (x: Clip) => Clip = (x) => x): LibraryClip => ({ ...c, set, clip: edit({ ...c.clip, id: `${set}/${c.clip.id.split("/")[1]}` }) });
    const copy = as(a, "COPIES", (x) => ({ ...x, provenance: { ...x.provenance, orig: a.clip.id } }));
    const exported = as(a, "EXPORTS");
    const near = as(a, "NEAR", (x) => ({ ...x, id: "NEAR/Other_Name", provenance: { ...x.provenance, src: "ELSEWHERE" }, keys: x.keys.map((k) => ({ ...k, hips: [k.hips[0]! + 0.5, k.hips[1]!, k.hips[2]!] })) as never }));
    const c = census([a, b, copy, exported, near], new Set(["NEAR"]));
    expect([c.clips, c.unique, c.cc0]).toEqual([5, 2, 1]);
    expect([c.same[copy.clip.id]!.kind, c.same[copy.clip.id]!.why]).toEqual(["orig", `a copy of ${a.clip.id} (its orig)`]);
    expect(c.same[exported.clip.id]!.why).toBe(`the same animation of ${a.clip.provenance.src} as ${a.clip.id}`);
    // the near-duplicate in the CC0 set is the one that counts
    expect([c.same["NEAR/Other_Name"], c.same[a.clip.id]!.as]).toEqual([undefined, "NEAR/Other_Name"]);
  });
  it("finds a re-export without an orig by pose at its own rate, and counts two held poses once whatever their lengths", () => {
    // (copies of the file's library read, as a read of its own gave them: their rest shared, as their set's)
    const [o, other] = structuredClone(["QUATERNIUS_SHARDFALL/Death01", "QUATERNIUS_SHARDFALL/Hit_Head"].map((id) => all.find((c) => c.clip.id === id)!)) as [LibraryClip, LibraryClip];
    // the original played at 0.8 of its speed: 25% longer, keys stretched, under the re-export source's name
    const slowed: LibraryClip = { ...o, set: "MESH2MOTION", clip: { ...o.clip, id: "MESH2MOTION/Slowed", dur: Math.round(o.clip.dur * 1250) / 1000, provenance: { ...o.clip.provenance, src: "M2M_QUATERNIUS" }, keys: o.clip.keys.map((k) => ({ ...k, t: Math.round(k.t * 1250) / 1000 })) } };
    const c = census([o, other, slowed], new Set(["QUATERNIUS_SHARDFALL", "MESH2MOTION"]));
    expect([c.unique, c.same["MESH2MOTION/Slowed"]?.as, c.same["MESH2MOTION/Slowed"]?.kind]).toEqual([2, o.clip.id, "export"]);
    expect(c.same["MESH2MOTION/Slowed"]!.why).toMatch(/played at 0\.8 of its speed/);
    // one key held for 1 s, and the same pose held as a 4 s loop
    const pose = { ...lib[0]!.clip.keys[0]!, t: 0 }, held = (id: string, dur: number, loop: boolean): LibraryClip => ({ ...lib[0]!, set: "HELD", clip: { ...lib[0]!.clip, id, dur, loop, keys: [pose, { ...pose, t: dur }] } });
    expect(census([held("HELD/A", 1, false), held("HELD/B", 4, true)], new Set()).unique).toBe(1);
  });
  it("keeps G5's floors as PLAN.md gives them", () => {
    const plan = readFileSync(join(ROOT, "PLAN.md"), "utf8"), g5 = plan.slice(plan.indexOf("- **G5 The payload:**"), plan.indexOf("- **G6 Composition:**"));
    expect(g5).toContain(`**at least ${UNIQUE_FLOOR.toLocaleString("en-US")} unique motions,**`);
    for (const c of CATEGORIES) expect(g5, c.name).toMatch(new RegExp(`- ${c.label.replace(/[()]/g, "\\$&")} ${c.floor}\\b`));
  });
  it("names a floor short", () => {
    const c = { unique: 900, categories: Object.fromEntries(["reactions", "combat", "traversal", "locomotion", "work", "gestures", "idles"].map((k) => [k, { unique: k === "combat" ? 10 : 500 }])) } as unknown as Census;
    expect(floorsMissed(c)).toEqual(["900 unique motions, G5 asks 1000", "combat: 10 unique, its floor 60"]);
  });
  it("is summed up in docs/LIBRARY.md: every set, every category against its floor, every metric", () => {
    const rows = qa(lib), c = census(lib, new Set(["MESH2MOTION"])), sets = Object.fromEntries([...new Set(lib.map((x) => x.set))].map((s) => [s, { title: s.toLowerCase(), tier: s === "MESH2MOTION" ? "cc0" : "cc-by", licenses: ["CC0-1.0"] }]));
    const doc = libraryDoc(lib, rows, c, sets);
    for (const s of Object.keys(sets)) expect(doc).toContain(`| ${s} | ${s.toLowerCase()} |`);
    for (const k of CATEGORIES) expect(doc).toMatch(new RegExp(`\\| ${k.label.replace(/[()]/g, "\\$&")} \\| ${k.floor} \\| \\d+ \\| \\d+ \\| \\d+ \\| (met|\\*\\*short\\*\\*) \\|`));
    expect(doc).toContain(`${c.clips} clips in ${Object.keys(sets).length} sets: **${c.unique} unique motions**`);
    expect(doc).toMatch(/\| slide \| 150 \| 230 \|/);
  });
});

describe("the recorded distributions", () => {
  it("may only improve: more fails or a higher spread is worse, the opposite better", () => {
    const now = recordOf(qa(lib)), worse: Recorded = { ...now, verdicts: { ...now.verdicts, fail: now.verdicts.fail + 1 }, metrics: { ...now.metrics, slide: { ...now.metrics.slide!, max: now.metrics.slide!.max / 2 } } };
    expect(againstRecord(now, now)).toEqual({ worse: [], better: [] });
    expect(againstRecord(now, worse).worse).toEqual([`${now.verdicts.fail + 1} clips fail, ${now.verdicts.fail} recorded`, `${now.verdicts.warn + now.verdicts.fail + 1} clips flagged, ${now.verdicts.warn + now.verdicts.fail} recorded`]);
    expect(againstRecord(worse, now).worse).toEqual([`slide max ${now.metrics.slide!.max / 2} → ${now.metrics.slide!.max}`]);
  });
});

describe("the float check", () => {
  // Chop_Wood stands upright and flat-footed throughout; lifted by its hips' `up` (% of H0) it floats
  const chop = all.find((c) => c.clip.id === "CMU_CURATED/Chop_Wood")!;
  const lifted = (by: number, tags = chop.clip.tags): LibraryClip => ({ ...chop, clip: { ...chop.clip, tags, keys: chop.clip.keys.map((k) => ({ ...k, hips: [k.hips[0]!, k.hips[1]!, k.hips[2]! + by] })) } });
  it("finds an upright body with both soles off the floor for a second or more, unless its tags put it in the air", () => {
    expect(floatOf(chop.clip, chop.rest)).toBeNull();
    expect(floatOf(lifted(2).clip, chop.rest)).toBeNull();
    const f = floatOf(lifted(12).clip, chop.rest)!;
    expect([f.at, f.for]).toEqual([0, chop.clip.dur]);
    expect(f.mm).toBeGreaterThan(FLOAT.above * chop.rest.H0);
    expect(floatOf(lifted(12, ["work", "jump"]).clip, chop.rest)).toBeNull();
  });
  it("names a clip that floats with no answer, and an answer whose clip floats no longer", () => {
    const none: QaReasons = { ...reasons, floats: {} }, answered: QaReasons = { ...reasons, floats: { [chop.clip.id]: "on a step" } };
    expect(checkFloats([lifted(12)], none).problems[0]).toMatch(/^CMU_CURATED\/Chop_Wood: stands upright with both soles \d+ mm up for 6 s from 0 s, with no answer/);
    expect(checkFloats([lifted(12)], answered)).toEqual({ problems: [], gone: [] });
    expect(checkFloats([chop], answered)).toEqual({ problems: [], gone: ["CMU_CURATED/Chop_Wood (floats no longer)"] });
  });
});

describe("the off-feet check", () => {
  const fly = all.find((c) => c.clip.id === "MESH2MOTION/Flying_Forward")!, run = all.find((c) => c.clip.id === "MESH2MOTION/Run_Female")!;
  const bare = (c: LibraryClip, tags = c.clip.tags): LibraryClip => ({ ...c, clip: { ...c.clip, tags, contacts: { by: "detected" } } });
  it("passes the library: every loop with no contact is answered, every answer's loop still has none", () => {
    expect(checkOffFeet(all)).toEqual({ problems: [], gone: [] });
    expect([Object.keys(readReasons().offFeet ?? {}).length, Object.keys(readReasons().unplanted ?? {}).length]).toEqual([19, 5]);
    expect(offFeetStep(all)).toMatchObject({ name: "off feet", ok: true, summary: "every loop with no contact answered in library/baselines/qa.json: 19 off their feet, 5 with no foot that holds still" });
  });
  it("names a loop with no contact its tags keep on its feet, one with no answer, and an answer whose loop has contacts", () => {
    const none: QaReasons = { ...reasons, offFeet: {} }, answered: QaReasons = { ...reasons, offFeet: { [fly.clip.id]: "it flies", [run.clip.id]: "it runs" } };
    expect(checkOffFeet([bare(run)], none).problems[0]).toMatch(/^MESH2MOTION\/Run_Female: a loop with no contact, and none of its tags \(run\) puts it off its feet .*answer why no foot holds still in library\/baselines\/qa.json unplanted$/);
    expect(checkOffFeet([bare(run)], { ...reasons, unplanted: { [run.clip.id]: "its feet sweep the floor" } })).toEqual({ problems: [], gone: [] });
    expect(checkOffFeet([fly], none).problems).toEqual(["MESH2MOTION/Flying_Forward: a loop with no contact (fly, air), with no answer in library/baselines/qa.json offFeet"]);
    expect(checkOffFeet([fly, run], answered)).toEqual({ problems: [], gone: ["offFeet: MESH2MOTION/Run_Female (has contacts now)"] });
    expect(checkOffFeet([run], { ...reasons, unplanted: { [run.clip.id]: "x" } }).gone).toEqual(["unplanted: MESH2MOTION/Run_Female (has contacts now)"]);
    expect(checkOffFeet([bare(run, ["run", "fly"])], answered).problems).toEqual([]);
    const step = offFeetStep([bare(run)], none);
    expect([step.ok, step.summary, step.detail?.length]).toEqual([false, "1 loops with no contact unanswered; 0 answers whose loop has contacts now or belongs in the other field", 1]);
    expect(offFeetStep([fly, run], answered)).toMatchObject({ ok: false, detail: ["library/baselines/qa.json offFeet: MESH2MOTION/Run_Female (has contacts now)"] });
  });
  it("names an answer left in the field its loop doesn't need: offFeet for one on its feet, unplanted for one off them (D108)", () => {
    // each loop answered in both fields: the one its tags give it holds, the other is a reason whose finding is gone
    const both: QaReasons = { ...reasons, offFeet: { [fly.clip.id]: "it flies", [run.clip.id]: "it runs" }, unplanted: { [fly.clip.id]: "its feet sweep the air", [run.clip.id]: "its feet sweep the floor" } };
    const gone = ["offFeet: MESH2MOTION/Run_Female (none of its tags puts it off its feet: unplanted answers it)", "unplanted: MESH2MOTION/Flying_Forward (its tags put it off its feet: offFeet answers it)"];
    expect(checkOffFeet([fly, bare(run)], both)).toEqual({ problems: [], gone });
    expect(offFeetStep([fly, bare(run)], both)).toMatchObject({ ok: false, summary: "0 loops with no contact unanswered; 2 answers whose loop has contacts now or belongs in the other field", detail: gone.map((g) => `library/baselines/qa.json ${g}`) });
    // an answer in the wrong field alone: its loop unanswered, and the answer named
    expect(checkOffFeet([fly], { ...reasons, offFeet: {}, unplanted: { [fly.clip.id]: "x" } })).toEqual({ problems: ["MESH2MOTION/Flying_Forward: a loop with no contact (fly, air), with no answer in library/baselines/qa.json offFeet"], gone: [gone[1]] });
  });
  it("reads the answers against the reasons' schema", () => {
    expect(reasonsProblems({ ...reasons, offFeet: { "A/B": "" } })).toEqual(["offFeet maps a clip id to where it is instead of on its feet, a text"]);
    expect(reasonsProblems({ ...reasons, offFeet: { nope: "x" } })).toEqual(['"nope" is not a clip id']);
    expect(schema("qa.schema.json")({ ...reasons, offFeet: { "A/B": "" } })).toBe(false);
    expect(reasonsProblems({ ...reasons, unplanted: { "A/B": "" } })).toEqual(["unplanted maps a clip id to why no foot holds still on the floor, a text"]);
    expect(reasonsProblems({ ...reasons, unplanted: { nope: "x" } })).toEqual(['"nope" is not a clip id']);
    expect(schema("qa.schema.json")({ ...reasons, unplanted: { "A/B": "" } })).toBe(false);
    expect(schema("qa.schema.json")({ ...reasons, unplanted: { "A/B": "its feet sweep the floor" } })).toBe(true);
  });
});

describe("the still check (F.13)", () => {
  // Chop_Wood swings an axe; frozen, every key its first pose (as the fit froze STYLE100's idles, D133)
  const chop = all.find((c) => c.clip.id === "CMU_CURATED/Chop_Wood")!, rest = all.find((c) => c.clip.id === "MESH2MOTION/Rest_Pose")!, aim = all.find((c) => c.clip.id === "MESH2MOTION/Pistol_Aim_Up")!;
  const frozen = (c: LibraryClip, tags = c.clip.tags): LibraryClip => ({ ...c, clip: { ...c.clip, tags, keys: c.clip.keys.map((k) => ({ ...c.clip.keys[0]!, t: k.t })) } });
  it("reads how far a clip moves: the farthest any body point gets from where it starts", () => {
    expect(reachOf(chop.clip, chop.rest)).toBeGreaterThan(300);
    expect([reachOf(frozen(chop).clip, chop.rest), reachOf(rest.clip, rest.rest), reachOf(aim.clip, aim.rest)]).toEqual([0, 0, 0]);
    // a pose held but for one key a few degrees off moves
    const nudged = { ...chop.clip, keys: frozen(chop).clip.keys.map((k, i) => (i === 1 ? { ...k, body: [k.body[0]! + 2, k.body[1]!, k.body[2]!] } : k)) };
    expect(reachOf(nudged, chop.rest)).toBeGreaterThan(STILL.mm);
  });
  it("names a clip that never moves unless its tags call it a pose or the reasons answer it, and an answer it no longer needs", () => {
    const none: QaReasons = { ...reasons, still: {} }, answered: QaReasons = { ...reasons, still: { [chop.clip.id]: "its source holds the pose" } };
    expect(checkStill([frozen(chop)], none).problems).toEqual([expect.stringMatching(/^CMU_CURATED\/Chop_Wood: never moves \(every body point within 0 mm of where it starts over \d+ keys\), and none of its tags \(work\) says it is a pose \(pose, reference\): .* answer why in library\/baselines\/qa.json still$/)]);
    expect(checkStill([frozen(chop), frozen(chop, ["work", "pose"]), rest, aim], none)).toMatchObject({ problems: [expect.any(String)], gone: [], poses: [chop.clip.id, rest.clip.id, aim.clip.id] });
    expect(checkStill([frozen(chop), rest, aim], answered)).toEqual({ problems: [], gone: [], poses: [rest.clip.id, aim.clip.id] });
    expect(checkStill([chop], answered)).toEqual({ problems: [], gone: ["still: CMU_CURATED/Chop_Wood (it moves now)"], poses: [] });
    expect(checkStill([frozen(chop, ["work", "reference"])], answered).gone).toEqual(["still: CMU_CURATED/Chop_Wood (its tags say it is a pose: they answer it)"]);
    expect(stillStep([frozen(chop)], none)).toMatchObject({ name: "still", ok: false, summary: "1 clips that never move, untagged and unanswered; 0 answers whose clip moves now or is tagged a pose" });
    expect(stillStep([frozen(chop), rest, aim], answered)).toEqual({ name: "still", ok: true, ms: 0, summary: "every clip that never moves is tagged a pose (pose, reference: 2) or answered in library/baselines/qa.json still (1)", detail: [] });
    expect(reasonsProblems({ ...reasons, still: { "A/B": "" } })).toEqual(["still maps a clip id to why its motion never changes, a text"]);
    expect(reasonsProblems({ ...reasons, still: { nope: "x" } })).toEqual(['"nope" is not a clip id']);
    expect([schema("qa.schema.json")({ ...reasons, still: { "A/B": "" } }), schema("qa.schema.json")({ ...reasons, still: { "A/B": "lost upstream" } })]).toEqual([false, true]);
  });
  it("passes the library: every clip that never moves is a pose its tags name, or answered", () => {
    // (one pass, decoding every clip every 1/30 s)
    const s = checkStill(all), poses = s.poses.map((id) => id.split("/")[1]!).sort();
    expect([s.problems, s.gone]).toEqual([[], []]);
    expect(Object.keys(readReasons().still ?? {}).sort()).toEqual(["QUATERNIUS_3D2DGE/Driving_Loop", "QUATERNIUS_3D2DGE/Sitting_Idle_Loop", "QUATERNIUS_SHARDFALL/Driving_Loop", "QUATERNIUS_SHARDFALL/Sitting_Idle_Loop"]);
    // the poses: the pistol's three aims (three sets), a held bow, the rest and T-poses, each tagged so
    expect(poses).toEqual(["A_TPose", "A_TPose", "Bow_Pull_Hold", ...Array(3).fill(["Pistol_Aim_Down", "Pistol_Aim_Neutral", "Pistol_Aim_Up"]).flat().sort(), "Rest_Pose"].sort());
  });
});
