// The review page's player (WP-F.11): a row's clip played, looping, right in its card, on the gallery's default test
// character (route.ts DEFAULT_CHAR) at the view its preview sheet is drawn at (view.ts SHEET_VIEW), by the gallery's
// own stage and player (stage.ts's Stage, player.ts's ClipPlayer: the same code, not a copy; the frame loop is the
// gallery page's: advance, pose, place, draw). The page has one stage, made at the first Play and moved into the card
// that plays, so it holds one WebGL context however many cards play in turn (phones cap a page's contexts): starting a
// card stops the one playing, and Stop takes the stage out of its card. three.js loads with that first Play, so the
// queue opens as fast as before. A card out of sight holds its clip still. With nothing playing the page draws no
// frame: three's own frame loop (r182 runs one from the renderer's init until its dispose) runs only while a card
// plays. Playing decides nothing: the verdicts are the buttons'.
import type { Clip, Rest } from "@m3a/core";
import type { GalleryRegistry } from "../host.ts";
import { clipFromText, libraryAt, loadSets } from "../library.ts";
import { h } from "../panels.ts";
import type { ClipPlayer } from "../player.ts";
import { DEFAULT_CHAR } from "../route.ts";
import type { Readback, Stage } from "../stage.ts";
import type { Row } from "./queue.ts";
import { SHEET_VIEW, submissionClip } from "./view.ts";

/** The clip row `r` plays: a sampled clip's from the library; a submission's from its text (a recipe compiled by the
 *  recipe.compile tool, as its sheet is). */
export async function clipOf(r: Row, reg: GalleryRegistry): Promise<{ clip: Clip; rest: Rest }> {
  if ("stale" in r) {
    await loadSets([r.id.split("/")[0]!]);
    return libraryAt().clip(r.id);
  }
  if (!r.text) throw new Error("the queue holds no text for it: m3a review export writes each submission's");
  const { path, compiled } = await submissionClip({ ...r, text: r.text }, reg);
  if (!path) throw new Error(compiled!.verdict);
  return clipFromText(reg.host.files.get(path)!);
}

/** Runs three's own frame loop while a card plays, and stops it otherwise (`on` false). r182's renderer starts it at
 *  init (renderers/common/Animation.js: a requestAnimationFrame every frame, updating its node frame) and stops it only
 *  at dispose; no public call pauses it, so this reads its private `_animation` (pinned to r182: a release without it
 *  leaves the loop running, as before, and plays the same). */
function threeLoop(stage: Stage, on: boolean): void {
  const loop = (stage.renderer as unknown as { _animation?: { start(): void; stop(): void; _requestId: number | null } | null })._animation;
  if (!loop) return;
  if (!on) loop.stop();
  else if (loop._requestId === null) loop.start();
}

/** What plays now, as plain JSON: the row, its clip's time (s), length and loop, the backend drawing and the stages
 *  made (one a page). */
export interface Playing {
  id: string;
  clip: string;
  time: number;
  dur: number;
  loop: boolean;
  backend: string;
  stages: number;
}

/** The page's one stage and what it plays: a row's clip, in that row's card. */
export class CardPlayer {
  /** The stages made so far: one a page, each a WebGL context. */
  stages = 0;
  /** Why the last Play didn't play, or null. */
  error: string | null = null;
  /** Called when what plays changes (a Play, a Stop, a failure), to bring the cards' controls in step. */
  onChange: () => void = () => {};
  readonly #reg: GalleryRegistry;
  readonly #webgl2: boolean;
  /** The stage's element (its canvas and the time), moved into the card that plays. */
  readonly #box = h("div", { class: "stage", role: "img" });
  readonly #clock = h("span", { class: "clock" });
  #stage: Promise<Stage> | null = null;
  #made: Stage | null = null;
  #player: ClipPlayer | null = null;
  #id: string | null = null;
  /** The Plays asked for so far: only the latest one plays. */
  #asked = 0;
  #raf = 0;
  #last = 0;
  #seen = true;

  /** A player whose stage draws with WebGL 2 forced when `webgl2` (the gallery's ?renderer=webgl2). */
  constructor(reg: GalleryRegistry, webgl2: boolean) {
    [this.#reg, this.#webgl2] = [reg, webgl2];
    this.#box.append(this.#clock);
    new IntersectionObserver((seen) => (this.#seen = seen.at(-1)?.isIntersecting ?? true)).observe(this.#box);
  }

  /** The row playing (or loading to play), or null. */
  get playing(): string | null {
    return this.#id;
  }

  /** The page's stage, made once, in the box (made again at the next Play when making it failed). */
  #stageOf(): Promise<Stage> {
    return (this.#stage ??= import("../stage.ts")
      .then(async ({ Stage }) => {
        const s = await Stage.create(this.#box, this.#webgl2);
        this.stages++;
        // idle until a card plays (a Stop may have come while it was made)
        threeLoop(s, false);
        // the camera is fixed at the sheet's view: a finger on the stage scrolls the page (OrbitControls took touches)
        s.renderer.domElement.style.touchAction = "auto";
        return (this.#made = s);
      })
      .catch((err: unknown) => {
        this.#stage = null;
        throw err;
      }));
  }

  /** Plays row `r`'s clip, looping, in `slot` (its card's), stopping the one that plays; resolves once its first frame
   *  is drawn, or with why it couldn't play said in the slot. A Play or Stop made meanwhile wins. */
  async play(r: Row, slot: HTMLElement): Promise<void> {
    this.stop();
    const mine = ++this.#asked;
    [this.#id, this.error] = [r.id, null];
    this.#clock.textContent = "loading…";
    this.#box.setAttribute("aria-label", `${r.id} playing on ${DEFAULT_CHAR}`);
    slot.replaceChildren(this.#box);
    this.onChange();
    // a failure (loading, or a frame drawn) is said in the slot, and stops it
    const fail = (err: unknown) => {
      if (mine !== this.#asked) return;
      cancelAnimationFrame(this.#raf);
      if (this.#made) threeLoop(this.#made, false);
      [this.#player, this.#id, this.error] = [null, null, err instanceof Error ? err.message : String(err)];
      slot.replaceChildren(h("p", { class: "note fail" }, `not played: ${this.error}`));
      this.onChange();
    };
    try {
      const [stage, { ClipPlayer }, { clip, rest }] = await Promise.all([this.#stageOf(), import("../player.ts"), clipOf(r, this.#reg)]);
      const bound = mine === this.#asked ? await stage.setCharacter(DEFAULT_CHAR) : null;
      if (mine !== this.#asked || !bound) return;
      this.#player = new ClipPlayer(bound, clip, rest);
      stage.setView(SHEET_VIEW);
      stage.resize();
      threeLoop(stage, true);
      this.#draw(stage, 0);
      this.#last = performance.now();
      const frame = (now: number) => {
        if (mine !== this.#asked) return;
        // as the gallery's frame loop steps (main.ts): at most a quarter second a frame
        const dt = Math.min(0.25, (now - this.#last) / 1000);
        this.#last = now;
        try {
          if (this.#seen) this.#draw(stage, dt);
        } catch (err) {
          fail(err);
          return;
        }
        this.#raf = requestAnimationFrame(frame);
      };
      this.#raf = requestAnimationFrame(frame);
    } catch (err) {
      fail(err);
      return;
    }
    this.onChange();
  }

  /** Plays on by `dt` seconds and draws the frame: the pose at the clip's time, placed where its root stands and turned
   *  by what its bones don't carry (the player's `turn`, F.14). */
  #draw(stage: Stage, dt: number): void {
    const p = this.#player!;
    p.advance(dt);
    p.apply();
    stage.place(p.root(), p.turn());
    stage.render();
    this.#clock.textContent = `${p.id} · ${p.time.toFixed(2)} / ${p.dur.toFixed(2)} s${p.loop ? " · loop" : ""}`;
  }

  /** Stops what plays (one loading included), three's frame loop with it, and takes the stage out of its card. */
  stop(): void {
    this.#asked++;
    cancelAnimationFrame(this.#raf);
    if (this.#made) threeLoop(this.#made, false);
    const was = this.#id;
    [this.#player, this.#id] = [null, null];
    this.#box.remove();
    if (was) this.onChange();
  }

  /** What plays now (its first frame drawn), or null. */
  state(): Playing | null {
    const p = this.#player;
    if (!p || !this.#id || !this.#made) return null;
    return { id: this.#id, clip: p.id, time: Math.round(p.time * 1e6) / 1e6, dur: p.dur, loop: p.loop, backend: this.#made.backend, stages: this.stages };
  }

  /** The frame playing read back (Stage.readback: the pixels the character changed), or null with nothing playing. */
  async frame(): Promise<Readback | null> {
    return this.#player && this.#made ? this.#made.readback() : null;
  }
}
