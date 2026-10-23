// The software raster (WP-3.1): the same input gives the same bytes in two runs and in two processes; a 1,000 × 1,000
// image renders within 50 ms; left and right are told apart at a glance (the left side blue, the right amber, mirrored
// as each view sees them); a blank view is caught; the font, the views and the PNG bytes are what they say.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { format, ops } from "@m3a/core";
import { raster, render, turntable, type Image } from "../src/index.ts";
import { png } from "../src/node.ts";
import { testClip, testPose, VIEW_NAMES } from "./raster-pose.ts";

const X = testPose();
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
/** Pixels whose colour is the left side's blue, or the body's amber, shaded: by hue. */
const blue = (d: Uint8ClampedArray, i: number) => d[i + 2]! > d[i]! + 40 && d[i + 2]! > d[i + 1]!;
const amber = (d: Uint8ClampedArray, i: number) => d[i]! > d[i + 2]! + 60 && d[i + 1]! > d[i + 2]! + 20;
/** The mean x (0 to 1 across the image) of the pixels a test picks. */
function meanX(img: Image, test: (d: Uint8ClampedArray, i: number) => boolean): number {
  let sx = 0, n = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (test(img.data, (y * img.width + x) * 4)) [sx, n] = [sx + x, n + 1];
  return n ? sx / n / img.width : NaN;
}

describe("deterministic pixels", () => {
  it("gives the same bytes in two runs and in a second process, for every view and a turntable", () => {
    const run = () => [...VIEW_NAMES.map((v) => render(X, { view: v, width: 320, height: 320, label: v })), turntable(X, { n: 6, size: 120 })].map((img) => sha(png(img)));
    const first = run();
    expect(run()).toEqual(first);
    const other = execFileSync(process.execPath, [join(import.meta.dirname, "raster-bytes.ts")], { encoding: "utf8" }).trim().split("\n");
    expect(other).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });
  it("renders a 1,000 × 1,000 image within 50 ms", () => {
    render(X, { view: "three-quarter", width: 1000, height: 1000 });
    const ms: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      render(X, { view: "three-quarter", width: 1000, height: 1000, label: "timed" });
      ms.push(performance.now() - t0);
    }
    ms.sort((a, b) => a - b);
    console.log(`raster: 1,000 × 1,000 in ${ms[3]!.toFixed(1)} ms (median of 7; fastest ${ms[0]!.toFixed(1)})`);
    expect(ms[3]).toBeLessThanOrEqual(50);
  });
});

describe("left and right at a glance", () => {
  it("draws the left side blue and the right amber, where each view sees them", () => {
    // facing the camera the body's left is on the image's right; from behind, on its left; from above (forward up), left
    const front = render(X, { view: "front", floor: false }), back = render(X, { view: "back", floor: false }), top = render(X, { view: "top", floor: false });
    for (const img of [front, back, top]) expect(raster.coverage(img)).toBeGreaterThan(0.02);
    expect(meanX(front, blue)).toBeGreaterThan(0.5);
    expect(meanX(back, blue)).toBeLessThan(0.5);
    expect(meanX(top, blue)).toBeLessThan(0.5);
    // the fist that jabs at the camera is the left's, blue; in the mirrored pose it is the right's, amber
    const { clip, R } = testClip(), mirrored = format.decodePose(R, ops.mirrorPose(format.keyAt(clip, 0.25)), new Float32Array(108));
    const fistColour = (P: ArrayLike<number>, side: "L" | "R") => {
      const cam = raster.fit("front", 400, 400, [raster.capsules(P).flatMap((c) => [...c.a, ...c.b])]), img = render(P, { camera: cam, floor: false });
      const [x, y] = raster.project(cam, [P[format.IDX["fist" + side]! * 3]!, P[format.IDX["fist" + side]! * 3 + 1]!, P[format.IDX["fist" + side]! * 3 + 2]!]);
      return { img, i: (Math.round(y) * 400 + Math.round(x)) * 4 };
    };
    const a = fistColour(X, "L"), b = fistColour(mirrored, "R");
    expect(blue(a.img.data, a.i)).toBe(true);
    expect(amber(b.img.data, b.i)).toBe(true);
  });
  it("shows the nose on the side the face looks", () => {
    const side = render(X, { view: "side", floor: false }), nose = (d: Uint8ClampedArray, i: number) => d[i]! > 100 && d[i + 1]! < 70 && d[i + 2]! < 60;
    const head = raster.project(raster.fit("side", 400, 400, [raster.capsules(X).flatMap((c) => [...c.a, ...c.b])]), [X[format.IDX.head! * 3]!, X[format.IDX.head! * 3 + 1]!, X[format.IDX.head! * 3 + 2]!]);
    // from the right side the body faces the image's right: the nose sits right of the head's centre
    expect(meanX(side, nose) * 400).toBeGreaterThan(head[0]);
  });
});

describe("views, font, blank check and PNG", () => {
  it("puts forward up in the top view and to the right in the side view, and up up", () => {
    const at = (v: "top" | "side" | "front", p: number[]) => raster.project(raster.camera(v, 100, 100, 0.01), p);
    expect(at("top", [1000, 0, 0])[1]).toBeLessThan(50);
    expect(at("top", [0, 1000, 0])[0]).toBeGreaterThan(50);
    expect(at("side", [1000, 0, 0])[0]).toBeGreaterThan(50);
    expect(at("front", [0, 1000, 0])[0]).toBeLessThan(50);
    expect(at("front", [0, 0, 1000])[1]).toBeLessThan(50);
    expect(at("front", [1000, 0, 0])[2]).toBeGreaterThan(0);
  });
  it("draws glyphs as written, lower case as capitals, an unknown character as a box", () => {
    const img = raster.image(40, 9, [255, 255, 255]);
    raster.text(img, 1, 1, "1a€", [0, 0, 0]);
    const ink = (x: number, y: number) => img.data[((y + 1) * 40 + x + 1) * 4] === 0;
    const rows = (x0: number) => Array.from({ length: 7 }, (_, y) => Array.from({ length: 5 }, (_, x) => (ink(x0 + x, y) ? "#" : ".")).join("")).join(" ");
    expect(rows(0)).toBe("..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.");
    expect(rows(6)).toBe(".###. #...# #...# ##### #...# #...# #...#");
    expect(rows(12)).toBe("##### #...# #...# #...# #...# #...# #####");
    expect(raster.textWidth("abc", 2)).toBe(34);
  });
  it("catches a blank view: a pose of NaN draws nothing", () => {
    const nan = render(new Float32Array(108).fill(Number.NaN), { floor: false });
    expect(raster.coverage(nan)).toBe(0);
    expect(() => raster.assertNotBlank(nan, "the NaN pose")).toThrow(/the NaN pose is blank/);
    expect(() => raster.assertNotBlank(render(X))).not.toThrow();
  });
  it("writes a valid PNG: signature, size, chunk CRCs, and rows that inflate back to the pixels", () => {
    const img = render(X, { width: 64, height: 48 }), b = png(img), v = new DataView(b.buffer, b.byteOffset);
    expect([...b.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect([v.getUint32(16), v.getUint32(20)]).toEqual([64, 48]);
    let at = 8, idat: Uint8Array = new Uint8Array(0);
    while (at < b.length) {
      const len = v.getUint32(at), type = String.fromCharCode(...b.subarray(at + 4, at + 8));
      expect(v.getUint32(at + 8 + len), type).toBe(raster.crc32(b.subarray(at + 4, at + 8 + len)));
      if (type === "IDAT") idat = b.subarray(at + 8, at + 8 + len);
      at += 12 + len;
    }
    const raw = inflateSync(idat);
    for (let y = 0; y < 48; y++) {
      expect(raw[y * 257]).toBe(0);
      expect(Buffer.from(raw.subarray(y * 257 + 1, (y + 1) * 257)).equals(Buffer.from(img.data.subarray(y * 256, (y + 1) * 256)))).toBe(true);
    }
  });
});

describe("a root places a pose, not turns it (WP-F.14)", () => {
  it("moves every capsule by the root's place, whatever its heading: the pose carries its own (a clip's turn drawn once)", () => {
    const at = raster.capsules(X), placed = raster.capsules(X, { forward: 300, right: -120, yaw: 135 });
    expect(placed.map((c) => [c.name, ...c.a, ...c.b])).toEqual(at.map((c) => [c.name, c.a[0] + 300, c.a[1] - 120, c.a[2], c.b[0] + 300, c.b[1] - 120, c.b[2]]));
  });
});
