// A recipe's shapes (spec/RECIPE.md, PLAN.md WP-6.1): the recipe, its steps, how the compiler reads a library clip,
// and the track every step makes: poses over time on a rest body, with the root's travel and heading, events and
// contacts.
import type { Rest } from "../format/body.ts";
import type { Clip, ClipEvent, Contacts } from "../format/types.ts";
import type { Pose } from "../ops/pose.ts";

/** A recipe: the compiled clip's id and description, and the steps that make it (the last one's track). */
export interface Recipe {
  format: string;
  id: string;
  name?: string;
  tags?: string[];
  desc?: string;
  /** The rate the result is sampled at before keys are fitted (30 by default). */
  fps?: number;
  steps: Step[];
}

/** One step: its operation, its optional name and the operation's own fields. */
export interface Step {
  op: string;
  as?: string;
  [field: string]: unknown;
}

/** A library clip as the compiler reads it: the clip, the rest it decodes on and its content id. */
export interface Resolved {
  clip: Clip;
  rest: Rest;
  contentId: string;
}
/** How the compiler finds a clip by id; `ids` lists the known ones, for "did you mean". */
export interface Resolver {
  (id: string): Resolved | undefined;
  ids?: () => readonly string[];
}

/** The root's place and heading relative to a track's start: forward and right in % of H0, the heading in degrees. */
export interface Root {
  forward: number;
  right: number;
  yaw: number;
}

/** What a step makes: frames at `fps` over `dur` (a once track's last frame at `dur`, a loop's last before it). */
export interface Track {
  dur: number;
  loop: boolean;
  fps: number;
  /** Each frame's time: every 1/fps s from 0, and `dur` last for a once track. */
  times: number[];
  /** The key numbers of every frame, without `root` and `yaw` (those are in `roots`). */
  poses: Pose[];
  /** The root of every frame, relative to the track's start. */
  roots: Root[];
  /** A loop's travel and turn over one cycle (where its next cycle starts). */
  cycle?: Root;
  events: ClipEvent[];
  contacts?: Contacts;
  /** The rest body the poses decode on, and its source entry. */
  rest: Rest;
  restSrc: string;
}
