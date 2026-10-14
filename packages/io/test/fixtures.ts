// Test inputs built in code (no binary fixtures, D9): shardfall's tiny MotionBuilder skeleton as BVH text, two frames
// (standing; the left elbow bent 90° about y).

const HIERARCHY = `HIERARCHY
ROOT Hips
{
 OFFSET 0 0 0
 CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
 JOINT Spine { OFFSET 0 10 0 CHANNELS 3 Zrotation Xrotation Yrotation
  JOINT Spine1 { OFFSET 0 10 0 CHANNELS 3 Zrotation Xrotation Yrotation
   JOINT Spine2 { OFFSET 0 10 0 CHANNELS 3 Zrotation Xrotation Yrotation
    JOINT Neck { OFFSET 0 15 0 CHANNELS 3 Zrotation Xrotation Yrotation
     JOINT Head { OFFSET 0 10 0 CHANNELS 3 Zrotation Xrotation Yrotation End Site { OFFSET 0 18 0 } } }
    JOINT LeftShoulder { OFFSET 3 12 0 CHANNELS 3 Zrotation Xrotation Yrotation
     JOINT LeftArm { OFFSET 15 0 0 CHANNELS 3 Zrotation Xrotation Yrotation
      JOINT LeftForeArm { OFFSET 28 0 0 CHANNELS 3 Zrotation Xrotation Yrotation
       JOINT LeftHand { OFFSET 25 0 0 CHANNELS 3 Zrotation Xrotation Yrotation End Site { OFFSET 18 0 0 } } } } }
    JOINT RightShoulder { OFFSET -3 12 0 CHANNELS 3 Zrotation Xrotation Yrotation
     JOINT RightArm { OFFSET -15 0 0 CHANNELS 3 Zrotation Xrotation Yrotation
      JOINT RightForeArm { OFFSET -28 0 0 CHANNELS 3 Zrotation Xrotation Yrotation
       JOINT RightHand { OFFSET -25 0 0 CHANNELS 3 Zrotation Xrotation Yrotation End Site { OFFSET -18 0 0 } } } } } } } }
 JOINT LeftUpLeg { OFFSET 10 0 0 CHANNELS 3 Zrotation Xrotation Yrotation
  JOINT LeftLeg { OFFSET 0 -44 0 CHANNELS 3 Zrotation Xrotation Yrotation
   JOINT LeftFoot { OFFSET 0 -43 0 CHANNELS 3 Zrotation Xrotation Yrotation
    JOINT LeftToeBase { OFFSET 0 -8 14 CHANNELS 3 Zrotation Xrotation Yrotation End Site { OFFSET 0 0 6 } } } } }
 JOINT RightUpLeg { OFFSET -10 0 0 CHANNELS 3 Zrotation Xrotation Yrotation
  JOINT RightLeg { OFFSET 0 -44 0 CHANNELS 3 Zrotation Xrotation Yrotation
   JOINT RightFoot { OFFSET 0 -43 0 CHANNELS 3 Zrotation Xrotation Yrotation
    JOINT RightToeBase { OFFSET 0 -8 14 CHANNELS 3 Zrotation Xrotation Yrotation End Site { OFFSET 0 0 6 } } } } }
}
MOTION
`;

/**
 * shardfall's tiny BVH (pav_tools bvh.rs tests), `frames` frames at `frameTime`: the hips 95 cm up; `bend(f)` gives frame
 * f's left elbow bend about y (degrees); `edit(f, values)` changes any other channel (index 6 + 3 × (joint − 1) + axis,
 * the axes Z, X, Y).
 */
export function tinyBvh(frames = 2, frameTime = 0.5, bend: (f: number) => number = (f) => (f === 1 ? 90 : 0), edit: (f: number, v: number[]) => void = () => {}): string {
  const joints = 22, rows: string[] = [];
  for (let f = 0; f < frames; f++) {
    const v = new Array<number>(6 + 3 * (joints - 1)).fill(0);
    v[1] = 95;
    v[6 + 3 * 7 + 2] = bend(f);
    edit(f, v);
    rows.push(v.join(" "));
  }
  return `${HIERARCHY}Frames: ${frames}\nFrame Time: ${frameTime}\n${rows.join("\n")}\n`;
}
/** The tiny skeleton with its legs laid along x at rest, as MotionBuilder lays bones: a frame turns them down. */
export function sidewaysLegs(text: string): string {
  return text.replace(/(JOINT (?:Left|Right)Leg \{ OFFSET) 0 -44 0/g, "$1 44 0 0").replace(/(JOINT (?:Left|Right)Foot \{ OFFSET) 0 -43 0/g, "$1 43 0 0");
}
/** The two-frame tiny BVH. */
export const TINY = tinyBvh();
