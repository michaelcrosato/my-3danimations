// Orthographic views of the format's frame (PLAN.md WP-3.1): front, side, back, top, three-quarter, or any azimuth and
// elevation (a turntable). Points are forward, right, up in mm. A view's camera sits at azimuth `yaw` (0 in front of the
// body, 90 at its right side) and elevation `pitch` (degrees above), so the front view shows the body's right on the
// image's left, as a mirror never does. The trigonometry is core's portable math, so every engine draws the same pixels.
import { math } from "@m3a/core";

const { PORTABLE } = math;

/** A view: the camera's azimuth (0 front, 90 the body's right side) and elevation (90 straight down), in degrees. */
export interface View {
  yaw: number;
  pitch: number;
}
/** The named views. */
export const VIEWS = {
  front: { yaw: 0, pitch: 0 },
  side: { yaw: 90, pitch: 0 },
  back: { yaw: 180, pitch: 0 },
  top: { yaw: 180, pitch: 90 },
  "three-quarter": { yaw: 45, pitch: 20 },
} as const satisfies Record<string, View>;
/** A named view. */
export type ViewName = keyof typeof VIEWS;

/** A camera: a view, the image's size, pixels per mm, and the screen-plane point (mm) at the image's centre. */
export interface Camera {
  view: View;
  width: number;
  height: number;
  scale: number;
  center: readonly [number, number];
  /** The view's axes, precomputed: cos and sin of yaw and pitch. */
  cy: number;
  sy: number;
  cp: number;
  sp: number;
}

const DEG = Math.PI / 180;
/** The view by name or as given. */
export const viewOf = (v: ViewName | View = "front"): View => (typeof v === "string" ? VIEWS[v] : v);

/** A camera for a view, an image size, a scale (pixels per mm) and the screen-plane point at the image's centre. */
export function camera(view: ViewName | View, width: number, height: number, scale: number, center: readonly [number, number] = [0, 0]): Camera {
  const v = viewOf(view);
  return { view: v, width, height, scale, center, cy: PORTABLE.cos(v.yaw * DEG), sy: PORTABLE.sin(v.yaw * DEG), cp: PORTABLE.cos(v.pitch * DEG), sp: PORTABLE.sin(v.pitch * DEG) };
}

/** A point (forward, right, up mm) on the view's screen plane: across (to the image's right) and up, in mm, and depth
 *  toward the camera. */
export function plane(cam: Camera, p: ArrayLike<number>): [number, number, number] {
  const f = p[0]!, r = p[1]!, z = p[2]!, h = cam.cy * f + cam.sy * r;
  return [cam.sy * f - cam.cy * r, z * cam.cp - h * cam.sp, h * cam.cp + z * cam.sp];
}

/** A point in image pixels (x right, y down) and its depth toward the camera in pixels. */
export function project(cam: Camera, p: ArrayLike<number>): [number, number, number] {
  const [x, u, d] = plane(cam, p);
  return [cam.width / 2 + (x - cam.center[0]) * cam.scale, cam.height / 2 - (u - cam.center[1]) * cam.scale, d * cam.scale];
}

/**
 * The camera that frames every point of every pose given (with `pad` mm round them, and `margin` of the image kept
 * clear on each side): one scale and centre, so frames drawn with it compare at a glance.
 */
export function fit(view: ViewName | View, width: number, height: number, poses: readonly ArrayLike<number>[], opts: { pad?: number; margin?: number; top?: number } = {}): Camera {
  const probe = camera(view, 1, 1, 1);
  let x0 = Infinity, x1 = -Infinity, u0 = Infinity, u1 = -Infinity;
  for (const X of poses) {
    for (let i = 0; i + 2 < X.length; i += 3) {
      if (!Number.isFinite(X[i]!) || !Number.isFinite(X[i + 1]!) || !Number.isFinite(X[i + 2]!)) continue;
      const [x, u] = plane(probe, [X[i]!, X[i + 1]!, X[i + 2]!]);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
    }
  }
  if (!(x1 >= x0)) return camera(view, width, height, 0.2);
  const pad = opts.pad ?? 150, m = opts.margin ?? 0.04, top = opts.top ?? 0;
  x0 -= pad;
  x1 += pad;
  u0 -= pad;
  u1 += pad;
  const scale = Math.min((width * (1 - 2 * m)) / (x1 - x0), ((height - top) * (1 - 2 * m)) / (u1 - u0));
  // the image's centre sits `top` pixels' worth of mm above the framed box's, leaving room for a label
  return camera(view, width, height, scale, [(x0 + x1) / 2, (u0 + u1) / 2 + top / 2 / scale]);
}
