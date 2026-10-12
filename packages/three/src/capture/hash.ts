// The proof hash of a posed character (PLAN.md WP-4.5): FNV-1a 64 over the bits of every bone's local rotation and
// position, in skeleton order, so the same pose in Node and in a browser hashes the same, and any bit apart differs.
import type { Bone } from "three";

const buf = new DataView(new ArrayBuffer(8));
/** The bones' local transforms, hashed: 16 hex digits. */
export function poseHash(bones: readonly Bone[]): string {
  let h = 0xcbf29ce484222325n;
  const P = 0x100000001b3n, M = 0xffffffffffffffffn;
  const mix = (x: number) => {
    buf.setFloat64(0, x === 0 ? 0 : x);
    for (let i = 0; i < 8; i++) h = ((h ^ BigInt(buf.getUint8(i))) * P) & M;
  };
  for (const b of bones) {
    mix(b.quaternion.x);
    mix(b.quaternion.y);
    mix(b.quaternion.z);
    mix(b.quaternion.w);
    mix(b.position.x);
    mix(b.position.y);
    mix(b.position.z);
  }
  return h.toString(16).padStart(16, "0");
}
