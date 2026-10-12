# The library

The motions every game can use: one clip per file in plain JSON (`spec/MOTION.md`), grouped in sets. Each set has a
manifest (`_set.json`: its sources, their licenses and rest bodies, its tier and its content id), a catalog
(`catalog.tsv`, one line a clip, at most 40 tokens, how a model picks clips) and a warnings baseline (`_baseline.json`).

## Tiers and the default pack (D10)

| Tier | Sets | Terms | Who sees it |
|---|---|---|---|
| `cc0` | MESH2MOTION, QUATERNIUS_3D2DGE, QUATERNIUS_SHARDFALL | CC0 1.0 (`LICENSES/CC0-1.0.txt`) | every game: the default pack |
| `cc-by` | STYLE100 | CC BY 4.0 (`LICENSES/CC-BY-4.0.txt`): credit each use | a game that opts in |
| `cmu` | CMU_CURATED | CMU's notice (`LICENSES/LicenseRef-CMU-Mocap.txt`): no reselling the data, even converted | a game that opts in |
| `local` | none committed (`local/`) | whatever its source allows; never ships | the machine it's on |

## Loading

```ts
import { openLibrary } from "@m3a/library/node";
const lib = openLibrary();                        // the CC0 default pack; { tiers: ["cc0", "cc-by"] } opts in
lib.catalog().filter((r) => r.tags.includes("walk"));
const { clip, rest } = lib.clip("QUATERNIUS_3D2DGE/Walk_Loop");
```

A set is checked the first time it is read: its content id (spec/MOTION.md §9.2) against its manifest, and each clip
file against `sets.lock.json`, so a file changed outside the writer is named. `npm run library -- check` checks every
set; `npm run library -- lock` writes the lock after the writer changes clips. A deprecated id resolves through the
lock's `aliases`, with a warning naming its successor.

Clips change only through the canonical serializer (core's `serialize`, then the library's writer), one work package
at a time (PLAN.md §8.4).

## Licenses and credits (WP-5.7)

`npm run license -- check library` checks every set's terms: each source an SPDX id (`LicenseRef-CMU-Mocap` for CMU's
notice) that fits the set's tier, its text kept verbatim in `LICENSES/<id>.txt`, and a credit line on every `cc-by`
and `cmu` set; an open `audit` on a source is listed as a question. `npm run license -- check <SET>` checks one set.

A game checks what it uses with a game manifest:

```json
{ "game": "Dockside Courier", "tiers": ["cc0", "cc-by"], "clips": ["QUATERNIUS_3D2DGE/Walk_Loop", "STYLE100/Angry_Walk"] }
```

`npm run license -- check game.json` fails a clip from a tier the game didn't opt into (CC0 alone by default), a clip
the library doesn't have, and `local` content in a game that ships (`"ships": false` for one that stays on its
machine), and prints the credits block the game shows: one line per credited set its clips come from. Listing no
clips credits every set of its tiers. In code: `checkSets` and `checkGame` from `@m3a/library`, `licenseText` from
`@m3a/library/node`.
