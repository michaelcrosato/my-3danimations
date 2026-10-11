// The raster tests' pose: a library clip's key (Punch_Jab at 0.25 s, the left fist out), decoded on its own rest.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, parseClip, type Rest } from "@m3a/core";

const SET = join(import.meta.dirname, "../../../library/sets/QUATERNIUS_3D2DGE");
/** Every named view. */
export const VIEW_NAMES = ["front", "side", "back", "top", "three-quarter"] as const;
/** The test clip and its rest. */
export function testClip(name = "Punch_Jab") {
  const clip = parseClip(readFileSync(join(SET, `${name}.json`), "utf8"));
  return { clip, R: JSON.parse(readFileSync(join(SET, "_set.json"), "utf8")).sources[clip.restSrc].rest as Rest };
}
/** The pose: 36 body points (mm). */
export function testPose(t = 0.25, name = "Punch_Jab"): Float32Array {
  const { clip, R } = testClip(name);
  return format.pose(R, clip, t);
}
