// recognize(skeleton): which source bone plays each VRM 1.0 humanoid bone (spec/SKELETON.md). First by name, against
// every mapping table; then, when names fail, by topology and geometry: the hips are where three long chains meet,
// the legs go down, the spine goes up to where the arms and neck branch. The result is plain JSON an agent can patch
// (`patchMapping`) and hand to a binder.
import { HUMANOID_BONES, HUMANOID_PARENT, REQUIRED_BONES } from "./bones.ts";
import { normalizeName, TABLES } from "./tables.ts";

/** A source bone: its name, its parent's name, and its rest head (joint) position in the source's units and axes. */
export interface BoneIn {
  name: string;
  parent?: string | null;
  head?: [number, number, number];
}

/** A source skeleton; `up` is its up axis (glTF's +y by default). */
export interface SkeletonIn {
  bones: BoneIn[];
  up?: [number, number, number];
}

/** Which source bone plays each humanoid bone, how sure, and what is missing or odd. */
export interface Recognition {
  method: "table" | "topology" | "none";
  table: string | null;
  confidence: number;
  bones: Record<string, string>;
  missing: string[];
  unmapped: string[];
  issues: string[];
}

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Recognize a skeleton: the best name table, or the topology fallback when names leave required bones unmapped. With
 * `table`, only that table is tried and its result stands, gaps included.
 */
export function recognize(sk: SkeletonIn, opts: { table?: string } = {}): Recognition {
  const byName = new Map(sk.bones.map((b) => [normalizeName(b.name), b.name]));
  let best: Recognition | null = null;
  let bestScore = -1;
  for (const t of TABLES) {
    if (opts.table && t.name !== opts.table) continue;
    const bones: Record<string, string> = {};
    for (const [bone, names] of Object.entries(t.bones)) {
      const hit = names.map(normalizeName).find((n) => byName.has(n));
      if (hit) bones[bone] = byName.get(hit)!;
    }
    const req = REQUIRED_BONES.filter((b) => bones[b]).length;
    const score = req * 1000 + Object.keys(bones).length;
    if (score > bestScore) {
      bestScore = score;
      best = finish(sk, "table", t.name, bones);
    }
  }
  if (best && (best.missing.length === 0 || opts.table)) return best;
  const topo = topology(sk);
  if (topo && topo.missing.length < (best?.missing.length ?? REQUIRED_BONES.length)) return topo;
  return best ?? finish(sk, "none", null, {});
}

/** Fill in missing, unmapped, issues and confidence for a mapping. */
function finish(sk: SkeletonIn, method: Recognition["method"], table: string | null, bones: Record<string, string>, extra: string[] = [], base = 1): Recognition {
  const missing = REQUIRED_BONES.filter((b) => !bones[b]);
  const used = new Set(Object.values(bones));
  const unmapped = sk.bones.map((b) => b.name).filter((n) => !used.has(n));
  const issues = [...extra];
  if (missing.length) issues.push(`required bones not found: ${missing.join(", ")}; add them to "bones" by hand`);
  // the hierarchy must agree: each mapped bone descends from its humanoid parent's bone
  const parent = new Map(sk.bones.map((b) => [b.name, b.parent ?? null]));
  const ancestors = (n: string) => {
    const out = new Set<string>();
    for (let p = parent.get(n); p; p = parent.get(p)) out.add(p);
    return out;
  };
  let broken = 0;
  if (sk.bones.some((b) => b.parent !== undefined)) {
    for (const [bone, src] of Object.entries(bones)) {
      let hp = HUMANOID_PARENT[bone];
      while (hp && !bones[hp]) hp = HUMANOID_PARENT[hp];
      if (hp && !ancestors(src).has(bones[hp]!)) {
        broken++;
        issues.push(`${bone} (${src}) does not descend from ${hp} (${bones[hp]})`);
      }
    }
  }
  const confidence = Math.max(0, base * ((REQUIRED_BONES.length - missing.length) / REQUIRED_BONES.length) - 0.1 * broken);
  return { method, table, confidence: Math.round(confidence * 100) / 100, bones, missing, unmapped, issues };
}

/** Apply an agent's corrections ({ humanoid bone: source bone, or null to unmap }) and recompute the rest. */
export function patchMapping(sk: SkeletonIn, rec: Recognition, patch: Record<string, string | null>): Recognition {
  const bones = { ...rec.bones };
  for (const [b, src] of Object.entries(patch)) {
    if (!HUMANOID_BONES.includes(b)) throw new Error(`"${b}" is not a VRM 1.0 humanoid bone`);
    if (src === null) delete bones[b];
    else if (!sk.bones.some((x) => x.name === src)) throw new Error(`the skeleton has no bone "${src}"`);
    else bones[b] = src;
  }
  return { ...finish(sk, rec.method, rec.table, bones, ["patched by hand"]), confidence: 1 };
}

/** The topology and geometry fallback; null when the skeleton has no rest positions or no hips-like branch. */
function topology(sk: SkeletonIn): Recognition | null {
  if (!sk.bones.length || !sk.bones.every((b) => b.head)) return null;
  const up = unit(sk.up ?? [0, 1, 0]);
  const head = new Map(sk.bones.map((b) => [b.name, b.head as V]));
  const kids = new Map<string, string[]>(sk.bones.map((b) => [b.name, []]));
  for (const b of sk.bones) if (b.parent && kids.has(b.parent)) kids.get(b.parent)!.push(b.name);
  const depth = (n: string): number => 1 + Math.max(0, ...kids.get(n)!.map(depth));
  const sub_ = (n: string): string[] => [n, ...kids.get(n)!.flatMap(sub_)];
  const h = (n: string) => dot(head.get(n)!, up);
  const longest = (n: string): string[] => {
    const ks = kids.get(n)!;
    if (!ks.length) return [n];
    return [n, ...ks.map(longest).sort((a, b) => b.length - a.length)[0]!];
  };
  const blen = (a: string, b: string) => len(sub(head.get(b)!, head.get(a)!));
  // hips: the shallowest bone where three chains of at least two bones meet
  const level = (n: string): number => {
    const p = sk.bones.find((b) => b.name === n)!.parent;
    return p ? 1 + level(p) : 0;
  };
  const hipsCand = sk.bones.map((b) => b.name).filter((n) => kids.get(n)!.filter((c) => depth(c) >= 2).length >= 3).sort((a, b) => level(a) - level(b));
  const hips = hipsCand[0];
  if (!hips) return null;
  const branches = kids.get(hips)!.filter((c) => depth(c) >= 2);
  const lowest = (n: string) => Math.min(...sub_(n).map(h));
  const highest = (n: string) => Math.max(...sub_(n).map(h));
  const spineChild = [...branches].sort((a, b) => highest(b) - highest(a))[0]!;
  const legs = branches.filter((c) => c !== spineChild).sort((a, b) => lowest(a) - lowest(b)).slice(0, 2);
  const issues: string[] = [`no table matched; mapped by topology from ${hips}`];
  const bones: Record<string, string> = { hips };
  // the leg chains, a short sideways first bone (CMU's hip joint) skipped
  const legChain = (c: string) => {
    let ch = longest(c);
    if (ch.length >= 3 && blen(ch[0]!, ch[1]!) < 0.4 * blen(ch[1]!, ch[2]!)) ch = ch.slice(1);
    return ch;
  };
  const legChains = legs.map(legChain);
  // forward from heels to toes, right from up and forward; the leg further right is the right leg
  const fwdOf = (ch: string[]) => (ch.length >= 4 ? sub(head.get(ch[3]!)!, head.get(ch[2]!)!) : ([0, 0, 0] as V));
  let fwd = legChains.map(fwdOf).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]] as V, [0, 0, 0] as V);
  fwd = sub(fwd, [up[0] * dot(fwd, up), up[1] * dot(fwd, up), up[2] * dot(fwd, up)]);
  if (len(fwd) < 1e-9) {
    fwd = [0, 0, 1];
    issues.push("no toes to tell forward: assumed +z, glTF's");
  }
  const right = unit(cross(unit(fwd), up));
  const side = (n: string) => dot(head.get(n)!, right);
  if (legChains.length === 2) {
    const [a, b] = side(legChains[0]![0]!) > side(legChains[1]![0]!) ? [legChains[1]!, legChains[0]!] : [legChains[0]!, legChains[1]!];
    for (const [s, ch] of [["left", a], ["right", b]] as const) ["UpperLeg", "LowerLeg", "Foot", "Toes"].forEach((p, i) => ch[i] && (bones[s + p] = ch[i]!));
    const la = blen(a[0]!, a[2] ?? a[1]!);
    const lb = blen(b[0]!, b[2] ?? b[1]!);
    if (Math.abs(la - lb) > 0.1 * Math.max(la, lb)) issues.push("the legs differ in length by more than 10%");
  }
  // the spine climbs to the bone where the arms and the neck branch off
  const spine: string[] = [];
  let n: string | undefined = spineChild;
  while (n) {
    spine.push(n);
    const ks = kids.get(n)!.filter((c) => depth(c) >= 2);
    if (ks.length >= 3) break;
    n = [...kids.get(n)!].sort((a, b) => depth(b) - depth(a))[0];
  }
  const branch = spine[spine.length - 1]!;
  bones.spine = spine[0]!;
  if (spine.length >= 3) {
    bones.chest = spine[1]!;
    bones.upperChest = branch;
  } else if (spine.length === 2) bones.chest = branch;
  const top = kids.get(branch)!.filter((c) => depth(c) >= 1);
  const neckChild = [...top].sort((a, b) => highest(b) - highest(a))[0];
  if (neckChild) {
    const ch = longest(neckChild);
    bones.neck = ch[0]!;
    bones.head = ch[ch.length >= 3 ? ch.length - 2 : ch.length - 1]!;
    if (ch.length === 1) issues.push("one bone above the arms: taken as the head, no neck");
    if (ch.length === 1) delete bones.neck;
  }
  const arms = top.filter((c) => c !== neckChild && depth(c) >= 3).sort((a, b) => side(a) - side(b)).slice(0, 2);
  if (arms.length === 2) {
    for (const [s, c] of [["left", arms[0]!], ["right", arms[1]!]] as const) {
      const ch = longest(c);
      const shoulder = ch.length >= 4 && blen(ch[0]!, ch[1]!) < 0.6 * blen(ch[1]!, ch[2]!);
      const rest = shoulder ? ch.slice(1) : ch;
      if (shoulder) bones[s + "Shoulder"] = ch[0]!;
      ["UpperArm", "LowerArm", "Hand"].forEach((p, i) => rest[i] && (bones[s + p] = rest[i]!));
    }
  } else issues.push("could not find two arms where the spine branches");
  return finish(sk, "topology", null, bones, issues, 0.85);
}

/** The rest frame measured from the bones: forward from heels to toes, right from the left thigh to the right, and how the arms rest. */
export function restFrame(sk: SkeletonIn, rec: Recognition): { forward: V; right: V; up: V; kind: "T" | "A" | "relaxed"; armDrop: number } {
  const head = new Map(sk.bones.map((b) => [b.name, b.head as V]));
  const at = (bone: string) => (rec.bones[bone] ? head.get(rec.bones[bone]!) : undefined);
  const up = unit(sk.up ?? [0, 1, 0]);
  const flat = (v: V): V => sub(v, [up[0] * dot(v, up), up[1] * dot(v, up), up[2] * dot(v, up)]);
  let fwd: V = [0, 0, 0];
  for (const s of ["left", "right"]) {
    const a = at(s + "Foot");
    const t = at(s + "Toes");
    if (a && t) fwd = [fwd[0] + t[0] - a[0], fwd[1] + t[1] - a[1], fwd[2] + t[2] - a[2]];
  }
  const l = at("leftUpperLeg");
  const r = at("rightUpperLeg");
  let right: V = l && r ? unit(flat(sub(r, l))) : [-1, 0, 0];
  if (len(flat(fwd)) < 1e-9) fwd = cross(up, right);
  const forward = unit(flat(fwd));
  right = unit(sub(right, [forward[0] * dot(right, forward), forward[1] * dot(right, forward), forward[2] * dot(right, forward)]));
  let drop = 0;
  let n = 0;
  for (const s of ["left", "right"]) {
    const a = at(s + "UpperArm");
    const b = at(s + "LowerArm");
    if (a && b) {
      const d = unit(sub(b, a));
      drop += (Math.asin(Math.max(-1, Math.min(1, -dot(d, up)))) * 180) / Math.PI;
      n++;
    }
  }
  const armDrop = n ? drop / n : 0;
  return { forward, right, up, kind: armDrop < 20 ? "T" : armDrop < 60 ? "A" : "relaxed", armDrop: Math.round(armDrop * 10) / 10 };
}
