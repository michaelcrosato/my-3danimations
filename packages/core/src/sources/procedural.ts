// The procedural source (PLAN.md WP-9.2): WP-6.2's gaits, idles and moves behind the socket. The intent picks one by
// its name, tags and about line (match.ts), the seed picks among equal matches, and it is made on the request's body:
// a gait from the standing pose (fitted to the body, with a warning, when it can't play there as given), an idle and a
// move from the standing pose too. Its clips are CC0 (the package's own motion), their provenance procedural.
// Constraints and the length are the socket's to measure: a procedural clip keeps its own poses and timing.
import { VERSION } from "../version.ts";
import { moveClip } from "../procedural/clip.ts";
import { fitGait, gaitClip, GAITS, type Gait } from "../procedural/gait.ts";
import { idleClip, IDLES, type Idle } from "../procedural/idle.ts";
import type { Move } from "../procedural/move.ts";
import type { Clip } from "../format/types.ts";
import { pick, type Candidate } from "./match.ts";
import { SourceError, type MotionSource, type SourceOutput, type SourceRequest } from "./types.ts";

/** What the procedural source can make: moves (library/moves.json's, given as data: core reads no file), and the
 *  gaits and idles (core's GAITS and IDLES by default). */
export interface ProceduralBook {
  moves?: readonly Move[];
  gaits?: readonly Gait[];
  idles?: readonly Idle[];
}

type Made = { kind: "gait"; gait: Gait } | { kind: "idle"; idle: Idle } | { kind: "move"; move: Move };

/** The book's entries as candidates, gaits first, then idles, then moves, each in the book's order. */
function candidates(book: ProceduralBook): Candidate<Made>[] {
  return [
    ...(book.gaits ?? GAITS).map((g) => ({ name: g.name, tags: [g.stance < 0.5 ? "run" : "walk", "gait", "loop"], about: g.about, value: { kind: "gait", gait: g } as Made })),
    ...(book.idles ?? IDLES).map((i) => ({ name: i.name, tags: ["idle", "stand", "loop"], about: i.about, value: { kind: "idle", idle: i } as Made })),
    ...(book.moves ?? []).map((m) => ({ name: m.name, tags: [m.hand === "kick" ? "kick" : "attack", "move"], about: m.about, value: { kind: "move", move: m } as Made })),
  ];
}

/** A gait on the request's body: as given, or fitted to it (fitGait) with a warning when it can't play as given. */
function gaitOn(g: Gait, req: SourceRequest, warnings: string[]): Clip {
  const { rest, restSrc } = req.skeleton;
  try {
    return gaitClip(g, rest, { restSrc });
  } catch (err) {
    const fitted = fitGait(g, rest);
    warnings.push(`the ${g.name} gait can't play on this body as given (${err instanceof Error ? err.message.slice(0, 120) : String(err)}...); fitted: speed ${fitted.speed}, lift ${fitted.lift ?? 12}`);
    return gaitClip(fitted, rest, { restSrc });
  }
}

/**
 * The procedural source: a gait, an idle or a move matching the intent, made on the request's body. E_NO_MATCH (with
 * every name it knows) when nothing matches.
 */
export function proceduralSource(book: ProceduralBook = {}): MotionSource {
  const cands = candidates(book);
  return {
    name: "procedural",
    terms: { license: "CC0-1.0", version: VERSION },
    generate(req: SourceRequest): SourceOutput {
      const hit = pick(req.intent, req.seed, cands);
      if (!hit) throw new SourceError("E_NO_MATCH", `procedural: nothing matches ${JSON.stringify(req.intent)}; name a gait, an idle or a move: ${cands.map((c) => c.name).join(", ")}`);
      const v = hit.chosen.value, warnings: string[] = [], { rest, restSrc } = req.skeleton;
      if (hit.tied.length > 1) warnings.push(`seed ${req.seed} picked ${hit.chosen.name} of ${hit.tied.length} equal matches (${hit.tied.join(", ")}); another seed may pick another`);
      if (req.constraints?.length) warnings.push("procedural clips keep their own poses: constraints are measured, not followed");
      const clip = v.kind === "gait" ? gaitOn(v.gait, req, warnings) : v.kind === "idle" ? idleClip(v.idle, rest, { restSrc }) : moveClip(v.move, rest, { restSrc });
      return { clip, rest, warnings };
    },
  };
}
