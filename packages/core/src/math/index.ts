// The math kernel's public surface (PLAN.md WP-2.1): portable math and its modes, the scalar helpers, seeded streams,
// state hashes, and vectors, quaternions and matrices as namespaces (`vec3.add`, `quat.slerp`, `mat4.compose`).
export { PORTABLE, NATIVE, mathFor, type MathLike } from "./portable.ts";
export { TAU, clamp, lerp, approach, angDiff, lerpAng, approachAng, smoothDamp, ease, easesWith, hash2, noise2, type Ease, type Eases } from "./helpers.ts";
export { Rng, RngStreams, rng, derive } from "./rng.ts";
export { Fnv64, hashNumbers, hashValue, mix32 } from "./hash.ts";
export * as vec3 from "./vec3.ts";
export * as quat from "./quat.ts";
export * as mat4 from "./mat4.ts";
export type { Vec3 } from "./vec3.ts";
export type { Quat } from "./quat.ts";
export type { Mat4 } from "./mat4.ts";
