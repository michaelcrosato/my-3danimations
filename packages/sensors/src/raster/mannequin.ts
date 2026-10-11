// The capsule mannequin (PLAN.md WP-3.1; carried from my-3d2dge's Mocap.Mannequin, src/mocap/mocap.js:57-160): every
// part a capsule between two body points, in the source model's proportions, shaded as a lit tube and z-buffered per
// pixel, so an arm through the torso shows as one. A nose shows which way the head faces, and the body's left side is
// tinted blue (its right and middle amber), so left and right read at a glance in every view. Whole pixels, no
// smoothing, plain arithmetic: the same pose gives the same bytes in every run and every engine.
import { format, math } from "@m3a/core";
import { image, line, pixel, type Image, type Rgb } from "./image.ts";
import { fit, project, type Camera, type View, type ViewName } from "./view.ts";
import { text, GLYPH } from "./font.ts";

const { IDX } = format;
const { PORTABLE } = math;

/** The mannequin's colours: the middle and right side, the left side, the nose, the floor's grid. */
export const COLORS = { body: [232, 170, 58], left: [74, 140, 214], nose: [160, 52, 40], floor: [214, 212, 205], axis: [190, 186, 176] } as const satisfies Record<string, Rgb>;

/** Where the root stands: forward and right (mm) and heading (degrees). Points are drawn in the world it puts them in. */
export interface Root {
  forward: number;
  right: number;
  yaw: number;
}

type V = [number, number, number];
const at = (X: ArrayLike<number>, n: string): V => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a: V): V => {
  const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** One capsule: its part's name (`thighL`, `chest`, ...), two ends (mm), their radii (mm) and a colour. */
export interface Capsule {
  name: string;
  a: V;
  b: V;
  ra: number;
  rb: number;
  color: Rgb;
}

/**
 * The mannequin's capsules for a pose (36 body points, forward, right, up mm), in the world `root` puts them in. Radii
 * scale with the body (my-3d2dge's were set on a 1.83 m model).
 */
export function capsules(X: ArrayLike<number>, root?: Root): Capsule[] {
  const P = (n: string) => at(X, n);
  const thigh = (Math.hypot(...sub(P("hipL"), P("kneeL"))) + Math.hypot(...sub(P("hipR"), P("kneeR")))) / 2;
  const k = Number.isFinite(thigh) && thigh > 1 ? thigh / 430 : 1;
  const out: Capsule[] = [];
  const part = (name: string, a: V, b: V, ra: number, rb: number, color: Rgb) => out.push({ name, a, b, ra: ra * k, rb: rb * k, color });
  const { body, left, nose } = COLORS;
  for (const s of ["L", "R"]) {
    const c = s === "L" ? left : body, hip = P("hip" + s), knee = P("knee" + s), ank = P("ankle" + s), ball = P("ball" + s), toe = P("toe" + s);
    const heel = add(lerp(ank, ball, -0.28), [0, 0, -1], 45 * k);
    part("thigh" + s, hip, knee, 80, 60, c);
    part("shin" + s, knee, ank, 56, 40, c);
    part("foot" + s, heel, ball, 44, 40, c);
    part("toes" + s, ball, toe, 38, 28, c);
  }
  const pelvis = P("pelvis"), sp1 = P("spine1"), sp2 = P("spine2"), chest = P("chest"), neck = P("neck"), head = P("head"), top = P("headTop");
  const fwdC = unit(sub(P("chestF"), chest)), fwdH = unit(sub(P("faceF"), head)), up = unit(sub(neck, sp2));
  part("hips", P("hipL"), P("hipR"), 92, 92, body);
  part("pelvis", pelvis, sp1, 118, 112, body);
  part("belly", sp1, sp2, 104, 112, body);
  part("chest", sp2, add(chest, up, 40 * k), 122, 132, body);
  part("pecs", add(add(lerp(chest, P("shL"), 0.38), fwdC, 22 * k), up, -30 * k), add(add(lerp(chest, P("shR"), 0.38), fwdC, 22 * k), up, -30 * k), 112, 112, body);
  part("neck", add(neck, up, -20 * k), lerp(head, top, 0.25), 48, 46, body);
  const jaw = add(lerp(head, top, 0.3), fwdH, 26 * k), crown = lerp(head, top, 0.64);
  part("head", jaw, crown, 70, 96, body);
  // the nose: out from the face along the head's forward, so facing reads in every view
  const face = add(lerp(head, top, 0.42), fwdH, 70 * k);
  part("nose", face, add(face, fwdH, 55 * k), 22, 14, nose);
  for (const s of ["L", "R"]) {
    const c = s === "L" ? left : body, cl = P("clav" + s), sh = P("sh" + s), el = P("elbow" + s), wr = P("wrist" + s), kn = P("knuck" + s), fist = P("fist" + s);
    part("shoulder" + s, lerp(cl, sh, 0.45), sh, 62, 68, c);
    part("upperArm" + s, sh, el, 62, 46, c);
    part("forearm" + s, el, wr, 46, 34, c);
    part("hand" + s, wr, lerp(kn, fist, 0.5), 36, 38, c);
  }
  return root ? out.map((c) => ({ ...c, a: toWorld(c.a, root), b: toWorld(c.b, root) })) : out;
}
/** A pose-frame point in the world the root puts it in. */
function toWorld(p: V, root?: Root): V {
  if (!root) return p;
  const cs = PORTABLE.cos((root.yaw * Math.PI) / 180), sn = PORTABLE.sin((root.yaw * Math.PI) / 180);
  return [root.forward + p[0] * cs - p[1] * sn, root.right + p[0] * sn + p[1] * cs, p[2]];
}

/** The light, from the upper left and in front: the unit vector a lit tube's normal is shaded against. */
const LIGHT: V = unit([-0.45, -0.6, 0.66]);

/**
 * Draws capsules into an image through a camera, nearest in front per pixel: each a tube lit from the upper left,
 * with a dark rim. Parts with a NaN end are skipped (the non-blank check catches a pose of NaN).
 */
export function drawCapsules(img: Image, cam: Camera, parts: readonly Capsule[]): void {
  const shapes = parts.map((c) => ({ A: project(cam, c.a), B: project(cam, c.b), ra: c.ra * cam.scale, rb: c.rb * cam.scale, color: c.color })).filter((s) => [...s.A, ...s.B].every(Number.isFinite));
  if (!shapes.length) return;
  // one depth buffer over the parts' box only
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const s of shapes) {
    const r = Math.max(s.ra, s.rb);
    bx0 = Math.min(bx0, s.A[0] - r, s.B[0] - r);
    bx1 = Math.max(bx1, s.A[0] + r, s.B[0] + r);
    by0 = Math.min(by0, s.A[1] - r, s.B[1] - r);
    by1 = Math.max(by1, s.A[1] + r, s.B[1] + r);
  }
  const X0 = Math.max(0, Math.floor(bx0)), Y0 = Math.max(0, Math.floor(by0)), X1 = Math.min(img.width, Math.ceil(bx1) + 1), Y1 = Math.min(img.height, Math.ceil(by1) + 1);
  if (X1 <= X0 || Y1 <= Y0) return;
  const W = X1 - X0, depth = new Float32Array(W * (Y1 - Y0)).fill(-Infinity), d = img.data;
  for (const s of shapes) {
    const { A, B, ra, rb, color } = s, vx = B[0] - A[0], vy = B[1] - A[1], vz = B[2] - A[2], L2 = vx * vx + vy * vy, r = Math.max(ra, rb);
    const x0 = Math.max(X0, Math.floor(Math.min(A[0], B[0]) - r)), x1 = Math.min(X1, Math.ceil(Math.max(A[0], B[0]) + r) + 1);
    const y0 = Math.max(Y0, Math.floor(Math.min(A[1], B[1]) - r)), y1 = Math.min(Y1, Math.ceil(Math.max(A[1], B[1]) + r) + 1);
    for (let y = y0; y < y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x < x1; x++) {
        const px = x + 0.5;
        const t = L2 > 1e-9 ? Math.min(1, Math.max(0, ((px - A[0]) * vx + (py - A[1]) * vy) / L2)) : 0;
        const cx = A[0] + vx * t, cy = A[1] + vy * t, rr = ra + (rb - ra) * t, dx = px - cx, dy = py - cy, q = dx * dx + dy * dy;
        if (q > rr * rr || rr <= 0) continue;
        const nz = Math.sqrt(1 - q / (rr * rr)), z = A[2] + vz * t + nz * rr, j = (y - Y0) * W + (x - X0);
        if (z <= depth[j]!) continue;
        depth[j] = z;
        // a lit tube: the normal's screen part from the axis, its depth part nz; a rim a pixel and a quarter wide
        const lit = Math.max(0, (dx / rr) * LIGHT[0] + (dy / rr) * LIGHT[1] + nz * LIGHT[2]), rim = rr - Math.sqrt(q) < 1.25;
        const k = rim ? 0.45 : 0.5 + 0.55 * lit, i = (y * img.width + x) * 4;
        d[i] = color[0] * k;
        d[i + 1] = color[1] * k;
        d[i + 2] = color[2] * k;
        d[i + 3] = 255;
      }
    }
  }
}

/** The floor (z = 0) as a grid every 500 mm round `around` (forward, right mm), with the axes through the origin darker. */
export function drawFloor(img: Image, cam: Camera, around: readonly [number, number] = [0, 0], reach = 2000): void {
  const c0 = Math.round(around[0] / 500) * 500, c1 = Math.round(around[1] / 500) * 500;
  for (let g = -reach; g <= reach; g += 500) {
    for (const [a, b] of [[[c0 + g, c1 - reach, 0], [c0 + g, c1 + reach, 0]], [[c0 - reach, c1 + g, 0], [c0 + reach, c1 + g, 0]]] as V[][]) {
      const A = project(cam, a!), B = project(cam, b!), axis = (a![0] === b![0] && a![0] === 0) || (a![1] === b![1] && a![1] === 0);
      line(img, A[0], A[1], B[0], B[1], axis ? COLORS.axis : COLORS.floor);
    }
  }
}

/** How to render one pose. */
export interface RenderOptions {
  /** A named view or a camera azimuth and elevation (front). */
  view?: ViewName | View;
  /** Image size in pixels (400 × 400). */
  width?: number;
  height?: number;
  /** A camera to draw with (one scale for many frames, from `fit`); otherwise one that frames this pose. */
  camera?: Camera;
  /** Where the root stands (the points are drawn in the world it puts them in). */
  root?: Root;
  /** A label at the top left. */
  label?: string;
  /** Draw the floor's grid (true). */
  floor?: boolean;
}

/** A pose (36 body points, forward, right, up mm) drawn as the mannequin in one view. */
export function render(points: ArrayLike<number>, opts: RenderOptions = {}): Image {
  const w = opts.width ?? 400, h = opts.height ?? 400, img = image(w, h);
  const parts = capsules(points, opts.root);
  const cam = opts.camera ?? fit(opts.view ?? "front", w, h, [parts.flatMap((c) => [...c.a, ...c.b])], { top: opts.label ? (GLYPH.height + 4) * labelScale(w) : 0 });
  if (opts.floor !== false) {
    const pel = toWorld(at(points, "pelvis"), opts.root);
    drawFloor(img, cam, [pel[0], pel[1]]);
  }
  drawCapsules(img, cam, parts);
  if (opts.label) text(img, 4, 4, opts.label, [60, 60, 60], labelScale(w));
  return img;
}
/** The label's font scale for an image width: 1 up to 400 pixels, then one more every 400. */
export const labelScale = (width: number): number => Math.max(1, Math.floor(width / 400));

/** A turntable: the pose from `n` azimuths (0, 360/n, ...) at elevation `pitch`, side by side at one scale. */
export function turntable(points: ArrayLike<number>, opts: { n?: number; size?: number; pitch?: number; root?: Root; label?: string } = {}): Image {
  const n = opts.n ?? 8, size = opts.size ?? 200, pitch = opts.pitch ?? 10, parts = capsules(points, opts.root), pel = toWorld(at(points, "pelvis"), opts.root);
  const flat = [parts.flatMap((c) => [...c.a, ...c.b])];
  // one scale for every azimuth: the tightest of their fits
  const views = Array.from({ length: n }, (_, i) => ({ yaw: (360 * i) / n, pitch }));
  const scale = Math.min(...views.map((v) => fit(v, size, size, flat, { top: (GLYPH.height + 4) * labelScale(size) }).scale));
  const out = image(size * n, size);
  views.forEach((v, i) => {
    const f = fit(v, size, size, flat, { top: (GLYPH.height + 4) * labelScale(size) }), cam = { ...f, scale, center: [f.center[0], f.center[1]] as const };
    const frame = image(size, size);
    drawFloor(frame, cam, [pel[0], pel[1]]);
    drawCapsules(frame, cam, parts);
    text(frame, 4, 4, `${i === 0 && opts.label ? opts.label + " " : ""}${Math.round(v.yaw)}°`, [60, 60, 60], labelScale(size));
    for (let y = 0; y < size; y++) out.data.set(frame.data.subarray(y * size * 4, (y + 1) * size * 4), (y * size * n + i * size) * 4);
    if (i > 0) for (let y = 0; y < size; y++) pixel(out, i * size, y, COLORS.floor);
  });
  return out;
}
