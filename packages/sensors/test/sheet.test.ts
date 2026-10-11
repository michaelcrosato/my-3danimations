// Sheets, films and diffs (WP-3.2): a sheet of a 2 s clip fits in one 1,000 × 1,000 image within its token budget (a
// long one shrinks to stay within it); a diff of identical inputs is empty; a planted change is marked where it is,
// in the cells either side of the edited key and over the edited arm; flags, contact markers and filmstrips draw as
// stated; the same input gives the same pixels.
import { describe, expect, it } from "vitest";
import { format, type Key } from "@m3a/core";
import { raster, sheets } from "../src/index.ts";
import { testClip } from "./raster-pose.ts";

const { clip: walk, R } = testClip("Walk_Loop");
const red = (img: raster.Image, x: number, y: number) => {
  const i = (y * img.width + x) * 4;
  return img.data[i]! > 180 && img.data[i + 1]! < 80 && img.data[i + 2]! < 80;
};

describe("sheets", () => {
  it("fits a 2 s clip's sheet in one 1,000 × 1,000 image, within its token budget; a long one shrinks to stay within it", () => {
    for (const name of ["Interact", "Crouch_Fwd_Loop", "NinjaJump_Idle_Loop"]) {
      const { clip } = testClip(name);
      expect(clip.dur).toBe(2);
      const s = sheets.sheet(clip, R);
      expect(s.width, name).toBeLessThanOrEqual(1000);
      expect(s.height, name).toBeLessThanOrEqual(1000);
      expect(s.tokens, name).toBeLessThanOrEqual(1400);
      expect(raster.coverage(s.image)).toBeGreaterThan(0.05);
    }
    expect(sheets.tokens({ width: 1000, height: 1000 })).toBe(1334);
    const dense = sheets.sheet(testClip("Interact").clip, R, { every: 0.05, budget: 1000 });
    expect(dense.times).toHaveLength(41);
    expect(dense.tokens).toBeLessThanOrEqual(1000);
    expect(dense.cells.every((c) => c.w >= 24)).toBe(true);
  });
  it("draws a loop's cycle without its repeated end, a one-shot from start to end, and a filmstrip in one row", () => {
    expect(sheets.sheetTimes(walk, { frames: 4 })).toEqual([0, walk.dur / 4, walk.dur / 2, (3 * walk.dur) / 4]);
    const { clip: punch } = testClip("Punch_Jab");
    expect(sheets.sheetTimes(punch, { frames: 3 })).toEqual([0, punch.dur / 2, punch.dur]);
    const strip = sheets.filmstrip(walk, R, { frames: 6 });
    expect(new Set(strip.cells.map((c) => c.y)).size).toBe(1);
    expect(strip.cells).toHaveLength(6);
  });
  it("frames flagged times in red, and only those", () => {
    const s = sheets.sheet(walk, R, { flags: [{ t0: 0.4, t1: 0.6 }] });
    for (const c of s.cells) expect(red(s.image, c.x + 1, c.y + Math.round(c.h / 2)), `cell at ${c.t}`).toBe(c.t >= 0.4 && c.t <= 0.6);
  });
  it("marks a planted foot on the floor under its sole, in its side's colour", () => {
    const contacts = { by: "labelled" as const, footL: [[0, walk.dur] as [number, number]] };
    const marked = sheets.sheet({ ...walk, contacts }, R, { trails: false, frames: 2 }), bare = sheets.sheet(walk, R, { trails: false, frames: 2, contacts: false });
    const d = sheets.diff(marked.image, bare.image);
    expect(d.changed).toBeGreaterThan(20);
    // the marks are in the frames' lower part, where the feet are, and in the left's dark blue
    expect(d.box!.y).toBeGreaterThan(marked.cells[0]!.y + marked.cells[0]!.h * 0.6);
  });
  it("gives the same pixels for the same input", () => {
    expect(Buffer.from(sheets.sheet(walk, R).image.data).equals(Buffer.from(sheets.sheet(walk, R).image.data))).toBe(true);
  });
});

describe("blank frames", () => {
  it("throws for a sheet whose frames draw no body, naming them, though the floor and labels drew", () => {
    const broken = { ...walk, id: "broken", keys: walk.keys.map((k) => ({ ...k, hips: [Number.NaN, Number.NaN, Number.NaN] })) as Key[] };
    expect(() => sheets.sheet(broken, R)).toThrow(/^sheet broken: no body drawn in \d+ of \d+ frames \(at 0\.00, /);
    expect(sheets.sheet(walk, R).cells.length).toBeGreaterThan(0);
  });
});

describe("diffs", () => {
  it("finds nothing between identical inputs", () => {
    const copy = JSON.parse(JSON.stringify(walk)) as typeof walk;
    const d = sheets.compareClips(walk, copy, R);
    expect(d.changed).toBe(0);
    expect(d.box).toBeNull();
    expect(d.image.height).toBe(3 * d.a.height + 8);
  });
  it("marks a planted change where it is: the cells either side of the edited key, over the edited arm", () => {
    const k = 5, edited = { ...walk, id: "edited", keys: walk.keys.map((key, i) => (i === k ? { ...key, armR: [key.armR[0]! + 40, key.armR[1]!, key.armR[2]! + 50, key.armR[3]!, key.armR[4] ?? 0] } : key)) as Key[] };
    const d = sheets.compareClips(walk, edited, R, { marked: true });
    const tk = walk.keys[k]!.t, before = walk.keys[k - 1]!.t, after = walk.keys[k + 1]!.t;
    const hit = d.a.cells.filter((c) => d.box && c.x < d.box.x + d.box.w && c.x + c.w > d.box.x && c.y < d.box.y + d.box.h && c.y + c.h > d.box.y);
    expect(hit.length).toBeGreaterThan(0);
    // only frames the edited key reaches (between its neighbours) changed
    for (const c of hit) expect(c.t > before && c.t < after, `cell at ${c.t} (key at ${tk})`).toBe(true);
    for (const c of d.a.cells.filter((c) => c.t > before && c.t < after)) expect(hit).toContain(c);
    // and the box holds the edited right elbow and fist, as the edited sheet draws them, in each changed cell
    for (const c of hit) {
      const X = format.pose(R, edited, c.t);
      for (const n of ["elbowR", "fistR"]) {
        const [x, y] = raster.project(d.b.camera, [X[format.IDX[n]! * 3]!, X[format.IDX[n]! * 3 + 1]!, X[format.IDX[n]! * 3 + 2]!]);
        expect(c.x + x, `${n} at ${c.t}`).toBeGreaterThanOrEqual(d.box!.x - 4);
        expect(c.x + x).toBeLessThanOrEqual(d.box!.x + d.box!.w + 4);
        expect(c.y + y).toBeGreaterThanOrEqual(d.box!.y - 4);
        expect(c.y + y).toBeLessThanOrEqual(d.box!.y + d.box!.h + 4);
      }
    }
  });
  it("stays within its token budget, the three rows sharing it", () => {
    const { clip: interact } = testClip("Interact");
    for (const opts of [{}, { budget: 1000, frames: 24 }, { budget: 600, marked: true }]) {
      const d = sheets.compareClips(interact, walk, R, opts);
      expect(d.tokens, JSON.stringify(opts)).toBeLessThanOrEqual((opts as { budget?: number }).budget ?? 1400);
      expect(d.image.width).toBeLessThanOrEqual(1000);
    }
  });
  it("refuses two images of different sizes, saying how to draw them alike", () => {
    expect(() => sheets.diff(raster.image(4, 4), raster.image(5, 4))).toThrow(/one camera/);
  });
});
