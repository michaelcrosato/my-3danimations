// A deliberately broken implementation, for the kit's own tests (WP-10.2): the TypeScript reference's sidecar with the
// defects its argument names, comma-separated, so one process serves several cases (`round,swap`). Each is a way an
// implementation goes wrong that the kit must fail, naming the vector:
//   round     fit's mean error rounded to float32 (one number rounded differently)
//   swap      the two wrists swapped in every decoded pose (two points swapped)
//   nan       NaN, null on the wire, wherever the reference is zero: each decoded coordinate under 0.0005 mm, each
//             retargeted joint's coordinate that is 0
//   strings   every decoded coordinate written as a string
//   longlegs  the retargeted legs half as long again, along their own direction, with `bones` left empty to hide it
//   sink      every retargeted joint 10 mm lower, the soles under the floor
//   echo      every op but hello answered with its own request's fields
//   bare      hello answered with its protocol and ops alone (no implementation, no version)
// and two that break the wire after answering hello as the reference does:
//   null      the JSON line `null` in answer to the first request after hello
//   hang      no answer to anything after hello
import { format } from "@m3a/core";
import { createInterface } from "node:readline";
import { line, serve, type Request } from "../kit/wire.ts";
import { handle } from "./ts.ts";

/** The defects an answer can carry, by name. */
export const ANSWER_DEFECTS = ["round", "swap", "nan", "strings", "longlegs", "sink", "echo", "bare"] as const;
/** The defects that break the wire itself. */
export const WIRE_DEFECTS = ["null", "hang"] as const;
/** A defect's name. */
export type Defect = (typeof ANSWER_DEFECTS)[number] | (typeof WIRE_DEFECTS)[number];

type Joints = Record<string, number[]>;
/** Every number of `v`, at any depth (typed arrays read as arrays), passed through `f`. */
const each = (v: unknown, f: (x: number) => unknown): unknown =>
  typeof v === "number" ? f(v) : ArrayBuffer.isView(v) ? each(Array.from(v as unknown as ArrayLike<number>), f) : Array.isArray(v) ? v.map((x) => each(x, f)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, each(x, f)])) : v;
/** The joints with each leg's lower leg, foot and toes moved half as far again from its upper leg, along the same line. */
const longer = (J: Joints): Joints => {
  const out = { ...J };
  for (const s of ["left", "right"]) {
    const hip = J[s + "UpperLeg"]!;
    for (const b of ["LowerLeg", "Foot", "Toes"]) out[s + b] = J[s + b]!.map((x, i) => hip[i]! + (x - hip[i]!) * 1.5);
  }
  return out;
};

/** The answer `r` to `req` as the named defects break it (each applied in turn; ops a defect doesn't touch pass). */
export function breakAnswer(defects: readonly Defect[], req: Request, r: unknown): unknown {
  for (const d of defects) {
    const op = req.op;
    if (d === "round" && op === "fit") r = { ...(r as object), mean: Math.fround((r as { mean: number }).mean) };
    if (d === "swap" && op === "decode") {
      const L = format.IDX.wristL! * 3, R = format.IDX.wristR! * 3;
      r = (r as ArrayLike<number>[]).map((p) => Array.from(p, (x, i) => (i >= L && i < L + 3 ? p[i - L + R]! : i >= R && i < R + 3 ? p[i - R + L]! : x)));
    }
    if (d === "nan" && op === "decode") r = each(r, (x) => (Math.abs(x) < 0.0005 ? NaN : x));
    if (d === "nan" && op === "retarget") r = each(r, (x) => (x === 0 ? NaN : x));
    if (d === "strings" && op === "decode") r = each(r, (x) => String(x));
    if (d === "longlegs" && op === "retarget") {
      const a = r as { rest: Joints; poses: Joints[] };
      r = { bones: {}, rest: longer(a.rest), poses: a.poses.map(longer) };
    }
    if (d === "sink" && op === "retarget") {
      const a = r as { bones: Record<string, string>; rest: Joints; poses: Joints[] }, down = (J: Joints) => Object.fromEntries(Object.entries(J).map(([k, [f, s, u]]) => [k, [f!, s!, u! - 10]]));
      r = { bones: a.bones, rest: down(a.rest), poses: a.poses.map(down) };
    }
    if (d === "echo" && op !== "hello") r = Object.fromEntries(Object.entries(req).filter(([k]) => k !== "id" && k !== "op"));
    if (d === "bare" && op === "hello") r = { protocol: (r as { protocol: string }).protocol, ops: (r as { ops: string[] }).ops };
  }
  return r;
}

/** The defects named by a comma-separated argument, refused when one is unknown or a wire defect joins others. */
export function defectsOf(arg: string | undefined): Defect[] {
  const names = (arg ?? "").split(",") as Defect[], all: readonly string[] = [...ANSWER_DEFECTS, ...WIRE_DEFECTS];
  const bad = names.find((n) => !all.includes(n));
  if (bad !== undefined) throw new Error(`broken.ts takes its defects, comma-separated, of ${all.join(", ")}; not "${bad}"`);
  if (names.length > 1 && names.some((n) => (WIRE_DEFECTS as readonly string[]).includes(n))) throw new Error(`broken.ts: ${WIRE_DEFECTS.join(" and ")} break the wire and go alone`);
  return names;
}

/** Answer hello, then break the wire: `null` writes the JSON line null for the next request, `hang` answers nothing. */
async function breakWire(defect: "null" | "hang"): Promise<void> {
  for await (const text of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    const req = JSON.parse(text) as Request;
    if (req.op === "hello") process.stdout.write(line({ id: req.id, ok: true, result: handle(req) }) + "\n");
    else if (defect === "null") process.stdout.write("null\n");
  }
}

if (import.meta.main) {
  const defects = defectsOf(process.argv[2]);
  if (defects[0] === "null" || defects[0] === "hang") await breakWire(defects[0]);
  else await serve((req) => breakAnswer(defects, req, handle(req)));
}
