// The canonical humanoid (spec/SKELETON.md): VRM 1.0's 55 humanoid bones, the 15 it requires, each bone's parent, and
// where the format's 36 body points sit on those bones.

/** The parts of a side, in VRM 1.0's naming after the `left`/`right` prefix. */
export const SIDE_PARTS = [
  "Shoulder", "UpperArm", "LowerArm", "Hand",
  "ThumbMetacarpal", "ThumbProximal", "ThumbDistal",
  "IndexProximal", "IndexIntermediate", "IndexDistal",
  "MiddleProximal", "MiddleIntermediate", "MiddleDistal",
  "RingProximal", "RingIntermediate", "RingDistal",
  "LittleProximal", "LittleIntermediate", "LittleDistal",
  "UpperLeg", "LowerLeg", "Foot", "Toes", "Eye",
] as const;

/** The bones on the midline. */
export const CENTER_BONES = ["hips", "spine", "chest", "upperChest", "neck", "head", "jaw"] as const;

/** Every VRM 1.0 humanoid bone name (55). */
export const HUMANOID_BONES: readonly string[] = [...CENTER_BONES, ...["left", "right"].flatMap((s) => SIDE_PARTS.map((p) => s + p))];

/** The 15 bones VRM 1.0 requires, and the only ones the solver needs. */
export const REQUIRED_BONES: readonly string[] = ["hips", "spine", "head", ...["left", "right"].flatMap((s) => ["UpperArm", "LowerArm", "Hand", "UpperLeg", "LowerLeg", "Foot"].map((p) => s + p))];

/** Each bone's parent in the humanoid hierarchy (the nearest present ancestor stands in for a missing one). */
export const HUMANOID_PARENT: Readonly<Record<string, string | null>> = (() => {
  const p: Record<string, string | null> = { hips: null, spine: "hips", chest: "spine", upperChest: "chest", neck: "upperChest", head: "neck", jaw: "head" };
  for (const s of ["left", "right"]) {
    Object.assign(p, {
      [`${s}Eye`]: "head",
      [`${s}Shoulder`]: "upperChest",
      [`${s}UpperArm`]: `${s}Shoulder`,
      [`${s}LowerArm`]: `${s}UpperArm`,
      [`${s}Hand`]: `${s}LowerArm`,
      [`${s}UpperLeg`]: "hips",
      [`${s}LowerLeg`]: `${s}UpperLeg`,
      [`${s}Foot`]: `${s}LowerLeg`,
      [`${s}Toes`]: `${s}Foot`,
      [`${s}ThumbMetacarpal`]: `${s}Hand`,
      [`${s}ThumbProximal`]: `${s}ThumbMetacarpal`,
      [`${s}ThumbDistal`]: `${s}ThumbProximal`,
    });
    for (const f of ["Index", "Middle", "Ring", "Little"]) Object.assign(p, { [`${s}${f}Proximal`]: `${s}Hand`, [`${s}${f}Intermediate`]: `${s}${f}Proximal`, [`${s}${f}Distal`]: `${s}${f}Intermediate` });
  }
  return p;
})();

/**
 * Where a body point sits: on a bone's joint (its head), its tip (the far end), a share `along` toward its child,
 * `ahead` 120 mm in the rest's forward direction, or `across` the hand (toward the thumb, ±). The first choice whose
 * bones the skeleton has wins (spec/SKELETON.md, "Body points on bones").
 */
export type Place = { bone: string; at: "joint" | "tip" | "ahead" } | { bone: string; at: "along"; share: number } | { bone: string; at: "across"; share: number; side: 1 | -1 };

/** The body points (spec/MOTION.md §3.1) on the humanoid's bones, each with its fallbacks in order. */
export const BODY_POINTS: Readonly<Record<string, readonly Place[]>> = (() => {
  const j = (bone: string): Place => ({ bone, at: "joint" });
  const m: Record<string, Place[]> = {
    pelvis: [j("hips")],
    spine1: [j("spine")],
    spine2: [j("chest"), { bone: "spine", at: "along", share: 0.5 }],
    chest: [j("upperChest"), j("chest"), { bone: "spine", at: "tip" }],
    neck: [j("neck"), { bone: "head", at: "joint" }],
    head: [j("head")],
    headTop: [{ bone: "head", at: "tip" }],
    faceF: [{ bone: "head", at: "ahead" }],
    chestF: [{ bone: "upperChest", at: "ahead" }, { bone: "chest", at: "ahead" }, { bone: "spine", at: "ahead" }],
    pelvisF: [{ bone: "hips", at: "ahead" }],
  };
  for (const [S, s] of [["L", "left"], ["R", "right"]] as const) {
    Object.assign(m, {
      [`clav${S}`]: [j(`${s}Shoulder`), j(`${s}UpperArm`)],
      [`sh${S}`]: [j(`${s}UpperArm`)],
      [`elbow${S}`]: [j(`${s}LowerArm`)],
      [`wrist${S}`]: [j(`${s}Hand`)],
      [`index${S}`]: [j(`${s}IndexProximal`), { bone: `${s}Hand`, at: "across", share: 0.75, side: 1 }],
      [`knuck${S}`]: [j(`${s}MiddleProximal`), { bone: `${s}Hand`, at: "along", share: 0.5 }],
      [`pinky${S}`]: [j(`${s}LittleProximal`), { bone: `${s}Hand`, at: "across", share: 0.75, side: -1 }],
      [`fist${S}`]: [j(`${s}MiddleIntermediate`), { bone: `${s}Hand`, at: "along", share: 0.75 }],
      [`hip${S}`]: [j(`${s}UpperLeg`)],
      [`knee${S}`]: [j(`${s}LowerLeg`)],
      [`ankle${S}`]: [j(`${s}Foot`)],
      [`ball${S}`]: [j(`${s}Toes`), { bone: `${s}Foot`, at: "tip" }],
      [`toe${S}`]: [{ bone: `${s}Toes`, at: "tip" }, { bone: `${s}Foot`, at: "tip" }],
    });
  }
  return m;
})();
