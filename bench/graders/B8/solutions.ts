// What B8's grader tests play (WP-9.1b): a solution (its files, its m3a calls as an agent types them, and what it
// writes into the queue past them) in a workspace inside the repository on a starter character, then graded; the
// known-good one read from known-good/, and the planted bad ones, each with the check it must fail. Through m3a's calls:
// never submitted; bounced (the library's idle sent as it is: dedup); the emote sent as a fix of the library's idle
// (`--improves`: not new); missing provenance (the recipe sent as it is: nobody named, no local report). Into the queue
// as submit sends a clip (`sent`: who made it and the local report submit measures), each from one of B8-ten's ten
// known-good recipes, so that no two share a motion: a false license claim (CC0 for a clip derived from a CC BY one,
// sent as submit sends it from a workspace without the CC BY pack, whose library can't see that lineage: the
// checker's can); a defect the checker bounces (a sunk body: sensors); a walk tagged emote (not in place); made by
// someone the brief doesn't ask for (a person, or another vendor's model); its source's name and description; a local
// report submit didn't measure (another QA version's, sent with the store's own submit); a record written into the
// queue by hand as awaiting review, every gate "green" (checked again from its text: dedup); and a bounced record
// edited by hand to a good clip's text (its id and content hash are another text's). `STORED` names those that only
// write into the queue, which T1 plays together in one queue.
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { recipe, serialize, type Clip, type Rest } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { checks, metrics } from "@m3a/sensors";
import { intake } from "@m3a/tools";
import { INTAKE_DIR, intakeFiles } from "@m3a/tools/node";
import { plant } from "../../../tools/plant/plant.ts";
import { prepareWorkspace, type CharacterSpec } from "../../runner/workspace.ts";
import type { Grade } from "../B1/grade.ts";
import { B8_GATES, gradeB8, queue, runCalls } from "./grade.ts";
import { KNOWN_GOOD_TEN } from "./ten.ts";

const ROOT = join(import.meta.dirname, "../../.."), KG = join(import.meta.dirname, "known-good");
/** The known-good recipe (emote.json) and its m3a calls (submit.sh). */
export const GOOD = { recipe: readFileSync(join(KG, "emote.json"), "utf8"), calls: readFileSync(join(KG, "submit.sh"), "utf8") };
/** B8-ten's ten known-good recipes, by clip name. */
export const TEN_RECIPES: Readonly<Record<string, string>> = Object.fromEntries(readdirSync(KNOWN_GOOD_TEN).filter((f) => f.endsWith(".json")).sort().map((f) => [f.slice(0, -5), readFileSync(join(KNOWN_GOOD_TEN, f), "utf8")]));
/** Who made a clip, as the known-good solutions say it. */
export const BY = "Claude, an AI agent (claude-opus-5-5), for the game's studio";

/** What a solution does: its files, its m3a calls (a shell file's lines), and what it writes into the queue past
 *  them. */
export interface Solution {
  files: Record<string, string>;
  calls?: string;
  also?: (workspace: string) => Promise<void>;
}

/** A recipe compiled on the CC0 library (its clip edited by `edit`), with the intake's provenance as `m3a library
 *  submit` gives a clip (who made it, `BY`, and the local report it measures of the clip as sent), each part replaced
 *  by `over`'s, as the text it sends. */
export function sent(text: string, edit: (c: Clip, rest: Rest) => Clip = (c) => c, over: Record<string, unknown> = {}): string {
  const { clip, rest } = recipe.compile(JSON.parse(text) as recipe.Recipe, openLibrary().resolver()), c = JSON.parse(serialize(edit(clip, rest))) as Clip, r = metrics(c, rest);
  return serialize({ ...c, provenance: { ...c.provenance, intake: { by: BY, report: { sensors: r.verdict, findings: r.findings.length, qaVersion: checks.QA_VERSION }, ...over } } as Clip["provenance"] });
}

/** A solution played in a workspace inside the repository (.cache/bench/test-ws/) on `character`, then graded: the
 *  grade, the workspace and its calls' exit codes. */
export async function play(name: string, s: Solution, character: CharacterSpec): Promise<{ g: Grade; ws: string; ran: ReturnType<typeof runCalls> }> {
  const ws = join(ROOT, ".cache/bench/test-ws", `B8-${name.replace(/\W+/g, "-")}-${"seed" in character ? character.seed : character.rig}`);
  await prepareWorkspace(ws, { starter: join(ROOT, "bench/starters/B8"), character, files: { ...s.files, ...(s.calls ? { "calls.sh": s.calls } : {}) } });
  const ran = s.calls ? runCalls(ws, "calls.sh") : [];
  await s.also?.(ws);
  return { g: await gradeB8(ws), ws, ran };
}

/** A grade's checks, a line each. */
export const text = (g: Grade): string => g.checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`).join("\n");

const POSE = ',\n  { "op": "pose", "in": "idle", "chest": { "lean": 45 }, "head": { "lean": 15 }, "from": 0.3, "to": 1.7, "fade": 0.4 }';
if (!GOOD.recipe.includes(POSE)) throw new Error("the known-good recipe's pose step changed: plant the bounced solution again");
/** The library's idle, sliced, sent as it is: the known-good without its bow. */
const idle = GOOD.recipe.replace(POSE, "");
/** A walk with a lean, tagged emote: it travels and steps. */
const walk = JSON.stringify({ format: "2.0", id: "EMOTES/Proud_Strut", name: "Proud_Strut", desc: "struts along, leaning back proudly", tags: ["emote", "gesture"], steps: [{ op: "clip", id: "MESH2MOTION/Walk_Large", as: "w" }, { op: "pose", in: "w", chest: { lean: -10 }, head: { lean: -10 } }] });
/** B8-ten's known-good recipe `name`, its name and description left out (it carries its source's). */
const unnamed = (name: string) => JSON.stringify((({ name: _n, desc: _d, ...r }) => r)(JSON.parse(TEN_RECIPES[name]!) as Record<string, unknown>));
/** Writes a submission's record into the workspace's queue by hand. */
const write = (ws: string, s: intake.Submission) => {
  mkdirSync(join(ws, INTAKE_DIR), { recursive: true });
  intakeFiles(join(ws, INTAKE_DIR)).write(`${s.id}.json`, `${JSON.stringify(s)}\n`);
};
const green = () => ({ checker: "m3a-intake-check@1", gates: B8_GATES.map((gate) => ({ gate, ok: true, why: [] })) });
/** Sends `text` as a clip with the store's own submit, as contributor `local` (submit's gates skipped). */
const store = async (ws: string, text: string) => void (await queue(ws, "local").submit({ kind: "clip", text }));

/** The planted bad solutions, each with the check it must fail. */
export const PLANTED: Record<string, Solution & { fails: string }> = {
  "never submitted": { files: { "emote.json": GOOD.recipe }, calls: "npx m3a recipe.compile emote.json", fails: "a submission reached the queue" },
  bounced: { files: { "emote.json": idle }, calls: GOOD.calls, fails: "the dedup gate is green" },
  "a fix of a library clip": { files: { "emote.json": GOOD.recipe }, calls: GOOD.calls.replace(' --by "', ' --improves QUATERNIUS_3D2DGE/Idle_Loop --by "'), fails: "it is new" },
  "missing provenance": { files: { "emote.json": GOOD.recipe }, calls: "npx m3a library submit emote.json", fails: "its provenance is complete" },
  "a false license claim": { files: {}, also: (ws) => store(ws, sent(TEN_RECIPES.Arms_V!, (c) => ({ ...c, provenance: { ...c.provenance, orig: "STYLE100/Neutral_Walk" } }))), fails: "the license gate is green" },
  "a defect the checker bounces": { files: {}, also: (ws) => store(ws, sent(TEN_RECIPES.Side_Lean!, (c, rest) => plant("sink", c, rest).clip)), fails: "the sensors gate is green" },
  "a walk": { files: {}, also: (ws) => store(ws, sent(walk)), fails: "it stays in place" },
  "made by a person": { files: {}, also: (ws) => store(ws, sent(TEN_RECIPES.Fist_Up!, undefined, { by: "Bob" })), fails: "its provenance is complete" },
  "made by another vendor's model": { files: {}, also: (ws) => store(ws, sent(TEN_RECIPES.Arms_Wide!, undefined, { by: "Gemini 2.5 Pro, an AI agent" })), fails: "its provenance is complete" },
  "its source's name and description": { files: {}, also: (ws) => store(ws, sent(unnamed("Shrug_Tilt"))), fails: "its name and description are its own" },
  "a report submit didn't measure": { files: {}, also: (ws) => store(ws, sent(TEN_RECIPES.Point_Ahead!, undefined, { report: { sensors: "pass", findings: 0, qaVersion: "m3a-sensors@0" } })), fails: "its provenance is complete" },
  "a record written by hand": {
    files: {},
    also: async (ws) => {
      const text = sent(idle), content = intake.contentHash(text), id = intake.submissionId("local", content);
      write(ws, { id, contributor: "local", kind: "clip", text, improves: null, content, motion: intake.motionOfText("clip", text), state: "awaiting review", reason: null, report: green(), decision: null, date: "2026-10-19" });
    },
    fails: "it waits for review",
  },
  "a record edited by hand": {
    files: {},
    also: async (ws) => {
      // a sunk clip sent, then its record given a good clip's text and every gate "green", its id and content left
      const s = await queue(ws, "local").submit({ kind: "clip", text: sent(TEN_RECIPES.Look_Back!, (c, rest) => plant("sink", c, rest).clip) });
      write(ws, { ...s, text: sent(TEN_RECIPES.Look_Up!), state: "awaiting review", report: green() });
    },
    fails: "its queue record is its own text's",
  },
};
/** The planted solutions that only write into the queue (no files, no m3a calls): T1 plays them in one queue. */
export const STORED: readonly string[] = Object.keys(PLANTED).filter((k) => !PLANTED[k]!.calls && !Object.keys(PLANTED[k]!.files).length);
