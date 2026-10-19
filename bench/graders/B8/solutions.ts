// What B8's grader tests play (WP-9.1b): a solution (its files, its m3a calls as an agent types them, and what it
// writes into the queue past them) in a workspace inside the repository on a starter character, then graded; the
// known-good one read from known-good/, and the planted bad ones, each with the check it must fail: never submitted;
// bounced (the library's idle sent as it is: dedup); a false license claim (CC0 for a clip derived from a CC BY one,
// sent as submit sends it from a workspace without the CC BY pack, whose library can't see that lineage: the checker's
// can); a defect the checker bounces (a sunk body: sensors); the emote sent as a fix of the library's idle
// (`--improves`: not new); missing provenance (the recipe sent as it is: nobody named, no local report); and a record
// written into the queue by hand as awaiting review, every gate "green" (checked again from its text: dedup). Those
// that reach the queue past submit's own gates are sent as submit sends a clip (who made it, the local report).
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { recipe, serialize, type Clip, type Rest } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { checks } from "@m3a/sensors";
import { intake } from "@m3a/tools";
import { INTAKE_DIR, intakeFiles } from "@m3a/tools/node";
import { plant } from "../../../tools/plant/plant.ts";
import { prepareWorkspace, type CharacterSpec } from "../../runner/workspace.ts";
import type { Grade } from "../B1/grade.ts";
import { B8_GATES, gradeB8, queue, runCalls } from "./grade.ts";

const ROOT = join(import.meta.dirname, "../../.."), KG = join(import.meta.dirname, "known-good");
/** The known-good recipe (emote.json) and its m3a calls (submit.sh). */
export const GOOD = { recipe: readFileSync(join(KG, "emote.json"), "utf8"), calls: readFileSync(join(KG, "submit.sh"), "utf8") };

/** What a solution does: its files, its m3a calls (a shell file's lines), and what it writes into the queue past
 *  them. */
export interface Solution {
  files: Record<string, string>;
  calls?: string;
  also?: (workspace: string) => Promise<void>;
}

/** A recipe compiled on the CC0 library (its clip edited by `edit`), with the intake's provenance as `m3a library
 *  submit` gives a clip, as the text it sends. */
export function sent(text: string, edit: (c: Clip, rest: Rest) => Clip = (c) => c): string {
  const { clip, rest } = recipe.compile(JSON.parse(text) as recipe.Recipe, openLibrary().resolver()), c = edit(clip, rest);
  return serialize({ ...c, provenance: { ...c.provenance, intake: { by: "a planted solution", report: { sensors: "pass", findings: 0, qaVersion: checks.QA_VERSION } } } as Clip["provenance"] });
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

/** The planted bad solutions, each with the check it must fail. */
export const PLANTED: Record<string, Solution & { fails: string }> = {
  "never submitted": { files: { "emote.json": GOOD.recipe }, calls: "npx m3a recipe.compile emote.json", fails: "a submission reached the queue" },
  bounced: { files: { "emote.json": idle }, calls: GOOD.calls, fails: "the dedup gate is green" },
  "a false license claim": {
    files: {},
    also: async (ws) => void (await queue(ws, "local").submit({ kind: "clip", text: sent(GOOD.recipe, (c) => ({ ...c, provenance: { ...c.provenance, orig: "STYLE100/Neutral_Walk" } })) })),
    fails: "the license gate is green",
  },
  "a defect the checker bounces": { files: {}, also: async (ws) => void (await queue(ws, "local").submit({ kind: "clip", text: sent(GOOD.recipe, (c, rest) => plant("sink", c, rest).clip) })), fails: "the sensors gate is green" },
  "a fix of a library clip": { files: { "emote.json": GOOD.recipe }, calls: GOOD.calls.replace(' --by "', ' --improves QUATERNIUS_3D2DGE/Idle_Loop --by "'), fails: "it is new" },
  "missing provenance": { files: { "emote.json": GOOD.recipe }, calls: "npx m3a library submit emote.json", fails: "its provenance is complete" },
  "a record written by hand": {
    files: {},
    also: async (ws) => {
      const text = sent(idle), content = intake.contentHash(text), id = intake.submissionId("local", content), green = B8_GATES.map((gate) => ({ gate, ok: true, why: [] }));
      const forged: intake.Submission = { id, contributor: "local", kind: "clip", text, improves: null, content, motion: intake.motionOfText("clip", text), state: "awaiting review", reason: null, report: { checker: "m3a-intake-check@1", gates: green }, decision: null, date: "2026-10-19" };
      mkdirSync(join(ws, INTAKE_DIR), { recursive: true });
      intakeFiles(join(ws, INTAKE_DIR)).write(`${id}.json`, `${JSON.stringify(forged)}\n`);
    },
    fails: "it waits for review",
  },
};
