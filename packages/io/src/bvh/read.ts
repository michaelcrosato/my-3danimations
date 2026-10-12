// BioVision hierarchy files (.bvh; PLAN.md WP-5.2; carried from shardfall crates/pav_tools/src/mocap/bvh.rs as a
// reference): a skeleton (joints, offsets, channels), then every frame's channel values. Forward kinematics gives each
// joint's world rotation and place; the 36 body points sit on joints by a bone map (100STYLE's skeleton, the
// MotionBuilder names Mixamo, LaFAN1 and most converters use, Bandai Namco's, Unreal's and Rigify's), and takes are
// cut into clips as CMU's are (`takes.ts`). Files differ in two ways the reader allows for: position channels give a
// joint's place in its parent outright (exporters that key every joint's translation repeat its offset there), and a
// skeleton's zero pose isn't always standing (MotionBuilder exports lay bones along their own x axes), so the rest is
// the frame where the body stands straightest. The units come from the legs' length, read as a person's.
import { format, math } from "@m3a/core";
import { checkText, IoError, LIMITS, spend } from "../bytes.ts";
import type { Capture } from "../gltf/read.ts";
import { cutPicks, restCapture, type Facing, type Pick, type V3 } from "../takes.ts";

const { PORTABLE } = math;
type M3 = number[];
type Chan = { pos: boolean; axis: number };

/** A parsed .bvh file: joints (parents first), their offsets, channels and end sites, and the frames' values. */
export interface Bvh {
  names: string[];
  parent: (number | null)[];
  offset: V3[];
  chans: Chan[][];
  first: number[];
  end: (V3 | null)[];
  /** Seconds a frame. */
  frameTime: number;
  width: number;
  values: Float64Array;
  /** Joint transforms given outright (a glTF or VRMA animation): each joint's at rest, how many frames, and a frame's
   *  when asked for, relative to its parent (rotation, place in file units); the channels then go unused. */
  poses?: { bind: [M3, V3][]; count: number; at(frame: number): [M3, V3][] };
}

/** A .bvh file's text. */
export function parseBvh(text: string, file?: string): Bvh {
  checkText(text, file);
  const re = /\S+/g, line = (at: number) => text.slice(0, at).split("\n").length;
  let m: RegExpExecArray | null, at = 0;
  const next = (): string | undefined => {
    m = re.exec(text);
    if (!m) return undefined;
    at = m.index;
    return m[0];
  };
  const fail = (msg: string) => new IoError("E_FORMAT", `line ${line(at)}: ${msg}`, { file });
  const num = (t: string | undefined, what: string): number => {
    if (t === undefined) throw fail(`the file ends early (${what})`);
    const v = Number(t);
    if (!Number.isFinite(v)) throw fail(`${what} isn't a number ("${t}")`);
    return v;
  };
  const b = { names: [] as string[], parent: [] as (number | null)[], offset: [] as V3[], chans: [] as Chan[][], first: [] as number[], end: [] as (V3 | null)[], frameTime: 0, width: 0 };
  const stack: number[] = [];
  let frames = 0, t: string | undefined, motion = false;
  while ((t = next()) !== undefined) {
    if (t === "HIERARCHY" || t === "{" || t === "MOTION") continue;
    if (t === "ROOT" || t === "JOINT") {
      const name = next();
      if (name === undefined) throw fail("a joint without a name");
      if (b.names.length >= LIMITS.nodes) throw fail("too many joints");
      b.names.push(name);
      b.parent.push(stack.length ? stack[stack.length - 1]! : null);
      b.offset.push([0, 0, 0]);
      b.chans.push([]);
      b.first.push(0);
      b.end.push(null);
      stack.push(b.names.length - 1);
    } else if (t === "End") {
      next();
      let off: V3 = [0, 0, 0], u: string | undefined;
      while ((u = next()) !== undefined && u !== "}") if (u === "OFFSET") off = [num(next(), "an end site's offset"), num(next(), "an end site's offset"), num(next(), "an end site's offset")];
      if (stack.length && !b.end[stack[stack.length - 1]!]) b.end[stack[stack.length - 1]!] = off;
    } else if (t === "OFFSET") {
      if (!stack.length) throw fail("OFFSET outside a joint");
      b.offset[stack[stack.length - 1]!] = [num(next(), "an offset"), num(next(), "an offset"), num(next(), "an offset")];
    } else if (t === "CHANNELS") {
      if (!stack.length) throw fail("CHANNELS outside a joint");
      const j = stack[stack.length - 1]!, n = num(next(), "a channel count");
      if (!Number.isInteger(n) || n < 0 || n > 9) throw fail(`${n} channels on one joint`);
      b.first[j] = b.width;
      for (let k = 0; k < n; k++) {
        const c = next()?.toLowerCase();
        if (c === undefined) throw fail("the file ends early (a channel)");
        const axis = { x: 0, y: 1, z: 2 }[c[0]!];
        if (axis === undefined || !/(position|rotation)$/.test(c)) throw fail(`channel "${c}" isn't read`);
        b.chans[j]!.push({ pos: c.endsWith("position"), axis });
      }
      b.width += n;
    } else if (t === "}") stack.pop();
    else if (t === "Frames:") frames = num(next(), "the frame count");
    else if (t === "Frame") {
      next();
      b.frameTime = num(next(), "the frame time");
      motion = true;
      break;
    } else throw fail(`unexpected "${t}" in the hierarchy`);
  }
  if (!b.names.length) throw new IoError("E_FORMAT", "no joints: not a BVH file", { file });
  if (!motion) throw new IoError("E_FORMAT", "no MOTION section with a Frame Time", { file });
  if (frames * b.width > LIMITS.values) throw new IoError("E_LIMIT", `${frames} frames of ${b.width} values, over the limit`, { file });
  spend(frames, LIMITS.frames, `${frames} frames`, file);
  spend(frames * b.names.length, LIMITS.work, `${frames} frames of ${b.names.length} joints`, file);
  const vals: number[] = [];
  while ((t = next()) !== undefined) {
    const v = Number(t);
    if (!Number.isFinite(v)) throw fail(`a frame value isn't a number ("${t}")`);
    if (vals.length >= LIMITS.values) throw new IoError("E_LIMIT", "over the limit of frame values", { file });
    vals.push(v);
  }
  if (b.width === 0 || vals.length < b.width) throw new IoError("E_FORMAT", "no frames", { file });
  // the frames the values make, whatever the header said
  spend(Math.floor(vals.length / b.width), LIMITS.frames, `${Math.floor(vals.length / b.width)} frames`, file);
  spend(Math.floor(vals.length / b.width) * b.names.length, LIMITS.work, `${Math.floor(vals.length / b.width)} frames of ${b.names.length} joints`, file);
  const values = Float64Array.from(vals.slice(0, Math.floor(vals.length / b.width) * b.width));
  return { ...b, frameTime: b.frameTime > 0 ? b.frameTime : 1 / 30, values };
}

/* ---- 3x3 matrices, row major ---- */
const mm = (a: M3, b: M3): M3 => {
  const o = new Array<number>(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
  return o;
};
const mv = (m: M3, v: V3): V3 => [m[0]! * v[0]! + m[1]! * v[1]! + m[2]! * v[2]!, m[3]! * v[0]! + m[4]! * v[1]! + m[5]! * v[2]!, m[6]! * v[0]! + m[7]! * v[1]! + m[8]! * v[2]!];
const mtv = (m: M3, v: V3): V3 => [m[0]! * v[0]! + m[3]! * v[1]! + m[6]! * v[2]!, m[1]! * v[0]! + m[4]! * v[1]! + m[7]! * v[2]!, m[2]! * v[0]! + m[5]! * v[1]! + m[8]! * v[2]!];
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const rot = (axis: number, deg: number): M3 => {
  const a = (deg * Math.PI) / 180, c = PORTABLE.cos(a), s = PORTABLE.sin(a);
  return axis === 0 ? [1, 0, 0, 0, c, -s, 0, s, c] : axis === 1 ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
};
const add = (a: V3, b: V3): V3 => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
const sub = (a: V3, b: V3): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const scl = (a: V3, k: number): V3 => [a[0]! * k, a[1]! * k, a[2]! * k];
const len = (a: V3) => PORTABLE.hypot(a[0]!, a[1]!, a[2]!);
const unitOr = (a: V3, or: V3): V3 => {
  const l = len(a);
  return l > 1e-12 ? scl(a, 1 / l) : or;
};

/** How many frames a file holds. */
export const bvhFrames = (b: Bvh): number => (b.poses ? b.poses.count : b.values.length / b.width);

/** Each joint's world rotation and place (file units) at a frame (null: the zero pose). */
export function bvhPose(b: Bvh, frame: number | null): [M3, V3][] {
  const out: [M3, V3][] = [], given = b.poses ? (frame === null ? b.poses.bind : b.poses.at(frame)) : null;
  for (let j = 0; j < b.names.length; j++) {
    let r = I3;
    let t: V3 = [...b.offset[j]!];
    if (given) [r, t] = given[j]!;
    else if (frame !== null) {
      const v = frame * b.width + b.first[j]!;
      b.chans[j]!.forEach((c, k) => {
        const x = b.values[v + k]!;
        if (c.pos) t[c.axis] = x;
        else r = mm(r, rot(c.axis, x));
      });
    }
    const p = b.parent[j];
    out.push(p === null || p === undefined ? [r, t] : [mm(out[p]![0], r), add(out[p]![1], mv(out[p]![0], t))]);
  }
  return out;
}

/** Where a body point sits on a joint: the joint, its far end, a share along, 12 cm ahead, or across the hand. */
type Place = ["joint"] | ["tip"] | ["along", number] | ["ahead"] | ["across", number, number];
/** A bone map: the joints only this skeleton has, `{S}` on each side, and each point's joints (the first a file has wins). */
interface Map {
  name: string;
  test: string[];
  sides: [string, string];
  points: [string, Place][][];
}
const J: Place = ["joint"], T: Place = ["tip"], A: Place = ["ahead"];
const MAPS: Map[] = [
  { name: "100style", test: ["Chest4", "RightCollar"], sides: ["Left", "Right"], points: [
    [["Hips", J]], [["Chest", J]], [["Chest2", J]], [["Chest4", J]], [["Neck", J]], [["Head", J]], [["Head", T]], [["Head", A]], [["Chest4", A]], [["Hips", A]],
    [["{S}Collar", J]], [["{S}Shoulder", J]], [["{S}Elbow", J]], [["{S}Wrist", J]], [["{S}Wrist", ["across", 0.75, 1]]], [["{S}Wrist", ["along", 0.5]]], [["{S}Wrist", ["across", 0.75, -1]]], [["{S}Wrist", ["along", 0.75]]],
    [["{S}Hip", J]], [["{S}Knee", J]], [["{S}Ankle", J]], [["{S}Toe", J]], [["{S}Toe", T]],
  ] },
  { name: "motionbuilder", test: ["LeftUpLeg", "LeftForeArm"], sides: ["Left", "Right"], points: [
    [["Hips", J]], [["Spine", J]], [["Spine1", J]], [["Spine2", J], ["Spine1", ["along", 0.5]]], [["Neck", J]], [["Head", J]], [["HeadTop_End", J], ["Head", T]], [["Head", A]], [["Spine2", A], ["Spine1", A]], [["Hips", A]],
    [["{S}Shoulder", J]], [["{S}Arm", J]], [["{S}ForeArm", J]], [["{S}Hand", J]], [["{S}HandIndex1", J], ["{S}Hand", ["across", 0.75, 1]]], [["{S}HandMiddle1", J], ["{S}Hand", ["along", 0.5]]],
    [["{S}HandPinky1", J], ["{S}Hand", ["across", 0.75, -1]]], [["{S}HandMiddle2", J], ["{S}Hand", ["along", 0.75]]],
    [["{S}UpLeg", J]], [["{S}Leg", J]], [["{S}Foot", J]], [["{S}ToeBase", J], ["{S}Toe", J]], [["{S}Toe_End", J], ["{S}ToeBase", T], ["{S}Toe", T]],
  ] },
  { name: "bandai-namco", test: ["UpperLeg_L", "LowerArm_L"], sides: ["_L", "_R"], points: [
    [["Hips", J]], [["Spine", J]], [["Spine", ["along", 0.5]]], [["Chest", J]], [["Neck", J]], [["Head", J]], [["Head", T]], [["Head", A]], [["Chest", A]], [["Hips", A]],
    [["Shoulder{S}", J]], [["UpperArm{S}", J]], [["LowerArm{S}", J]], [["Hand{S}", J]], [["Hand{S}", ["across", 0.75, 1]]], [["Hand{S}", ["along", 0.5]]], [["Hand{S}", ["across", 0.75, -1]]], [["Hand{S}", ["along", 0.75]]],
    [["UpperLeg{S}", J]], [["LowerLeg{S}", J]], [["Foot{S}", J]], [["Toes{S}", J]], [["Toes{S}", T]],
  ] },
  { name: "unreal", test: ["spine_01", "upperarm_l"], sides: ["_l", "_r"], points: [
    [["pelvis", J]], [["spine_01", J]], [["spine_02", J]], [["spine_03", J]], [["neck_01", J]], [["head", J]], [["head", T]], [["head", A]], [["spine_03", A]], [["pelvis", A]],
    [["clavicle{S}", J]], [["upperarm{S}", J]], [["lowerarm{S}", J]], [["hand{S}", J]], [["index_01{S}", J], ["hand{S}", ["across", 0.75, 1]]], [["middle_01{S}", J], ["hand{S}", ["along", 0.5]]],
    [["pinky_01{S}", J], ["hand{S}", ["across", 0.75, -1]]], [["middle_02{S}", J], ["hand{S}", ["along", 0.75]]],
    [["thigh{S}", J]], [["calf{S}", J]], [["foot{S}", J]], [["ball{S}", J]], [["ball_leaf{S}", J], ["ball{S}", T]],
  ] },
  { name: "rigify", test: ["DEF-hips", "DEF-upper_arm.L"], sides: [".L", ".R"], points: [
    [["DEF-hips", J]], [["DEF-spine.001", J]], [["DEF-spine.002", J]], [["DEF-spine.003", J]], [["DEF-neck", J]], [["DEF-head", J]], [["DEF-head", T]], [["DEF-head", A]], [["DEF-spine.003", A]], [["DEF-hips", A]],
    [["DEF-shoulder{S}", J]], [["DEF-upper_arm{S}", J]], [["DEF-forearm{S}", J]], [["DEF-hand{S}", J]], [["DEF-f_index.01{S}", J], ["DEF-hand{S}", ["across", 0.75, 1]]], [["DEF-f_middle.01{S}", J], ["DEF-hand{S}", ["along", 0.5]]],
    [["DEF-f_pinky.01{S}", J], ["DEF-hand{S}", ["across", 0.75, -1]]], [["DEF-f_middle.02{S}", J], ["DEF-hand{S}", ["along", 0.75]]],
    [["DEF-thigh{S}", J]], [["DEF-shin{S}", J]], [["DEF-foot{S}", J]], [["DEF-toe{S}", J]], [["DEF-toe{S}", T]],
  ] },
  // VRM 1.0's humanoid names (a VRMA's nodes, named by the bones they play): upperChest, fingers, shoulders and toes
  // are optional there, so each has a fallback
  { name: "vrm", test: ["hips", "leftUpperLeg", "leftLowerArm"], sides: ["left", "right"], points: [
    [["hips", J]], [["spine", J]], [["chest", J]], [["upperChest", J], ["chest", ["along", 0.5]]], [["neck", J]], [["head", J]], [["head", T]], [["head", A]], [["upperChest", A], ["chest", A]], [["hips", A]],
    [["{S}Shoulder", J], ["{S}UpperArm", J]], [["{S}UpperArm", J]], [["{S}LowerArm", J]], [["{S}Hand", J]], [["{S}IndexProximal", J], ["{S}Hand", ["across", 0.75, 1]]], [["{S}MiddleProximal", J], ["{S}Hand", ["along", 0.5]]],
    [["{S}LittleProximal", J], ["{S}Hand", ["across", 0.75, -1]]], [["{S}MiddleIntermediate", J], ["{S}Hand", ["along", 0.75]]],
    [["{S}UpperLeg", J]], [["{S}LowerLeg", J]], [["{S}Foot", J]], [["{S}Toes", J], ["{S}Foot", ["along", 0.7]]], [["{S}Toes", T], ["{S}Foot", T]],
  ] },
];

/** A joint by name, ignoring case and a namespace prefix ("mixamorig:Hips"). */
function find(b: Bvh, name: string): number | null {
  const want = name.toLowerCase(), i = b.names.findIndex((n) => (n.split(":").pop() ?? n).toLowerCase() === want || n.toLowerCase() === want);
  return i < 0 ? null : i;
}
/** A joint's far end at rest, in its own frame: its end site, else its first child's offset. */
function tip(b: Bvh, j: number): V3 {
  if (b.end[j]) return b.end[j]!;
  const c = b.parent.findIndex((p) => p === j);
  return c >= 0 ? b.offset[c]! : [0, 0, 0];
}
/** How far past a joint whose far end has no length its end is taken to be (metres): head 18 cm, hand 18, foot 6. */
const reach = (point: number): number => {
  const part = point >= 10 ? (point - 10) % 13 : -1;
  return point === 6 ? 0.18 : [4, 5, 6, 7].includes(part) ? 0.18 : [11, 12].includes(part) ? 0.06 : 0.1;
};
const side = (s: number, part: number) => 10 + s * 13 + part;
const HIP = 8, KNEE = 9, ANKLE = 10, TOE = 12, HEAD = 5;

/** A skeleton with its body points placed: the map, metres per file unit, the rest frame, and its facing. */
export interface RiggedBvh {
  bvh: Bvh;
  map: string;
  scale: number;
  at: [number, V3][];
  /** The frame it was measured standing in (null: the zero pose). */
  restFrame: number | null;
  /** How straight it stands there (1: legs straight down, feet level). */
  stands: number;
  rest: V3[];
  facing: Facing;
}

/** Places the 36 body points on a parsed file (`units`: metres a file unit; found from the legs when not given). */
export function rigBvh(b: Bvh, opts: { units?: number; file?: string } = {}): RiggedBvh {
  const map = MAPS.find((m) => m.test.every((t) => find(b, t) !== null));
  if (!map) throw new IoError("E_RIG", `the skeleton isn't one the BVH reader knows (100STYLE's, MotionBuilder's: Hips, Spine, LeftUpLeg ..., Bandai Namco's, Unreal's, Rigify's); its joints: ${b.names.slice(0, 40).join(", ")}`, { file: opts.file });
  const placed: [number, Place][] = [], missing: string[] = [];
  format.POINTS.forEach((p, i) => {
    const alts = i < 10 ? map.points[i]! : map.points[10 + ((i - 10) % 13)]!, s = i < 10 ? "" : map.sides[p.endsWith("L") ? 0 : 1];
    const hit = alts.map(([n, pl]) => [find(b, n.replace("{S}", s)), pl] as const).find(([j]) => j !== null);
    if (hit) placed.push([hit[0]!, hit[1]]);
    else missing.push(alts[0]![0].replace("{S}", s));
  });
  if (missing.length) throw new IoError("E_RIG", `the ${map.name} map needs joints the file lacks: ${[...new Set(missing)].join(", ")}`, { file: opts.file });
  const zero = bvhPose(b, null), jt = (s: number, part: number) => placed[side(s, part)]![0];
  const leg = (s: number) => len(sub(zero[jt(s, HIP)]![1], zero[jt(s, KNEE)]![1])) + len(sub(zero[jt(s, KNEE)]![1], zero[jt(s, ANKLE)]![1]));
  const legs = [leg(0), leg(1)];
  const stands = (pose: [M3, V3][]) => {
    const down = (s: number) => (pose[jt(s, HIP)]![1][1]! - pose[jt(s, ANKLE)]![1][1]!) / Math.max(legs[s]!, 1e-9);
    const level = Math.abs(pose[jt(0, ANKLE)]![1][1]! - pose[jt(1, ANKLE)]![1][1]!) / Math.max(legs[0]!, 1e-9);
    const upright = pose[placed[HEAD]![0]]![1][1]! > pose[placed[0]![0]]![1][1]! ? 0 : 1;
    return Math.min(down(0), down(1)) - level - upright;
  };
  // the rest: the zero pose when the body stands in it, else the frame it stands straightest in (every tenth looked
  // at, then the frames around the best)
  const n = bvhFrames(b), zs = stands(zero);
  let restFrame: number | null = null, stood = zs;
  if (!(zs > 0.9)) {
    const best = (frames: number[]) => frames.map((f) => [stands(bvhPose(b, f)), f] as const).reduce((a, x) => (x[0] > a[0] ? x : a), [-Infinity, 0] as readonly [number, number]);
    const coarse = best(Array.from({ length: Math.ceil(n / 10) }, (_, k) => k * 10)), lo = Math.max(0, coarse[1] - 9);
    const fine = best(Array.from({ length: Math.min(coarse[1] + 10, n) - lo }, (_, k) => lo + k));
    [stood, restFrame] = [fine[0], fine[1]];
  }
  const rest = bvhPose(b, restFrame);
  // units: the legs' length read as a person's (about 85 cm)
  const l = (legs[0]! + legs[1]!) / 2;
  const scale = opts.units ?? [1, 0.01, 0.001, 0.0254, 0.0254 / 0.45].reduce((a, x) => (Math.abs(PORTABLE.log((x * l) / 0.85)) < Math.abs(PORTABLE.log((a * l) / 0.85)) ? x : a));
  // a joint's far end in its own frame: the file's, else `reach` metres along the bone leading to it, as it lies at rest
  const tipOf = (j: number, point: number): V3 => {
    const t = tip(b, j);
    if (len(t) > 1e-9) return t;
    let p = b.parent[j];
    while (p !== null && p !== undefined && len(sub(rest[j]![1], rest[p]![1])) < 1e-9) p = b.parent[p];
    const dir = p === null || p === undefined ? [0, 1, 0] : unitOr(sub(rest[j]![1], rest[p]![1]), [0, 1, 0]);
    return scl(mtv(rest[j]![0], dir), reach(point) / scale);
  };
  const world = (i: number): V3 => {
    const [j, pl] = placed[i]!, [m, p] = rest[j]!;
    return add(p, mv(m, pl[0] === "tip" ? tipOf(j, i) : [0, 0, 0]));
  };
  // forward from the heel toward the toes (square to the hips in a captured frame), right toward the right hip
  const ankle = world(side(0, ANKLE)), toe = world(side(0, TOE)), hl = world(side(0, HIP)), hr = world(side(1, HIP));
  let f = unitOr([toe[0]! - ankle[0]!, 0, toe[2]! - ankle[2]!], [0, 0, 1]);
  if (restFrame !== null) {
    const square = unitOr([-(hr[2]! - hl[2]!), 0, hr[0]! - hl[0]!], f);
    f = square[0]! * f[0]! + square[2]! * f[2]! < 0 ? scl(square, -1) : square;
  }
  let right: V3 = [f[2]!, 0, -f[0]!];
  if ((hr[0]! - hl[0]!) * right[0]! + (hr[2]! - hl[2]!) * right[2]! < 0) right = scl(right, -1);
  const at = placed.map(([j, pl], i): [number, V3] => {
    const ahead = scl(mtv(rest[j]![0], f), 1 / scale);
    const local = pl[0] === "joint" ? [0, 0, 0] : pl[0] === "tip" ? tipOf(j, i) : pl[0] === "along" ? scl(tipOf(j, i), pl[1]) : pl[0] === "ahead" ? scl(ahead, 0.12) : add(scl(tipOf(j, i), pl[1]), scl(ahead, 0.035 * pl[2]));
    return [j, local];
  });
  const r: RiggedBvh = { bvh: b, map: map.name, scale, at, restFrame, stands: stood, rest: [], facing: { fwd: f, right } };
  r.rest = bvhPoints(r, rest);
  return r;
}

/** The 36 body points (metres, world) of a pose of the joints. */
export function bvhPoints(r: RiggedBvh, pose: [M3, V3][]): V3[] {
  return r.at.map(([j, local]) => scl(add(pose[j]![1], mv(pose[j]![0], local)), r.scale));
}

/** A BVH library read: its picks (or each whole take) as body points, `_rest`, and its notes. */
export interface BvhLibrary {
  rig: string;
  clips: Record<string, Capture>;
  body: null;
  log: string[];
}

/**
 * Takes in BVH files cut into clips: `bvh(take)` gives a take's text; each pick a stretch of one (seconds, at the
 * file's own rate unless it says), or each take whole when there are no picks. The rest comes from the first take
 * (every take of a library shares its skeleton; a take whose joints differ is refused). `lenient`: a pick that can't
 * be cut is left out, the reason logged (`cutPicks`).
 */
export function readBvh(bvh: (take: string) => string, picks: readonly Pick[] | readonly string[], FPS = 30, opts: { units?: number; lenient?: boolean } = {}): BvhLibrary {
  const parsed = new Map<string, RiggedBvh>(), first: { r?: RiggedBvh } = {};
  const rigOf = (take: string): RiggedBvh => {
    let r = parsed.get(take);
    if (!r) {
      const b = parseBvh(bvh(take), `${take}.bvh`);
      if (first.r && b.names.join("\n") !== first.r.bvh.names.join("\n")) throw new IoError("E_RIG", "its joints differ from the library's first take's", { file: `${take}.bvh` });
      // the same skeleton (its joints and their offsets) takes the first take's rig; another is rigged on its own
      const same = first.r && b.offset.every((o, j) => o.every((x, k) => x === first.r!.bvh.offset[j]![k]));
      r = first.r && same ? { ...first.r, bvh: b } : rigBvh(b, { ...(opts.units !== undefined ? { units: opts.units } : {}), file: `${take}.bvh` });
      first.r ??= r;
      parsed.set(take, r);
    }
    return r;
  };
  const list: Pick[] = picks.map((p) => (typeof p === "string" ? { name: p, take: p } : p)).map((p) => {
    const r = rigOf(p.take);
    return { ...p, fps: p.fps ?? Math.round(1 / r.bvh.frameTime) };
  });
  if (!first.r) throw new IoError("E_MISSING", "no takes to read");
  const R = first.r;
  const takeOf = (take: string) => {
    const r = rigOf(take);
    return { frames: bvhFrames(r.bvh), points: (k: number) => bvhPoints(r, bvhPose(r.bvh, k)) };
  };
  const { clips, lows, log } = cutPicks(takeOf, R.facing, list, FPS, undefined, { lenient: !!opts.lenient });
  clips._rest = restCapture(R.rest, lows, R.facing, FPS);
  return { rig: `bvh:${R.map}`, clips, body: null, log: [`${R.map} skeleton, ${R.scale} m a unit, rest ${R.restFrame === null ? "the zero pose" : `frame ${R.restFrame}`} (stands ${R.stands.toFixed(2)})`, ...log] };
}
