// The still rule (F.13, D135), which the library's QA and the intake's lint gate both read: how far a clip moves is the
// farthest any body point gets from where it starts, read every 1/30 s and at its end (or until it gets as far as
// asked); a procedural idle's sway moves it well past STILL.mm, the same idle frozen (every key its first pose, as a
// fixed fit froze 100STYLE's idles, D133) or with one key nudged a degree off reads as it is, and a clip shorter than
// 1/30 s is read at its end; and only the tags STILL names say a clip is a held pose.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { procedural, type Clip, type Rest } from "@m3a/core";
import { checks } from "../src/index.ts";

const ROOT = join(import.meta.dirname, "../../..");
const rest = (JSON.parse(readFileSync(join(ROOT, "library/sets/QUATERNIUS_3D2DGE/_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources.UAL1!.rest;
const idle = procedural.idleClip(procedural.IDLES[0]!, rest, { restSrc: "UAL1", id: "TEST/Breathe" });
/** `c` with every key its first pose, at its own time. */
const frozen = (c: Clip): Clip => ({ ...c, keys: c.keys.map((k) => ({ ...c.keys[0]!, t: k.t })) });

describe("the still rule", () => {
  it("is 3 mm, and the tags that say a clip is a held pose: pose and reference", () => {
    expect(checks.STILL).toEqual({ mm: 3, tags: ["pose", "reference"] });
  });
  it("reads how far a clip moves: an idle's sway past the rule, the same idle frozen 0, one key turned a degree past it", () => {
    expect(checks.reachOf(idle, rest)).toBeGreaterThan(10 * checks.STILL.mm);
    expect(checks.reachOf(frozen(idle), rest)).toBe(0);
    // (the idle's sway reaches 35 mm) one key in the middle turned a degree about the body: 5.8 mm, past the rule
    const mid = Math.floor(idle.keys.length / 2), nudged: Clip = { ...frozen(idle), keys: frozen(idle).keys.map((k, i) => (i === mid ? { ...k, body: [k.body[0]! + 1, k.body[1]!, k.body[2]!] } : k)) };
    expect(checks.reachOf(nudged, rest)).toBeGreaterThan(checks.STILL.mm);
    // read only until it gets as far as asked: past it for a clip that moves, the whole of it for one that doesn't
    expect([checks.reachOf(idle, rest, checks.STILL.mm) >= checks.STILL.mm, checks.reachOf(idle, rest, checks.STILL.mm) < checks.reachOf(idle, rest), checks.reachOf(frozen(idle), rest, checks.STILL.mm), checks.reachOf(nudged, rest, 100)]).toEqual([true, true, 0, checks.reachOf(nudged, rest)]);
  });
  it("reads a clip's end where the 1/30 s steps don't land on it: a 0.02 s turn moves", () => {
    const k0 = idle.keys[0]!, turned = { ...k0, t: 0.02, body: [k0.body[0]! + 30, k0.body[1]!, k0.body[2]!] };
    const blink: Clip = { ...idle, loop: false, dur: 0.02, keys: [k0, turned] };
    expect(checks.reachOf(blink, rest)).toBeGreaterThan(10 * checks.STILL.mm);
    expect(checks.reachOf({ ...blink, keys: [k0, { ...k0, t: 0.02 }] }, rest)).toBe(0);
  });
  it("reads a clip as a held pose only when one of its tags says so", () => {
    expect([checks.isPose(["pose"]), checks.isPose(["aim", "reference"]), checks.isPose(["idle", "loop"]), checks.isPose([]), checks.isPose(["posed", "Pose"])]).toEqual([true, true, false, false, false]);
  });
});
