# The local lane

Libraries whose terms don't allow redistribution live here, on the machine that has them and nowhere else (D10,
PLAN.md WP-5.6): Bandai Namco's research motion dataset, Ubisoft's LaFAN1 (CC BY-NC-ND 4.0), Mixamo (Adobe's terms),
and anything else you may use but not pass on. Content here:

- **is never committed.** `.gitignore` keeps everything under `library/local/` but this README out of git, and
  `npm run doctrine` (the `local` step) fails a commit that forces a file in anyway;
- **never ships.** A set here has `"tier": "local"`, and `npm run license -- check game.json` fails a game that ships a
  clip from it, or opts into the `local` tier at all (`"ships": false` marks a game that stays on this machine);
- **is never used to train or derive a distributable clip.** No set under `library/sets/` names it, refers to
  `library/local/`, or has the `local` tier (the doctrine's `local` step); a clip made from local motion stays local.

The doctrine check reads only what git would commit, so it never reads local content: its binaries, budgets and
boundary checks skip this lane, and so does its fallback outside git.

## Using it

Import a library into a set of its own here with `@m3a/io`, the way any library is read:

- Bandai Namco and LaFAN1 ship BVH: `readBvh` (their bone maps are `bandai-namco` and `motionbuilder`);
- Mixamo ships FBX: convert to .glb first (`packages/io/README.md`, "FBX"), then `readGltfPosed`.

Then `npx m3a import <file> --set <SET> --license <id>` fits them into a local set under `imports/<SET>/` (move it
here), or, in code, `importSet` with a catalog and `localLane()` from `@m3a/tools/node`, which writes
`library/local/<SET>/`: its `_set.json` with `"tier": "local"` and the library's own terms in each source. Open it on this machine alone:

```ts
import { openLibrary } from "@m3a/library/node";
const local = openLibrary({ dir: "library/local", tiers: ["local"] });
```

Large corpora you may redistribute go through `npm run corpora` into `.cache/` instead (CMU, 100STYLE).
