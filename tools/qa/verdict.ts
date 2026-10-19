// A library clip's QA verdict as its writer records it (PLAN.md WP-5.8): the sensors' verdict on its rest, `quality.qa`
// "pass", or "baselined" with its reason in `quality.baseline`, read with the sensors' revision (`quality.qaVersion`,
// @m3a/sensors' checks.QA_VERSION). A reason starts with the level and the metrics past it, then says why the clip is
// kept so: a reason library/baselines/qa.json gives the clip by hand for a metric, else its set's, else the warn level's
// (short of every fail level), else, at fail, how the clip stands to its source (as captured or as keyed, its fit, and
// what its repair did). The writers (npm run import, npm run migrate) record it; `npm run qa -- library --check` reads
// every clip's again.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Clip, Rest } from "@m3a/core";
import { checks, metrics, type Report } from "@m3a/sensors";
import { ROOT } from "../run/cli.ts";

/** The reasons file. */
export const QA_REASONS = join(ROOT, "library/baselines/qa.json");

/** Why the library keeps clips the sensors flag. */
export interface QaReasons {
  about?: string;
  /** Why a warn is kept: short of every fail level. */
  warn: string;
  /** Per set, why its clips' fails are kept. */
  sets: Record<string, string>;
  /** Per clip, per metric, why that metric's finding is kept (ahead of the others). */
  clips: Record<string, Record<string, string>>;
  /** Per clip, why it stands off the floor where the float check (library.ts) finds it. */
  floats?: Record<string, string>;
  /** Per loop with no contact at all, where it is instead of on its feet (the off-feet check, library.ts). */
  offFeet?: Record<string, string>;
  /** Per loop on its feet with no contact at all, why no foot holds still on the floor (the off-feet check, D108). */
  unplanted?: Record<string, string>;
}
/** What the writer knows of how the clip stands to its source. */
export interface QaContext {
  /** The sensors' fix steps the writer repaired it with. */
  repaired?: string[];
  /** Why the writer didn't repair it. */
  unrepaired?: string;
  /** Why the writer kept the migrated version over a re-import. */
  migrated?: string;
}
/** A clip's quality as its writer records it. */
export type Quality = Clip["quality"];

/** A clip id as the format writes it, SET/Slug, its slug perhaps with a hyphen (spec/MOTION.md §11). */
const CLIP_ID = /^[A-Z0-9_]+\/[A-Za-z0-9_-]+$/;

/** What is wrong with a reasons file's shape (tools/qa/qa.schema.json), none when it is right. */
export function reasonsProblems(r: unknown): string[] {
  const out: string[] = [], text = (v: unknown) => typeof v === "string" && v.trim().length > 0, obj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
  if (!obj(r)) return ["the reasons are a JSON object"];
  for (const k of Object.keys(r)) if (!["about", "warn", "sets", "clips", "floats", "offFeet", "unplanted"].includes(k)) out.push(`"${k}" is not a field of the reasons (about, warn, sets, clips, floats, offFeet, unplanted)`);
  if (!text(r.warn)) out.push("warn is the reason a warn is kept, a text");
  if (!obj(r.sets) || !Object.values(r.sets).every(text)) out.push("sets maps a set to its reason, a text");
  if (!obj(r.clips) || !Object.values(r.clips).every((m) => obj(m) && Object.values(m).every(text))) out.push("clips maps a clip id to { metric: reason }");
  else for (const id of Object.keys(r.clips)) if (!CLIP_ID.test(id)) out.push(`"${id}" is not a clip id`);
  if (r.floats !== undefined && (!obj(r.floats) || !Object.values(r.floats).every(text))) out.push("floats maps a clip id to why it stands off the floor, a text");
  else for (const id of Object.keys(r.floats ?? {})) if (!CLIP_ID.test(id)) out.push(`"${id}" is not a clip id`);
  if (r.offFeet !== undefined && (!obj(r.offFeet) || !Object.values(r.offFeet).every(text))) out.push("offFeet maps a clip id to where it is instead of on its feet, a text");
  else for (const id of Object.keys(r.offFeet ?? {})) if (!CLIP_ID.test(id)) out.push(`"${id}" is not a clip id`);
  if (r.unplanted !== undefined && (!obj(r.unplanted) || !Object.values(r.unplanted).every(text))) out.push("unplanted maps a clip id to why no foot holds still on the floor, a text");
  else for (const id of Object.keys(r.unplanted ?? {})) if (!CLIP_ID.test(id)) out.push(`"${id}" is not a clip id`);
  return out;
}
/** The reasons (checked: a bad file throws, naming what is wrong), or none when there is no file yet. */
export function readReasons(file = QA_REASONS): QaReasons {
  if (!existsSync(file)) return { warn: "short of every fail level the sensors apply", sets: {}, clips: {} };
  const r = JSON.parse(readFileSync(file, "utf8")) as unknown, bad = reasonsProblems(r);
  if (bad.length) throw new Error(`${file}: ${bad.join("; ")}`);
  return r as QaReasons;
}

/** The metrics past a report's verdict level, in order. */
export function pastLevel(report: Pick<Report, "verdict" | "findings">): string[] {
  return [...new Set(report.findings.filter((f) => f.level === report.verdict).map((f) => f.metric as string))].sort();
}

/** What a baselined clip's reason starts with: its level and the metrics past it. */
export const reasonHead = (report: Pick<Report, "verdict" | "findings">) => `${report.verdict} on ${pastLevel(report).join(", ")}: `;

/** Why a flagged clip is kept: the hand reasons for its metrics, then its set's, the warn level's or its source's; and
 *  the metrics its tags' profile turns off, so it never says more than the sensors measured. */
export function reasonOf(clip: Clip, report: Report, reasons: QaReasons, ctx: QaContext = {}): string {
  const past = pastLevel(report), own = reasons.clips[clip.id] ?? {}, set = clip.id.split("/")[0]!;
  const byHand = past.filter((m) => own[m]), rest = past.filter((m) => !own[m]);
  const fit = clip.quality.fit as [number, number], how = clip.provenance.method === "captured" ? "as captured, fitted within" : "as keyed in its source, fitted within";
  const source = `${how} ${fit[0]} mm of it on average${ctx.migrated ? `; kept as migrated: ${ctx.migrated}` : ctx.unrepaired ? `; the sensors' fix: ${ctx.unrepaired}` : ctx.repaired?.length ? `; repaired (${ctx.repaired.join(", ")}), and still past it` : ""}`;
  const general = report.verdict === "warn" ? reasons.warn : (reasons.sets[set] ?? source);
  const parts = [...byHand.map((m) => `${m}: ${own[m]}`), ...(rest.length ? [`${byHand.length ? `${rest.join(", ")}: ` : ""}${general}`] : [])];
  return reasonHead(report) + parts.join("; ") + (report.off.length ? `; not measured for its tags: ${[...report.off].sort().join(", ")}` : "");
}

/** The quality a writer records for a clip (its fit kept): pass, or baselined with the reason. */
export function qualityOf(clip: Clip, rest: Rest, reasons: QaReasons, ctx: QaContext = {}, report: Report = metrics(clip, rest)): Quality {
  const base = { fit: clip.quality.fit, qaVersion: checks.QA_VERSION };
  return report.verdict === "pass" ? { ...base, qa: "pass" } : { ...base, qa: "baselined", baseline: reasonOf(clip, report, reasons, ctx) };
}

/** The clip with its quality recorded. */
export function withQuality(clip: Clip, rest: Rest, reasons: QaReasons, ctx: QaContext = {}): Clip {
  return { ...clip, quality: qualityOf(clip, rest, reasons, ctx) };
}
