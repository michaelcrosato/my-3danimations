// The motion-source socket (PLAN.md WP-9.2): one way to ask any source for a clip. `sourceClip` checks the request,
// runs the source, validates what comes back, writes the source's record (its name, the license and version of the
// terms the clip was served under, the seed, the intent's hash) into the clip's provenance as `source`, and warns
// where the terms changed, where the clip's license claim isn't its source's terms, where a constraint is missed and
// where the length isn't the one asked for. It reads no clock and no randomness: the same request gives the same clip.
import { P, type Rest } from "../format/body.ts";
import { error } from "../format/fit.ts";
import { decodePose, type KeyLike } from "../format/pose.ts";
import { keyAt } from "../format/sample.ts";
import { KEY_FIELDS, LIMITS, type Clip } from "../format/types.ts";
import { rootAt } from "../clip/sample.ts";
import { sha256 } from "../recipe/sha256.ts";
import { validate } from "../validate/index.ts";
import { formatIssue } from "../validate/issues.ts";
import { SourceError, type MotionSource, type SourceOutput, type SourceRecord, type SourceRequest, type SourceTerms, type Sourced } from "./types.ts";

/** A key pose counts as met when no body point is farther than this from it, mm (the key budget). */
export const POSE_TOLERANCE = 30;
/** A root waypoint counts as met within this, % of the hip height, and its heading within ROOT_TURN degrees. */
export const ROOT_TOLERANCE = 5;
/** A root waypoint's heading counts as met within this many degrees. */
export const ROOT_TURN = 10;
/** The most constraints a request may carry (a clip's events' limit). */
export const MAX_CONSTRAINTS = 64;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** The fields a constraint's pose may not carry: the time, and the root's travel and heading (a root waypoint's). */
const NOT_POSE = new Set(["t", "root", "yaw"]);

/** A pose's problems as a constraint: each required key field present, every field a key field with its parts. */
function poseIssues(pose: unknown, at: string): string[] {
  if (!isObj(pose)) return [`${at}.pose is a key's fields ({ hips, body, chest, head, armL, armR, legL, legR, ... })`];
  const out: string[] = [];
  for (const [f, spec] of Object.entries(KEY_FIELDS)) if (spec.required && pose[f] === undefined) out.push(`${at}.pose has no ${f}`);
  for (const [f, v] of Object.entries(pose)) {
    const spec = KEY_FIELDS[f];
    if (!spec || NOT_POSE.has(f)) out.push(`${at}.pose.${f} is not a key pose's field${f === "root" || f === "yaw" ? " (give the root as a root constraint)" : ""}`);
    else if (!Array.isArray(v) || v.length !== spec.parts.length || !v.every(num)) out.push(`${at}.pose.${f} is ${spec.parts.length} numbers (${spec.parts.join(", ")})`);
  }
  return out;
}

/** A request's problems, each saying what it should be; none for a request a source can take. */
export function checkRequest(req: unknown): string[] {
  if (!isObj(req)) return ["the request is { intent, skeleton, duration, seed, constraints? }"];
  const out: string[] = [], dur = req.duration;
  if (typeof req.intent !== "string" || !req.intent.trim()) out.push("intent is the moment in words (\"a tired walk\")");
  else if (req.intent.length > 1000) out.push(`intent is at most 1,000 characters, not ${req.intent.length}`);
  if (!num(dur) || dur <= 0 || dur > LIMITS.dur) out.push(`duration is seconds, over 0 and at most ${LIMITS.dur}`);
  if (!Number.isInteger(req.seed) || (req.seed as number) < 0 || (req.seed as number) > 0xffffffff) out.push("seed is a whole number from 0 to 4294967295");
  const sk = req.skeleton;
  if (!isObj(sk) || !isObj(sk.rest) || typeof sk.restSrc !== "string" || !sk.restSrc) out.push("skeleton is { rest, restSrc }: a rest as a set manifest's source records it, and that source's key");
  const cs = req.constraints;
  if (cs !== undefined && (!Array.isArray(cs) || cs.length > MAX_CONSTRAINTS)) out.push(`constraints is a list of at most ${MAX_CONSTRAINTS}`);
  else
    (cs ?? []).forEach((c: unknown, i: number) => {
      const at = `constraints[${i}]`;
      if (!isObj(c) || (c.kind !== "pose" && c.kind !== "root")) return void out.push(`${at} is { kind: "pose", t, pose } or { kind: "root", t, forward, right, yaw? }`);
      if (!num(c.t) || c.t < 0 || (num(dur) && c.t > dur)) out.push(`${at}.t is seconds from 0 to the duration`);
      if (c.kind === "pose") out.push(...poseIssues(c.pose, at));
      else if (!num(c.forward) || !num(c.right) || (c.yaw !== undefined && !num(c.yaw))) out.push(`${at}: forward and right are % of the hip height, yaw degrees`);
    });
  return out;
}

/** Terms as a line: "CC0-1.0 (0.51.0)". */
const said = (t: SourceTerms) => `${t.license} (${t.version})`;
/** An angle folded into −180 to 180 degrees. */
const fold = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** The constraints a clip misses on its rest, each as a warning. */
function missed(clip: Clip, rest: Rest, req: SourceRequest): string[] {
  const out: string[] = [], A = new Float32Array(P * 3), B = new Float32Array(P * 3);
  for (const c of req.constraints ?? []) {
    if (c.kind === "pose") {
      decodePose(rest, keyAt(clip, c.t), A);
      decodePose(rest, c.pose as KeyLike, B);
      const d = error(A, B);
      if (d > POSE_TOLERANCE) out.push(`the key pose at ${c.t} s is missed by ${Math.round(d)} mm (within ${POSE_TOLERANCE} is met)`);
    } else {
      const r = rootAt(clip, c.t), dx = r.forward - c.forward, dy = r.right - c.right, d = Math.sqrt(dx * dx + dy * dy);
      const turn = c.yaw === undefined ? 0 : Math.abs(fold(r.yaw - c.yaw));
      if (d > ROOT_TOLERANCE || turn > ROOT_TURN) out.push(`the root waypoint at ${c.t} s is missed by ${Math.round(d)}% of the hip height${turn > ROOT_TURN ? ` and ${Math.round(turn)}°` : ""}`);
    }
  }
  return out;
}

/**
 * Asks `source` for a clip: the request checked (E_REQUEST), the source run (what it throws comes back as a
 * SourceError with its code, E_SOURCE by default), its clip validated (E_INVALID), the source's record written into the
 * clip's provenance as `source`, and the warnings: the source's, then a change of terms, a license claim that isn't its
 * source's terms, each missed constraint, a once clip's length off the one asked for.
 */
export async function sourceClip(source: MotionSource, req: SourceRequest): Promise<Sourced> {
  const issues = checkRequest(req);
  if (issues.length) throw new SourceError("E_REQUEST", `${source.name}: ${issues.join("; ")}`);
  let out: SourceOutput;
  try {
    out = await source.generate(req);
  } catch (err) {
    if (err instanceof SourceError) throw err;
    const code = isObj(err) && typeof err.code === "string" && /^E_[A-Z_]+$/.test(err.code) ? err.code : "E_SOURCE";
    throw new SourceError(code, `${source.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const v = validate(out?.clip, { mode: "read" });
  if (!v.ok || !isObj(out.rest)) throw new SourceError("E_INVALID", `${source.name}: its clip is invalid: ${v.errors.length ? v.errors.slice(0, 3).map(formatIssue).join("; ") : "it gave no rest"}; fix the source, the socket passes no invalid clip on`);
  const served = out.terms ?? source.terms, warnings = [...(out.warnings ?? [])];
  if (served.license !== source.terms.license || served.version !== source.terms.version) warnings.push(`${source.name}'s terms changed: it states ${said(source.terms)}, this clip was served under ${said(served)}; read them before using its clips`);
  const record: SourceRecord = { name: source.name, license: served.license, version: served.version, seed: req.seed, prompt: sha256(req.intent) };
  const clip: Clip = { ...out.clip, provenance: { ...out.clip.provenance, source: record } as Clip["provenance"] }, license = clip.provenance.license;
  if (served.license !== "inherit" && license !== served.license) warnings.push(`the clip claims ${license}, but ${source.name}'s terms are ${served.license}: the terms decide where it may go`);
  warnings.push(...missed(clip, out.rest, req));
  if (!clip.loop && Math.abs(clip.dur - req.duration) > 0.05 + 0.1 * req.duration) warnings.push(`asked for ${req.duration} s, the clip is ${clip.dur} s: retime it (ops.retime, or a recipe's retime step) if the length matters`);
  return { clip, rest: out.rest, record, license, warnings };
}
