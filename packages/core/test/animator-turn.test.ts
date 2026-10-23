// The Animator's pose faces as its clips do at their playheads; `pose().turn` is how far the root has turned beyond that
// (WP-F.14): 0 while one clip plays from its start, a loop's earlier cycles' turn, an earlier clip's, a `place`'s, as of
// the last step or place. A host turns the pose by it (@m3a/three's attach does), so the character faces where the root
// heads, its clip's turn once; a scrub (a clip's time set, no step) sees the clip's pose as written.
import { describe, expect, it } from "vitest";
import { Animator, AnimatorError, bind, type AnimClip, type Key } from "../src/index.ts";
import { scriptData } from "./animator-data.ts";

const data = scriptData(), [walk] = data.clips as [AnimClip], rig = bind(data.skeleton);
const k0 = walk.keys[0]! as Key & { body: number[] };
/** A clip that turns `deg` to its right over a second in place, its body with it (its keys' `yaw` and `body` heading). */
const turning = (deg: number, loop = false): AnimClip => ({
  id: `TEST/Turn_${deg}`,
  dur: 1,
  loop,
  keys: [0, 1].map((t) => ({ ...k0, t, root: [0, 0], yaw: deg * t, body: [k0.body[0]! + deg * t, k0.body[1]!, k0.body[2]!] })) as unknown as Key[],
});
const near = (a: number, b: number, tol = 1e-6) => Math.abs(((((a - b + 180) % 360) + 360) % 360) - 180) < tol;

describe("the Animator's pose turn", () => {
  it("is 0 while one clip plays from its start, its own turn in the pose", () => {
    const a = new Animator(rig).layer("base", { clip: turning(90) });
    expect(a.pose().turn).toBe(0);
    a.step(0.5);
    expect(near(a.root.yaw, 45, 0.5)).toBe(true);
    expect(near(a.pose().turn, 0, 0.5)).toBe(true);
    a.step(0.5);
    expect(near(a.pose().turn, 0, 0.5)).toBe(true);
  });
  it("is an earlier clip's turn once another plays: the walk after a 90° turn turns 90°, from its first step", () => {
    const a = new Animator(rig).layer("base", { clip: turning(90) });
    a.step(1);
    a.layer("base", { clip: walk, time: 0 }).step(1 / 60);
    expect(near(a.pose().turn, 90, 1)).toBe(true);
  });
  it("is kept from the last step while a host sets a clip's time without stepping (a scrub): the clip's pose as written", () => {
    const a = new Animator(rig).layer("base", { clip: turning(90) });
    a.layer("base", { time: 0.75 });
    expect(a.pose().turn).toBe(0);
    expect(near(a.pose().key.body![0]! - k0.body[0]!, 67.5, 0.5)).toBe(true);
  });
  it("is a loop's earlier cycles' turn: halfway through its second cycle, one cycle's", () => {
    const a = new Animator(rig).layer("base", { clip: turning(60, true) });
    a.step(1.5);
    expect(near(a.root.yaw, 90, 0.5)).toBe(true);
    expect(near(a.pose().turn, 60, 0.5)).toBe(true);
  });
  it("follows a place: the root where it's put, the turn its heading less the pose's", () => {
    const a = new Animator(rig).layer("base", { clip: turning(90), time: 0.5 }).place({ forward: 120, right: -40, yaw: 30 });
    expect(a.root).toEqual({ forward: 120, right: -40, yaw: 30 });
    expect(near(a.pose().turn, 30 - 45, 0.5)).toBe(true);
    expect(() => a.place({ forward: Number.NaN, right: 0, yaw: 0 })).toThrow(AnimatorError);
  });
});
