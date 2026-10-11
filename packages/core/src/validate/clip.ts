// Validates a format-2 clip (spec/MOTION.md): structure, numbers and ranges, key times and limits, contacts, events,
// provenance, quality and review (errors), then format 1's known motion faults (warnings). `read` mode accepts unknown
// fields, as every reader must; `lint` mode flags them with the nearest known name.
import { ANGLE_MAX, ANGLE_WARN, CLIP_FIELDS, CONTACT_ENDS, FORMAT, IPTC, KEY_FIELDS, LIMITS, METHODS, QA_VERDICTS, REVIEW_STATES } from "../format/types.ts";
import { Findings, nearest, type Result, type Where } from "./issues.ts";

/** Validation options: `read` accepts unknown fields; `lint` flags them. */
export interface ValidateOptions {
  mode?: "read" | "lint";
}

/** Fields a later minor version may add that change how a clip plays; a 2.0 reader knows none of them. */
export const KNOWN_REQUIRES: readonly string[] = [];

const KEY_NAMES = ["t", "yaw", ...Object.keys(KEY_FIELDS)];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const ms = (t: number) => Math.abs(t * 1000 - Math.round(t * 1000)) < 1e-6;
const ID = /^[A-Z0-9_]+\/[A-Za-z0-9_-]+$/;
const EVENT = /^[a-z][a-z0-9_-]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** Validate a clip; `data` is the parsed JSON. */
export function validateClip(data: unknown, opts: ValidateOptions = {}): Result {
  const f = new Findings();
  if (!isObj(data)) {
    f.add("M2-E001", {}, "a clip is a JSON object", "write the clip as { \"format\": \"2.0\", ..., \"keys\": [...] }");
    return f.result();
  }
  const clip = typeof data.name === "string" && data.name ? data.name : typeof data.id === "string" ? data.id : "clip";
  const at = (w: Where = {}): Where => ({ clip, ...w });
  const lint = opts.mode === "lint";

  // ---- the header
  const format = data.format;
  if (typeof format !== "string" || !/^\d+\.\d+$/.test(format)) {
    f.add("M2-E002", at({ field: "format" }), `format ${JSON.stringify(format)} is not "MAJOR.MINOR"`, `write "format": "${FORMAT}" (format 1 sets go through the migrator)`);
  } else if (format.split(".")[0] !== FORMAT.split(".")[0]) {
    f.add("M2-E002", at({ field: "format" }), `format ${format} has a major this reader doesn't know (it reads ${FORMAT})`, "migrate the clip, or use a reader for that major");
    return f.result();
  }
  const need = (name: string, type: "string" | "number" | "boolean" | "array" | "object") => {
    const v = data[name];
    if (v === undefined) {
      f.add("M2-E003", at({ field: name }), `"${name}" is missing`, `add "${name}" (spec/MOTION.md §4)`);
      return false;
    }
    const ok = type === "array" ? Array.isArray(v) : type === "object" ? isObj(v) : typeof v === type;
    if (!ok) f.add("M2-E004", at({ field: name }), `"${name}" should be ${type === "array" || type === "object" ? `an ${type}` : `a ${type}`}`);
    return ok;
  };
  if (need("id", "string") && !ID.test(data.id as string)) f.add("M2-E017", at({ field: "id" }), `id ${JSON.stringify(data.id)} is not SET/Slug`, "upper-case set, then the slug: QUATERNIUS_UAL1/Walk_Loop");
  if (need("name", "string") && !(data.name as string).trim()) f.add("M2-E017", at({ field: "name" }), "name is empty");
  need("legend", "string");
  let dur = NaN;
  if (need("dur", "number")) {
    dur = data.dur as number;
    if (!Number.isFinite(dur)) f.add("M2-E005", at({ field: "dur" }), `dur is ${dur}`);
    else if (dur <= 0) f.add("M2-E014", at({ field: "dur" }), `dur ${dur} must be above 0`, "a one-key pose holds for at least 0.001 s");
    else if (dur > LIMITS.dur) f.add("M2-E010", at({ field: "dur" }), `dur ${dur} is over the ${LIMITS.dur} s limit`, "split the clip");
    else if (!ms(dur)) f.add("M2-E020", at({ field: "dur" }), `dur ${dur} is not rounded to the millisecond`);
  }
  need("loop", "boolean");
  if (need("fps", "number") && !((data.fps as number) > 0 && Number.isFinite(data.fps))) f.add("M2-E014", at({ field: "fps" }), `fps ${data.fps} must be above 0`);
  if (need("tags", "array") && !(data.tags as unknown[]).every((t) => typeof t === "string")) f.add("M2-E004", at({ field: "tags" }), "tags are strings");
  need("desc", "string");
  if (need("skeleton", "string") && data.skeleton !== "humanoid") f.add("M2-E016", at({ field: "skeleton" }), `skeleton ${JSON.stringify(data.skeleton)} is not "humanoid"`, "2.0 knows the humanoid body plan only (spec/SKELETON.md)");
  if (need("restSrc", "string") && !(data.restSrc as string)) f.add("M2-E017", at({ field: "restSrc" }), "restSrc is empty", "name the set's sources entry whose shares the keys decode with");
  if (data.requires !== undefined) {
    if (!Array.isArray(data.requires) || !data.requires.every((r) => typeof r === "string")) f.add("M2-E004", at({ field: "requires" }), "requires is a list of field names");
    else for (const r of data.requires as string[]) if (!KNOWN_REQUIRES.includes(r)) f.add("M2-E015", at({ field: "requires" }), `requires "${r}", which this reader (format ${FORMAT}) doesn't know`, "play it with a reader that knows the field; never play it without");
  }
  provenance(f, at, data.provenance);
  quality(f, at, data.quality);
  if (data.review !== undefined) review(f, at, data.review);
  if (data.facts !== undefined && (!isObj(data.facts) || typeof data.facts.by !== "string")) f.add("M2-E004", at({ field: "facts" }), "facts is an object with \"by\": the tool that measured them", "facts are written by tools (spec/MOTION.md §7.3)");
  if (lint) for (const k of Object.keys(data)) if (!(CLIP_FIELDS as readonly string[]).includes(k)) f.add("M2-W001", at({ field: k }), `unknown field "${k}"`, nearest(k, CLIP_FIELDS) ? `did you mean "${nearest(k, CLIP_FIELDS)}"?` : "readers ignore it; remove it or propose it for the next minor version");

  // ---- keys
  if (!need("keys", "array")) return f.result();
  const keys = data.keys as unknown[];
  if (!keys.length) {
    f.add("M2-E009", at({ field: "keys" }), "a clip needs at least one key", "add a key pose at t 0");
    return f.result();
  }
  if (keys.length > LIMITS.keys) f.add("M2-E010", at({ field: "keys" }), `${keys.length} keys is over the ${LIMITS.keys} limit`, "split the clip, or refit it with a larger budget");
  let prevT = -Infinity;
  let past = 0;
  keys.forEach((k, i) => {
    const kat = (field?: string, index?: number): Where => at({ key: i + 1, t: isObj(k) && typeof k.t === "number" ? k.t : undefined, field, index });
    if (!isObj(k)) {
      f.add("M2-E004", kat(), "a key is an object");
      return;
    }
    const t = k.t;
    if (typeof t !== "number") f.add("M2-E003", kat("t"), "the key has no time \"t\"");
    else if (!Number.isFinite(t)) f.add("M2-E005", kat("t"), `t is ${t}`);
    else {
      if (t < 0 || t > LIMITS.dur) f.add("M2-E014", kat("t"), `t ${t} is outside 0..${LIMITS.dur}`);
      if (!ms(t)) f.add("M2-E020", kat("t"), `t ${t} is not rounded to the millisecond`);
      if (t <= prevT || t - prevT < LIMITS.gap - 1e-9) f.add("M2-E008", kat("t"), `t ${t} comes ${t <= prevT ? "at or before" : "less than 1 ms after"} the key before (t ${prevT})`, "sort the keys by time and keep them at least 1 ms apart");
      if (Number.isFinite(dur) && t > dur + 1e-9) {
        past++;
        if (past > 1 || t - dur > LIMITS.pastDur + 1e-9) f.add("M2-E011", kat("t"), `t ${t} is past dur ${dur} ${past > 1 ? "and another key already is" : `by more than ${LIMITS.pastDur * 1000} ms`}`, "only the capture's last frame may sit just past dur");
      }
      prevT = t;
    }
    for (const [name, spec] of Object.entries(KEY_FIELDS)) {
      const v = k[name];
      if (v === undefined) {
        if (spec.required) f.add("M2-E003", kat(name), `the key has no "${name}"`, `every key has ${Object.keys(KEY_FIELDS).filter((n) => KEY_FIELDS[n]!.required).join(", ")}`);
        continue;
      }
      if (!Array.isArray(v)) {
        f.add("M2-E004", kat(name), `"${name}" is a list of numbers`);
        continue;
      }
      if (v.length !== spec.parts.length) {
        f.add("M2-E006", kat(name), `"${name}" has ${v.length} values; it takes ${spec.parts.length}: [${spec.parts.join(", ")}]`);
        continue;
      }
      v.forEach((x, j) => {
        const part = spec.parts[j]!;
        if (typeof x !== "number") f.add("M2-E004", kat(name, j), `${part} ${JSON.stringify(x)} is not a number`);
        else if (!Number.isFinite(x)) f.add("M2-E005", kat(name, j), `${part} is ${x}`);
        else if (!Number.isInteger(x)) f.add("M2-E007", kat(name, j), `${part} ${x} is not a whole number`, `round it: ${Math.round(x)}`);
        else {
          const [lo, hi] = spec.ranges[j]!;
          if (x < lo || x > hi) f.add("M2-E014", kat(name, j), `${part} ${x} is outside ${lo}..${hi}`);
          else if (spec.angles.includes(j) && Math.abs(x) > ANGLE_WARN) f.add("M2-W005", kat(name, j), `${part} ${x} is past ±${ANGLE_WARN} degrees`, "fold it by 360 if the motion allows; a spin may need it");
        }
      });
      if (spec.direction && v.length >= 3 && v[0] === 0 && v[1] === 0 && v[2] === 0) f.add("M2-E019", kat(name), `"${name}" points nowhere: [0, 0, 0]`, "give the direction it points, as percentages");
    }
    if (k.yaw !== undefined) {
      if (typeof k.yaw !== "number" || !Number.isFinite(k.yaw)) f.add("M2-E004", kat("yaw"), "yaw is one finite number of degrees");
      else if (!Number.isInteger(k.yaw)) f.add("M2-E007", kat("yaw"), `yaw ${k.yaw} is not a whole number`);
      else if (Math.abs(k.yaw) > ANGLE_MAX) f.add("M2-E014", kat("yaw"), `yaw ${k.yaw} is outside ±${ANGLE_MAX}`);
    }
    if (lint) for (const name of Object.keys(k)) if (!KEY_NAMES.includes(name)) f.add("M2-W001", kat(name), `unknown key field "${name}"`, nearest(name, KEY_NAMES) ? `did you mean "${nearest(name, KEY_NAMES)}"?` : "readers ignore it");
  });

  // ---- contacts and events
  if (data.contacts !== undefined) contacts(f, at, data.contacts, dur, data.loop === true);
  if (data.events !== undefined) events(f, at, data.events, dur);

  // ---- warnings: format 1's known motion faults
  const good = keys.filter(isObj) as Record<string, unknown>[];
  for (const name of Object.keys(KEY_FIELDS).filter((n) => !KEY_FIELDS[n]!.required).concat(["yaw"])) {
    const n = good.filter((k) => k[name] !== undefined).length;
    if (n > 0 && n < good.length) f.add("M2-W006", at({ field: name }), `"${name}" is in ${n} of ${good.length} keys`, "give it every key or none: in-betweens take it only from keys that have it");
  }
  good.forEach((k, i) => {
    const hips = k.hips;
    if (Array.isArray(hips) && typeof hips[2] === "number" && hips[2] < 0) f.add("M2-W003", at({ key: i + 1, t: k.t as number, field: "hips", index: 2 }), `up ${hips[2]}: the hips are below the floor`, "baseline it if the motion means it (a swim, a dig); otherwise lift the clip");
  });
  for (const limb of ["armL", "armR", "legL", "legR"]) {
    for (let i = 1; i < good.length; i++) {
      const a = good[i - 1]![limb];
      const b = good[i]![limb];
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 5 || b.length !== 5 || !a.every(Number.isFinite) || !b.every(Number.isFinite)) continue;
      const where = at({ key: i + 1, t: good[i]!.t as number, field: limb });
      if (Math.abs((b[4] as number) - (a[4] as number)) > 120 && Math.max(a[3] as number, b[3] as number) > 140) f.add("M2-W002", { ...where, index: 4 }, `twist jumps ${(a[4] as number)} to ${(b[4] as number)} while the bend is over 140 (format 1's pop)`, "re-import from the source (WP-5.3), or baseline it");
      const dot = (a[0] as number) * (b[0] as number) + (a[1] as number) * (b[1] as number) + (a[2] as number) * (b[2] as number);
      const la = Math.hypot(a[0] as number, a[1] as number, a[2] as number);
      const lb = Math.hypot(b[0] as number, b[1] as number, b[2] as number);
      if (la > 0 && lb > 0 && dot / (la * lb) < -0.9) f.add("M2-W004", where, "the limb points nearly opposite the key before, so the in-between passes through its root", "add a key between them where the limb swings round");
    }
  }
  return f.result();
}

function provenance(f: Findings, at: (w?: Where) => Where, p: unknown): void {
  if (p === undefined) return void f.add("M2-E003", at({ field: "provenance" }), "\"provenance\" is missing", "every clip says where it came from (spec/MOTION.md §7.4)");
  if (!isObj(p)) return void f.add("M2-E004", at({ field: "provenance" }), "provenance is an object");
  for (const k of ["src", "method", "license", "ai"]) if (typeof p[k] !== "string" || !p[k]) f.add(p[k] === undefined ? "M2-E003" : "M2-E004", at({ field: `provenance.${k}` }), `provenance.${k} is ${p[k] === undefined ? "missing" : "not a word"}`);
  if (!isObj(p.producer) || typeof p.producer.tool !== "string" || typeof p.producer.version !== "string") f.add(p.producer === undefined ? "M2-E003" : "M2-E004", at({ field: "provenance.producer" }), "provenance.producer is { tool, version }", "name the tool and version that wrote the clip");
  if (typeof p.method === "string" && !(METHODS as readonly string[]).includes(p.method)) f.add("M2-E016", at({ field: "provenance.method" }), `method "${p.method}" is not one of ${METHODS.join(", ")}`);
  const ai = Object.values(IPTC) as string[];
  if (typeof p.ai === "string" && !ai.includes(p.ai)) f.add("M2-E016", at({ field: "provenance.ai" }), `ai "${p.ai}" is not an IPTC digital source type this format uses`, `one of ${ai.join(", ")}`);
  if (typeof p.license === "string" && /^(CC-BY-|LicenseRef-CMU)/.test(p.license) && !(typeof p.credit === "string" && p.credit.trim())) f.add("M2-E018", at({ field: "provenance.credit" }), `license ${p.license} needs a credit line`, "add the attribution a game shows");
}

function quality(f: Findings, at: (w?: Where) => Where, q: unknown): void {
  if (q === undefined) return void f.add("M2-E003", at({ field: "quality" }), "\"quality\" is missing", "every clip carries its fit and QA verdict");
  if (!isObj(q)) return void f.add("M2-E004", at({ field: "quality" }), "quality is an object");
  const fit = q.fit;
  if (!Array.isArray(fit) || fit.length !== 2 || !fit.every((x) => Number.isInteger(x) && (x as number) >= 0)) f.add(fit === undefined ? "M2-E003" : "M2-E004", at({ field: "quality.fit" }), "quality.fit is [mean, worst], whole millimetres", "measure it against the source frames the clip was fitted from; [0, 0] only when there were none (spec/MOTION.md §7.5)");
  if (!(QA_VERDICTS as readonly unknown[]).includes(q.qa)) f.add(q.qa === undefined ? "M2-E003" : "M2-E016", at({ field: "quality.qa" }), `qa ${JSON.stringify(q.qa)} is not one of ${QA_VERDICTS.join(", ")}`);
  if (typeof q.qaVersion !== "string") f.add(q.qaVersion === undefined ? "M2-E003" : "M2-E004", at({ field: "quality.qaVersion" }), "quality.qaVersion is a string");
  if (q.qa === "baselined" && !(typeof q.baseline === "string" && q.baseline.trim())) f.add("M2-E003", at({ field: "quality.baseline" }), "a baselined clip gives its reason", "add quality.baseline: why the warnings are accepted");
}

function review(f: Findings, at: (w?: Where) => Where, r: unknown): void {
  if (!isObj(r)) return void f.add("M2-E004", at({ field: "review" }), "review is an object");
  if (!(REVIEW_STATES as readonly unknown[]).includes(r.state)) f.add("M2-E016", at({ field: "review.state" }), `state ${JSON.stringify(r.state)} is not one of ${REVIEW_STATES.join(", ")}`);
  if (typeof r.by !== "string") f.add("M2-E004", at({ field: "review.by" }), "review.by names the reviewer");
  if (typeof r.date !== "string" || !DATE.test(r.date)) f.add("M2-E017", at({ field: "review.date" }), `date ${JSON.stringify(r.date)} is not YYYY-MM-DD`);
  if (typeof r.motion !== "string" || !HEX64.test(r.motion)) f.add("M2-E017", at({ field: "review.motion" }), "review.motion is the SHA-256 of the motion reviewed, 64 lower-case hex digits");
}

function contacts(f: Findings, at: (w?: Where) => Where, c: unknown, dur: number, loop: boolean): void {
  if (!isObj(c)) return void f.add("M2-E004", at({ field: "contacts" }), "contacts is an object of intervals per end");
  if (c.by !== "detected" && c.by !== "labelled") f.add(c.by === undefined ? "M2-E003" : "M2-E016", at({ field: "contacts.by" }), `contacts.by ${JSON.stringify(c.by)} is not "detected" or "labelled"`);
  for (const [end, list] of Object.entries(c)) {
    if (end === "by") continue;
    if (!(CONTACT_ENDS as readonly string[]).includes(end)) {
      f.add("M2-E016", at({ field: `contacts.${end}` }), `"${end}" is not an end`, `ends are ${CONTACT_ENDS.join(", ")}${nearest(end, CONTACT_ENDS) ? `; did you mean ${nearest(end, CONTACT_ENDS)}?` : ""}`);
      continue;
    }
    if (!Array.isArray(list) || !list.every((iv) => Array.isArray(iv) && iv.length === 2 && iv.every((x) => typeof x === "number" && Number.isFinite(x)))) {
      f.add("M2-E004", at({ field: `contacts.${end}` }), "intervals are [from, to] pairs of seconds");
      continue;
    }
    if (list.length > LIMITS.contacts) f.add("M2-E010", at({ field: `contacts.${end}` }), `${list.length} intervals is over the ${LIMITS.contacts} limit`);
    (list as [number, number][]).forEach(([from, to], i) => {
      const where = at({ field: `contacts.${end}`, index: i });
      const last = i === list.length - 1;
      if (!(from >= 0 && from < to)) f.add("M2-E012", where, `[${from}, ${to}] must have 0 <= from < to`);
      else if (Number.isFinite(dur) && from > dur) f.add("M2-E012", where, `[${from}, ${to}] starts after dur ${dur}`);
      else if (Number.isFinite(dur) && to > dur + 1e-9 && !(loop && last && to - dur <= ((list[0] as [number, number])[0] ?? 0) + 1e-9)) f.add("M2-E012", where, `[${from}, ${to}] ends after dur ${dur}`, loop ? "only a loop's last interval may wrap, and not past its first" : "end it at dur");
      if (i > 0 && from < (list[i - 1] as [number, number])[1]) f.add("M2-E012", where, `[${from}, ${to}] starts before the interval before it ends`, "sort the intervals and merge overlaps");
    });
  }
}

function events(f: Findings, at: (w?: Where) => Where, e: unknown, dur: number): void {
  if (!Array.isArray(e)) return void f.add("M2-E004", at({ field: "events" }), "events is a list of { t, name }");
  if (e.length > LIMITS.events) f.add("M2-E010", at({ field: "events" }), `${e.length} events is over the ${LIMITS.events} limit`);
  let prev = -Infinity;
  e.forEach((ev, i) => {
    const where = at({ field: "events", index: i });
    if (!isObj(ev) || typeof ev.t !== "number" || typeof ev.name !== "string") return void f.add("M2-E004", where, "an event is { t, name, ... }");
    if (!EVENT.test(ev.name)) f.add("M2-E013", where, `name "${ev.name}" is not a lower-case word`, "hit, step, release, land, launch, grab, or your own lower-case name");
    if (ev.t < 0 || (Number.isFinite(dur) && ev.t > dur + 1e-9)) f.add("M2-E013", where, `t ${ev.t} is outside 0..${dur}`);
    if (ev.t < prev) f.add("M2-E013", where, `t ${ev.t} comes before the event before it (t ${prev})`, "sort the events by time");
    prev = ev.t;
  });
}
