# The m3a skeleton profile, 2.0-rc

**Status:** release candidate, written in WP-1.4 (2026-10-11); frozen with `MOTION.md` at gate G1. **Code:**
`@m3a/core` `skeleton/` (`recognize`, `patchMapping`, `restFrame`, `measure`, `restPoints`). The format's keys and body
points are in `spec/MOTION.md`; this document says which bones of a real skeleton play them.

## 1. The canonical humanoid

The canonical skeleton is **VRM 1.0's humanoid** (D5): 55 bones, of which 15 are required. The solver needs only the
15 and uses the others when present.

| Group | Bones | Required |
|---|---|---|
| Torso | `hips`, `spine`, `chest`, `upperChest`, `neck` | `hips`, `spine` |
| Head | `head`, `leftEye`, `rightEye`, `jaw` | `head` |
| Legs | `leftUpperLeg`, `leftLowerLeg`, `leftFoot`, `leftToes`, and the right's | upper leg, lower leg, foot (both sides) |
| Arms | `leftShoulder`, `leftUpperArm`, `leftLowerArm`, `leftHand`, and the right's | upper arm, lower arm, hand (both sides) |
| Fingers | per hand: `Thumb{Metacarpal,Proximal,Distal}`, `{Index,Middle,Ring,Little}{Proximal,Intermediate,Distal}` | none |

Each bone's parent is the nearest present one of: `hips` ← `spine` ← `chest` ← `upperChest` ← `neck` ← `head`; the
legs hang from `hips`; `shoulder` hangs from `upperChest`; then `upperArm`, `lowerArm`, `hand`, and the fingers from the
hand. A bone's **joint** is its head (where it turns), its **tip** the far end (its child's joint, or half its parent
segment again for a leaf).

Other body plans (quadrupeds, creatures) are reserved; `skeleton` in a clip is `"humanoid"` (`MOTION.md` §4).

## 2. Frames

- **The format's frame** is the body's own: forward, right, up, with the root on the ground below the hips at the
  clip's start. Its coordinates satisfy forward × right = up as numbers (`MOTION.md` §2), which makes the triad
  left-handed in physical space (facing north, north × east points down). Adapters convert explicitly.
- **glTF and VRM** are y-up and right-handed, characters facing +z with their left at +x, so a format point
  `(f, r, z)` in millimetres sits at glTF `(x, y, z) = (−r, z, f) / 1000` in metres. The conversion is a reflection:
  an adapter mirrors handedness once, in one place (WP-2.4, WP-4.3), never per bone.

## 3. Rest measurement

`restFrame(skeleton, mapping)` measures, from the bones at rest:
- **forward** from the heels to the toes (each foot's joint to its toes' joint, flattened onto the ground plane);
- **right** from the left thigh's joint to the right's;
- **up** as the skeleton says (glTF: +y);
- **the rest kind**: how far the upper arms drop below horizontal, averaged: under 20° a **T** pose, under 60° an **A**
  pose, else **relaxed** (arms down).

Rest kinds are normalized by measurement, not by posing: the solver reads each bone's rest direction from the bones
themselves, so a T, A or relaxed rest retargets the same.

`restPoints(skeleton, mapping, frame)` places the 36 body points on the skeleton at rest (§4), in the format's frame,
in millimetres. On the tiny test rig it lands within 0.001 mm of where my-3d2dge's importer captured them.

`measure(clips, restClip)` turns a library's captured clips into its **rest body** (`MOTION.md` §3.2): proportions
and offsets from the rest clip's first frame (a T-pose when the library has one), and the **spine shares**: for each
of the three lower spine bones, the share of the pelvis-to-chest turn (in steps of 0.05) that best explains the
library's own clips, and likewise the neck's share of the chest-to-head turn. Shares differ per library because each
library's animators bend the spine their own way. It is my-3d2dge's `measure`, operation for operation, and reproduces
the rests in tier 1a bit for bit. A target skeleton is measured the same way, from `restPoints` as a one-frame clip
(its shares are then 0, 0, 0, 1: a still pose carries no spine motion to fit).

## 4. Body points on bones

Each body point sits on the first bone in its list that the skeleton has. "Ahead" is 120 mm forward of the joint at
rest; "across" is 35 mm toward the thumb (forward, in a palms-down T-pose) at a share of the way along the hand.

| Body point | On | Fallback |
|---|---|---|
| `pelvis` | `hips` joint | |
| `spine1` | `spine` joint | |
| `spine2` | `chest` joint | halfway along `spine` |
| `chest` | `upperChest` joint | `chest` joint, then `spine`'s tip |
| `neck`, `head` | `neck` joint, `head` joint | `neck`: `head` joint |
| `headTop` | `head` tip | |
| `faceF`, `chestF`, `pelvisF` | ahead of `head`, of the chest point's bone, of `hips` | |
| `clav`, `sh`, `elbow`, `wrist` | `shoulder`, `upperArm`, `lowerArm`, `hand` joints | `clav`: `upperArm` joint |
| `index`, `knuck`, `pinky`, `fist` | `IndexProximal`, `MiddleProximal`, `LittleProximal`, `MiddleIntermediate` joints | across (+), along 0.5, across (−), along 0.75 of `hand` |
| `hip`, `knee`, `ankle` | `upperLeg`, `lowerLeg`, `foot` joints | |
| `ball`, `toe` | `toes` joint, `toes` tip | `foot`'s tip |

## 5. Mapping tables

`recognize` compares names after normalizing them: the namespace before the last `:` or `|` dropped
(`mixamorig:Hips`, `Armature|hips`), lower case, letters and digits only. Each table names, for each humanoid bone,
the source bone (or alternatives, first present wins):

| Table | Rigs | Example: hips, spine, upper arm, toes |
|---|---|---|
| `vrm` | VRM 1.0 bone names; Godot 4's SkeletonProfileHumanoid normalizes the same | `hips`, `spine`, `leftUpperArm`, `leftToes` |
| `unity` | Unity's HumanBodyBones as bone names (and VRM 0.x): thumbs Proximal/Intermediate/Distal | `Hips`, `Spine`, `LeftUpperArm`, `LeftToes` |
| `mixamo` | Mixamo (`mixamorig:`) | `Hips`, `Spine`, `LeftArm`, `LeftToeBase` |
| `unreal5` | UE5 mannequin: `spine_01`..`05` (chest `spine_03`, upper chest `spine_05`) | `pelvis`, `spine_01`, `upperarm_l`, `ball_l` |
| `unreal4` | UE4 mannequin and Unreal-style exports (Quaternius UAL2, Mesh2Motion) | `pelvis`, `spine_01`, `upperarm_l`, `ball_l` |
| `rigify` | Blender Rigify deform bones, as Quaternius' UAL1 Godot export and standard Rigify name them | `DEF-hips` or `DEF-spine`, `DEF-spine.001`, `DEF-upper_arm.L`, `DEF-toe.L` |
| `cmu` | CMU's ASF skeletons | `root`, `lowerback`, `lhumerus`, `ltoes` |
| `bvh100style` | 100STYLE's BVH (`Chest`..`Chest4`; `Shoulder` is the upper arm, `Collar` the shoulder) | `Hips`, `Chest`, `LeftShoulder`, `LeftToe` |

Quaternius' exports use the `rigify` table (UAL1's Godot edition) or `unreal4` (UAL2); Godot's retargeted exports use
`vrm`. Every table scores by the required bones it finds, then by all it finds; ties go to the earlier table.

## 6. recognize() and its output

`recognize({ bones: [{ name, parent, head }], up })` returns plain JSON:

```json
{ "method": "table", "table": "mixamo", "confidence": 1,
  "bones": { "hips": "mixamorig:Hips", "leftUpperArm": "mixamorig:LeftArm", "…": "…" },
  "missing": [], "unmapped": ["mixamorig:HeadTop_End"], "issues": [] }
```

- **confidence** is the share of the 15 required bones mapped, less 0.1 for each mapped bone that doesn't descend from
  its humanoid parent's bone. A complete table match is 1.
- **The topology and geometry fallback** runs when names leave required bones unmapped and every bone has a rest
  position: the hips are the shallowest bone where three chains of two or more bones meet; the two chains that reach
  lowest are the legs (a short first bone, like CMU's hip joint, skipped), the one that reaches highest the spine; the
  spine climbs to the bone where the neck and both arms branch; a short first arm bone is the shoulder; left and right
  come from forward (heels to toes) and up. Its confidence starts at 0.85, so a fallback never reads as certain, and
  its first issue says it was used.
- **Patching.** An agent corrects a mapping with `patchMapping(skeleton, recognition, { leftLowerArm: "Elbow_L" })`
  (or `null` to unmap); the result is checked again and stands at confidence 1, with "patched by hand" among its
  issues. Passing `table` to `recognize` tries only that table and keeps its gaps.

## 7. The Khronos watch

Khronos's **`KHR_character_skeleton_mapping`** (a standard map from a glTF's joints to humanoid bones) and
**`KHR_character_reference_pose`** (a declared rest pose) were heading for Release Candidate in July 2026
(`research_notes/AI native game animation landscape/formats_runtimes.md`). Neither was ratified when this profile was
written. Once ratified:
- a glTF carrying the mapping extension is read through it, as VRM's `humanBones` are, before any table;
- the reference pose, when declared, replaces `restFrame`'s measurement;
- this profile's bone names are aligned with the extension's (a minor version, adding names; nothing removed).

The spec watch (risk R7, `PLAN.md` §12) rechecks at every gate.

## 8. Known limits

- The topology fallback needs rest positions; a skeleton with names only, and none known, maps nothing.
- It takes the head as the second-to-last bone above the arms when there are three or more (a `HeadTop_End` leaf);
  on CMU's `lowerneck`, `upperneck`, `head` it picks `upperneck`, a few centimetres low. The `cmu` table is exact.
- Twist bones (`upperarm_twist_01_l`, `DEF-upper_arm.L.001`) stay unmapped; the solver doesn't drive them.
