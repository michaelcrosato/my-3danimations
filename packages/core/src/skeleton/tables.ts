// The mapping tables (PLAN.md §5.4, spec/SKELETON.md): for each rig family, the bone name (or names, first present
// wins) that plays each VRM 1.0 humanoid bone. Names compare after normalization: namespace prefixes (`mixamorig:`,
// `Armature|`) dropped, case folded, separators removed.

/** A rig family's names for the humanoid bones. */
export interface Table {
  name: string;
  about: string;
  bones: Readonly<Record<string, readonly string[]>>;
}

/** A name as tables compare it: no namespace, lower case, letters and digits only. */
export function normalizeName(name: string): string {
  const bare = name.replace(/^.*[:|]/, "");
  return bare.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type SideNames = (S: string, s: string, x: string) => Record<string, string | string[]>;
/** A table from its midline names and a function of the side (S: Left/Right, s: L/R, x: l/r). */
function table(name: string, about: string, center: Record<string, string | string[]>, side: SideNames): Table {
  const bones: Record<string, readonly string[]> = {};
  for (const [b, n] of Object.entries(center)) bones[b] = ([] as string[]).concat(n);
  for (const [vs, S, s, x] of [["left", "Left", "L", "l"], ["right", "Right", "R", "r"]] as const) for (const [part, n] of Object.entries(side(S, s, x))) bones[vs + part] = ([] as string[]).concat(n);
  return { name, about, bones };
}

const FINGERS = ["Index", "Middle", "Ring", "Little"] as const;
/** VRM 1.0's own names (and Godot's SkeletonProfileHumanoid, which normalizes the same). */
const vrmSide: SideNames = (S) => {
  const o: Record<string, string> = {};
  for (const p of ["Shoulder", "UpperArm", "LowerArm", "Hand", "UpperLeg", "LowerLeg", "Foot", "Toes", "Eye", "ThumbMetacarpal", "ThumbProximal", "ThumbDistal"]) o[p] = `${S}${p}`;
  for (const f of FINGERS) for (const j of ["Proximal", "Intermediate", "Distal"]) o[`${f}${j}`] = `${S}${f}${j}`;
  return o;
};

/** Every table recognize() tries, most specific first. */
export const TABLES: readonly Table[] = [
  table("vrm", "VRM 1.0 humanoid bone names (also Godot 4's SkeletonProfileHumanoid)", { hips: "hips", spine: "spine", chest: "chest", upperChest: "upperChest", neck: "neck", head: "head", jaw: "jaw" }, vrmSide),
  table("unity", "Unity HumanBodyBones as bone names (and VRM 0.x)", { hips: "Hips", spine: "Spine", chest: "Chest", upperChest: "UpperChest", neck: "Neck", head: "Head", jaw: "Jaw" }, (S) => {
    const o: Record<string, string> = { Shoulder: `${S}Shoulder`, UpperArm: `${S}UpperArm`, LowerArm: `${S}LowerArm`, Hand: `${S}Hand`, UpperLeg: `${S}UpperLeg`, LowerLeg: `${S}LowerLeg`, Foot: `${S}Foot`, Toes: `${S}Toes`, Eye: `${S}Eye`, ThumbMetacarpal: `${S}ThumbProximal`, ThumbProximal: `${S}ThumbIntermediate`, ThumbDistal: `${S}ThumbDistal` };
    for (const f of FINGERS) for (const j of ["Proximal", "Intermediate", "Distal"]) o[`${f}${j}`] = `${S}${f}${j}`;
    return o;
  }),
  table("mixamo", "Mixamo (mixamorig:*)", { hips: "Hips", spine: "Spine", chest: "Spine1", upperChest: "Spine2", neck: "Neck", head: "Head" }, (S) => {
    const o: Record<string, string> = { Shoulder: `${S}Shoulder`, UpperArm: `${S}Arm`, LowerArm: `${S}ForeArm`, Hand: `${S}Hand`, UpperLeg: `${S}UpLeg`, LowerLeg: `${S}Leg`, Foot: `${S}Foot`, Toes: `${S}ToeBase`, Eye: `${S}Eye`, ThumbMetacarpal: `${S}HandThumb1`, ThumbProximal: `${S}HandThumb2`, ThumbDistal: `${S}HandThumb3` };
    for (const f of FINGERS) ["Proximal", "Intermediate", "Distal"].forEach((j, i) => (o[`${f}${j}`] = `${S}Hand${f === "Little" ? "Pinky" : f}${i + 1}`));
    return o;
  }),
  table("unreal5", "Unreal Engine 5 mannequin (spine_01..05, neck_01..02, metacarpals)", { hips: "pelvis", spine: "spine_01", chest: "spine_03", upperChest: "spine_05", neck: "neck_01", head: "head" }, (_S, _s, x) => {
    const o: Record<string, string> = { Shoulder: `clavicle_${x}`, UpperArm: `upperarm_${x}`, LowerArm: `lowerarm_${x}`, Hand: `hand_${x}`, UpperLeg: `thigh_${x}`, LowerLeg: `calf_${x}`, Foot: `foot_${x}`, Toes: `ball_${x}`, ThumbMetacarpal: `thumb_01_${x}`, ThumbProximal: `thumb_02_${x}`, ThumbDistal: `thumb_03_${x}` };
    for (const f of FINGERS) ["Proximal", "Intermediate", "Distal"].forEach((j, i) => (o[`${f}${j}`] = `${f === "Little" ? "pinky" : f.toLowerCase()}_0${i + 1}_${x}`));
    return o;
  }),
  table("unreal4", "Unreal Engine 4 mannequin and Unreal-style exports (Quaternius UAL2, Mesh2Motion)", { hips: "pelvis", spine: "spine_01", chest: "spine_02", upperChest: "spine_03", neck: "neck_01", head: "head" }, (_S, _s, x) => {
    const o: Record<string, string> = { Shoulder: `clavicle_${x}`, UpperArm: `upperarm_${x}`, LowerArm: `lowerarm_${x}`, Hand: `hand_${x}`, UpperLeg: `thigh_${x}`, LowerLeg: `calf_${x}`, Foot: `foot_${x}`, Toes: `ball_${x}`, ThumbMetacarpal: `thumb_01_${x}`, ThumbProximal: `thumb_02_${x}`, ThumbDistal: `thumb_03_${x}` };
    for (const f of FINGERS) ["Proximal", "Intermediate", "Distal"].forEach((j, i) => (o[`${f}${j}`] = `${f === "Little" ? "pinky" : f.toLowerCase()}_0${i + 1}_${x}`));
    return o;
  }),
  table("rigify", "Blender Rigify deform bones (DEF-*), as Quaternius' UAL1 Godot export and standard Rigify name them", { hips: ["DEF-hips", "DEF-spine"], spine: "DEF-spine.001", chest: "DEF-spine.002", upperChest: "DEF-spine.003", neck: ["DEF-neck", "DEF-spine.004"], head: ["DEF-head", "DEF-spine.006"] }, (_S, s) => {
    const o: Record<string, string> = { Shoulder: `DEF-shoulder.${s}`, UpperArm: `DEF-upper_arm.${s}`, LowerArm: `DEF-forearm.${s}`, Hand: `DEF-hand.${s}`, UpperLeg: `DEF-thigh.${s}`, LowerLeg: `DEF-shin.${s}`, Foot: `DEF-foot.${s}`, Toes: `DEF-toe.${s}`, ThumbMetacarpal: `DEF-thumb.01.${s}`, ThumbProximal: `DEF-thumb.02.${s}`, ThumbDistal: `DEF-thumb.03.${s}` };
    for (const f of FINGERS) ["Proximal", "Intermediate", "Distal"].forEach((j, i) => (o[`${f}${j}`] = `DEF-f_${f === "Little" ? "pinky" : f.toLowerCase()}.0${i + 1}.${s}`));
    return o;
  }),
  table("cmu", "CMU motion capture skeletons (ASF)", { hips: "root", spine: "lowerback", chest: "upperback", upperChest: "thorax", neck: "lowerneck", head: "head" }, (_S, _s, x) => ({ Shoulder: `${x}clavicle`, UpperArm: `${x}humerus`, LowerArm: `${x}radius`, Hand: `${x}wrist`, UpperLeg: `${x}femur`, LowerLeg: `${x}tibia`, Foot: `${x}foot`, Toes: `${x}toes`, ThumbProximal: `${x}thumb`, MiddleProximal: `${x}fingers` })),
  table("bvh100style", "100STYLE BVH (Chest..Chest4, Collar, Shoulder for the upper arm)", { hips: "Hips", spine: "Chest", chest: "Chest2", upperChest: "Chest4", neck: "Neck", head: "Head" }, (S) => ({ Shoulder: `${S}Collar`, UpperArm: `${S}Shoulder`, LowerArm: `${S}Elbow`, Hand: `${S}Wrist`, UpperLeg: `${S}Hip`, LowerLeg: `${S}Knee`, Foot: `${S}Ankle`, Toes: `${S}Toe` })),
];
