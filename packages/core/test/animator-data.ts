// The animator script's data (Node only: it reads the library): the tiny rig, and four migrated clips with their
// contacts measured and a few events added (the library's clips carry none yet).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { measureFacts, parseClip, type Clip, type Rest } from "./all.ts";
import type { ScriptData } from "./animator-script.ts";

const SET = join(import.meta.dirname, "../../../library/sets/QUATERNIUS_3D2DGE");

/** A library clip, with its contacts measured on its own rest when it walks or runs. */
export function libraryClip(name: string, contacts = false): Clip {
  const clip = parseClip(readFileSync(join(SET, `${name}.json`), "utf8"));
  if (contacts) {
    const R = JSON.parse(readFileSync(join(SET, "_set.json"), "utf8")).sources[clip.restSrc].rest as Rest;
    clip.contacts = measureFacts(clip, R).contacts;
  }
  return clip;
}

/** The rig and the script's clips: a walk and a jog (with contacts and footstep events), a punch and a flinch. */
export function scriptData(): ScriptData {
  const walk = libraryClip("Walk_Loop", true), jog = libraryClip("Jog_Fwd_Loop", true), punch = libraryClip("Punch_Jab"), flinch = libraryClip("Hit_Head");
  for (const c of [walk, jog]) c.events = [{ t: 0.1, name: "step", foot: "L" }, { t: c.dur / 2 + 0.1, name: "step", foot: "R" }];
  punch.events = [{ t: 0, name: "windup" }, { t: 0.2, name: "hit" }, { t: punch.dur, name: "end" }];
  return { skeleton: rigSkeleton(), clips: [walk, jog, punch, flinch] };
}
