// Unit tests for what a review card says its clip should show (WP-F.12, shows.ts): the way a travel goes, in the
// character's own frame, to the nearest eighth of a turn; a speed as hip heights a second and a grown-up's pace; a
// one-shot's travel by where it ends; a length to the hundredth; a clip with no description said so; and G8's 20 clips,
// read from their files, each said with its own description, loop or once and length (the side runs the owner saw as
// side steps said at a walk). T1 runs it (vitest.config.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Clip } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { direction, hips, NO_DESC, pace, PACES, seconds, shows, STILL_SPEED, STILL_TRAVEL, tagWords, travelWords } from "./shows.ts";

const ROOT = join(import.meta.dirname, "../../../..");
const clip = (id: string) => JSON.parse(readFileSync(join(ROOT, "library/sets", `${id}.json`), "utf8")) as Clip;
/** G8's batch, the owner's first review (D133). */
const G8 = (JSON.parse(readFileSync(join(ROOT, "bench/results/gates/G8-run-1/queue-0.56.0.json"), "utf8")) as { clips: { id: string }[] }).clips.map((c) => c.id);

describe("direction", () => {
  it("names the eight ways in the character's own frame (forward, right: its right), none for no travel", () => {
    const at = (deg: number) => direction(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180));
    expect([0, 45, 90, 135, 180, -135, -90, -45].map(at)).toEqual(["forward", "forward and to its right", "to its right", "backward and to its right", "backward", "backward and to its left", "to its left", "forward and to its left"]);
    expect([at(22), at(23), at(67), at(68), at(112), at(113), at(157), at(158), at(-158)]).toEqual(["forward", "forward and to its right", "forward and to its right", "to its right", "to its right", "backward and to its right", "backward and to its right", "backward", "backward"]);
    expect([direction(0, 0), direction(Number.NaN, 1)]).toEqual([null, null]);
    // the side runs of G8's batch, their travel as their facts hold it
    expect([direction(-5.3, -143.8), direction(-1.3, 96.5), direction(-149.3, -31.9), direction(127, 2.8)]).toEqual(["to its left", "to its right", "backward", "forward"]);
  });
});

describe("speed and distance words", () => {
  it("says hip heights to the tenth, one in the singular", () => {
    expect([hips(110), hips(47), hips(100), hips(96), hips(327)]).toEqual(["1.1 hip heights", "0.5 hip heights", "1 hip height", "1 hip height", "3.3 hip heights"]);
  });
  it("says a grown-up's pace, slowest first, each band's bound its own", () => {
    expect(PACES.map(([max]) => max)).toEqual([...PACES.map(([max]) => max)].sort((a, b) => a - b));
    expect([pace(42), pace(60), pace(95), pace(130), pace(189), pace(200), pace(300), pace(647.9), pace(650), pace(900)]).toEqual(["a shuffle", "a slow walk", "a slow walk", "a walk", "a walk", "a brisk walk or a slow jog", "a jog", "a run", "a sprint", "a sprint"]);
  });
  it("says a length to the hundredth", () => {
    expect([seconds(1.267), seconds(2.5), seconds(6), seconds(0.567)]).toEqual(["1.27 s", "2.5 s", "6 s", "0.57 s"]);
  });
});

describe("travelWords", () => {
  it("says a loop's way and pace from its speed, else from its travel over its length; under STILL_SPEED it stays", () => {
    expect(travelWords({ speed: 110, travel: [-5.3, -143.8] }, true, 1.267)).toBe("Travels to its left at about 1.1 hip heights a second (for a grown-up, a slow walk)");
    expect(travelWords({ speed: 87, travel: [-149.3, -31.9] }, true, 1.8)).toBe("Travels backward at about 0.9 hip heights a second (for a grown-up, a slow walk)");
    expect(travelWords({ travel: [300, 0] }, true, 1)).toBe("Travels forward at about 3 hip heights a second (for a grown-up, a jog)");
    expect(travelWords({ speed: 250 }, true, 1)).toBe("Travels at about 2.5 hip heights a second (for a grown-up, a brisk walk or a slow jog)");
    expect([travelWords({ speed: 0, travel: [0, 0] }, true, 2.5), travelWords({ speed: STILL_SPEED - 0.1, travel: [-1, 0.8] }, true, 1.267), travelWords({ height: [90, 100] }, true, 2)]).toEqual(["Stays in place", "Stays in place", "Stays in place"]);
  });
  it("says a one-shot's travel by where it ends, about in place under STILL_TRAVEL, in place with none", () => {
    expect(travelWords({ travel: [-17, 47] }, false, 1.8)).toBe("Moves to its right: it ends about 0.5 hip heights from where it starts");
    expect(travelWords({ travel: [-327, 0] }, false, 0.833)).toBe("Moves backward: it ends about 3.3 hip heights from where it starts");
    expect(travelWords({ travel: [21, 20] }, false, 4.3)).toBe("Moves forward and to its right: it ends about 0.3 hip heights from where it starts");
    expect([travelWords({ travel: [20, 13] }, false, 6), travelWords({ travel: [STILL_TRAVEL - 1, 0] }, false, 1), travelWords({ height: [86, 89] }, false, 0.9), travelWords({ travel: [0, 0] }, false, 1)]).toEqual(["Stays about in place", "Stays about in place", "Stays in place", "Stays in place"]);
  });
  it("says a clip with no facts isn't measured, and reads no malformed travel", () => {
    expect([travelWords(undefined, true, 1), travelWords(null, false, 1), travelWords({ travel: [1, "x"] }, false, 1), travelWords({ travel: [400] }, true, 1)]).toEqual(["How far it travels isn't measured", "How far it travels isn't measured", "Stays in place", "Stays in place"]);
  });
});

describe("shows", () => {
  it("says a clip's description as its file holds it, how it plays and for how long, its travel and its tags", () => {
    const c = clip("STYLE100_SIDERUN/Stiff_SideRunLeft");
    expect(shows(c)).toEqual({
      desc: c.desc, tags: ["run", "sidestep", "left", "style"], plays: "loop", length: "1.27 s", playing: "Loops: it repeats with no break, 1.27 s each time",
      travel: "Travels to its left at about 1.1 hip heights a second (for a grown-up, a slow walk)",
    });
    expect(shows(clip("CMU_CURATED/Jump_Twist"))).toMatchObject({ plays: "once", length: "1.8 s", playing: "Plays once, 1.8 s long", travel: "Moves to its right: it ends about 0.5 hip heights from where it starts" });
    expect(tagWords(c.tags)).toBe("Tagged: run, sidestep, left, style");
    expect(tagWords([])).toBe("No tags");
  });
  it("says a clip with no description has none, and takes facts given in place of its own", () => {
    const c = { ...clip("CMU_CURATED/Wrench_Bolt"), desc: "  " };
    expect([shows(c).desc, NO_DESC]).toEqual([null, expect.stringContaining("no description")]);
    expect(shows(c, { speed: 140, travel: [140, 0] }).travel).toBe("Moves forward: it ends about 1.4 hip heights from where it starts");
    expect(shows({ ...c, facts: undefined }).travel).toBe("How far it travels isn't measured");
  });
  it("says each of G8's 20 clips by its own file: its description, loop or once and length; its side runs at a walk", () => {
    expect(G8).toHaveLength(20);
    for (const id of G8) {
      const c = clip(id), s = shows(c);
      expect([s.desc, s.plays, s.length, s.playing.startsWith(c.loop ? "Loops" : "Plays once")], id).toEqual([c.desc, c.loop ? "loop" : "once", seconds(c.dur), true]);
      if (c.tags.includes("idle")) expect(s.travel, id).toBe("Stays in place");
      if (c.tags.includes("sidestep") && c.tags.includes("run")) expect(s.travel, id).toMatch(new RegExp(`^Travels to its ${c.tags.includes("left") ? "left" : "right"} at about [\\d.]+ hip heights? a second \\(for a grown-up, a (slow )?walk\\)$`));
    }
  });
});
