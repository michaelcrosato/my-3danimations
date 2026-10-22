# Migrating my-3dge's animation onto m3a

Written 2026-10-19 in WP-10.1, against my-3dge at its pin `652ea6b` (its `PLAN.md` WPs 3.4–3.7 recorded in
ADR-0009 and Phase 8, WPs 8.1–8.10, with ADR-0010) and m3a 0.52. None of those my-3dge WPs has started (its ledger
lists them `todo`, 8.8 `on demand`), so the switch costs no rework. Acting in my-3dge is the owner's call (O9): this
page proposes, it changes nothing there.

**The proof.** `apps/lab/consumer-ts` is a lab shaped like my-3dge's needs: three.js r182's `WebGPURenderer`, a sim
stepped at a fixed 60 Hz by a frame clock built as my-3dge's (`engine/core/time.ts`: whole nanoseconds × hz, at most 6
steps a frame, `alpha`), and two humanoids driven by one m3a graph (locomotion by speed, a slash whose `hit` event
lands through the sim's rules, a flinch on the struck one) with root motion, through the public API alone.
`npm run e2e -- consumer-ts` builds it, runs its scripted session headless on WebGL 2 and in Node, and checks that
the page plays as Node step by step (every event, hit, place and hp, and the hashes), the hit lands, root motion
carries the hero along `sim.simulate`'s root to a micron at every step (4.84 m in all), the page's own frame loop takes
floor(T × 60 / 1000) steps over T ms of frames on a held clock, nothing is NaN, and the sim's hash is the same with
poses taken every step or never (WP-3.7's own test).

**The words.** **replaced**: my-3dge drops the WP and uses the package. **wrapped**: my-3dge keeps a thin module of
its own over the package, plus what the package lacks (named). **kept**: my-3dge builds it, on the package where it
touches animation.

## How my-3dge's frame meets the package

| my-3dge (PLAN.md §6.4, §6.5, ADR-0005, ADR-0009) | m3a |
|---|---|
| `anim.step` in the sim, every character, every tick, hashed | `new Animator(bound.core, { step: 1 / 60 }).play(graph, clips)`, then `animator.step(1 / 60)` once a tick: playheads, graph, events, root motion; `animator.save()` (plain JSON) or `animator.hash()` joins the sim's hash |
| `anim.pose` in the view, LOD allowed, never hashed | `animator.pose()`, or `animator.pose(undefined, { lod: 1 })` for the far ones (the options are the second argument); `attach(animator, bound).apply()` (or `.apply({ lod: 1 })`) writes the bones. Posing changes nothing `step` does |
| `preciseHits`: the pose in the sim, never by visibility | `animator.pose(undefined, { exact: true })`: full detail whatever presentation did |
| intents → `anim.step` → controller → rules → events | `animator.set("speed", v)` and `animator.trigger("attack")` before the step (read from it); its `StepResult`'s `root` (mm and degrees, in the frame the root had) feeds the controller; its `events` (or `animator.on("hit", fn)`) feed the rules |
| SI: metres, radians, +Y up, facing +Z, mocap (f, r, u) → (+Z, −X, +Y) (ADR-0004) | mm and degrees in core, forward, right and up as my-3dge's mocap frame; convert at the boundary (`apps/lab/consumer-ts/src/game.ts` does it in three lines); `attach(animator, bound).travel` (`@m3a/three`), each update's move, is already metres in the scene |
| Sim math made deterministic by swapping fdlibm into `Math` (§6.5) | core's hashed paths use its own portable math; the Animator's numbers are the same in Node, Chromium and Bun without the swap |

## The animator WPs (ADR-0009)

| WP | Title | Verdict | What does it in m3a | What my-3dge keeps |
|---|---|---|---|---|
| WP-3.4 | Skeleton, builds, pose, FK, sheets | **wrapped** | `bind(scene)` (`@m3a/three`) maps a humanoid rig by its bone names (Mixamo, Unreal, Rigify, VRM) or its shape onto VRM's humanoid bones (core's `skeleton.recognize(skeleton)`); `forward(bound, solved)` (FK); `ops.blend(a, b, w, ops.mask("upper"))`, `ops.addDelta` and the Animator's masked and additive layers; `animator.hash()` and `poseHash(bones)` (`@m3a/three/capture`); contact sheets drawn in software in Node (`@m3a/sensors`'s `sheet(clip, rest)`, `raster`); finite values and feet above the floor in the sensors (`checks.measure(checks.motionOfFrames(frames, rest))` on a run's poses) | the builds (chibi, heroic, bulky) as characters `bind` reads; the sockets (weaponR, headTop, eyes, contacts, back), read from the bones' world matrices; the 23-joint naming only if its puppets need it |
| WP-3.5 | IK | **wrapped** | the solver's two-bone IK with poles from the key's bend and twist (no singular pose); planted feet on slopes and steps through `new Animator(body, { ground })` (the sole pitched to the slope); hands to targets through `animator.pose(undefined, { hands })` | `aim`, a runtime look-at chain with limits (the package's `look` is a recipe step, made offline); its 10° slope and 0.2 m step test, run against `ground` |
| WP-3.6 | Humanoid procedural port | **replaced** | `procedural`: gaits and idles made as format-2 clips on any rest (`procedural.gaitClip`, `idleClip`; by id `PROCEDURAL/Walk`, `Brisk`, `Run`, `Limp`, `Breathe`, `Fidget` through `actions.proceduralResolver`), the move model carried from my-3d2dge and shardfall (`library/moves.json`), and the library's clips; poses and stances as recipe `pose` steps | nothing: the differential test against `humanoid-*.json` goes, since the package carries no chibi Humanoid (m3a PLAN.md §4: never carried over) and measures motion with the sensors instead |
| WP-3.7 | The Character animator and the body-state vocabulary | **wrapped** | the layer stack as Animator layers and a graph (spec/GRAPH.md): body states are graph states, an unknown one is refused naming the graph's own (`E_PARAM`, `G-E003`); `animator.graph`, `animator.layers`, `animator.save()` as `inspect()`; events; the two update paths and `exact` (above); LOD by `animator.pose(undefined, { lod: 1 })`; the sim hash the same posed or not, proved by `consumer-ts` | one `Animator` per actor in `engine/sim/actors.ts`; sockets and trail sampling; the physics blend and secondary slots (WP 6.2, 10.2) |

## The library WPs (ADR-0010)

| WP | Title | Verdict | What does it in m3a | What my-3dge keeps |
|---|---|---|---|---|
| WP-8.1 | Provenance, catalogs, ledger, docs | **replaced** | every clip's source, SPDX license, method, producer and lineage; `library/LICENSES/` (CMU's terms verbatim); the catalogs; `docs/LIBRARY.md`; the CMU ledger is m3a's (about 2,550 takes, verified by its survey), a repository file `search` accepts as `ledger`, not shipped in a package | its `SOURCES.md` shrinks to a pointer and the credits block `m3a license.check` prints |
| WP-8.2 | The readable codec and format 2 | **replaced** | `@m3a/core`'s codec (`parseClip(text)`, `serialize(clip)`, `validate(data)`, a recipe's `mirror` step), proved against vectors from `readable.js` itself; format 2 is spec/MOTION.md, with shardfall's `speed` in each catalog row | nothing |
| WP-8.3 | Re-containerize the sets | **replaced** | `library/sets/<SET>/`: one file per clip, `_set.json` with its content id, `catalog.tsv` with `speed`, a lock checked by SHA-256; HERO is not there | nothing |
| WP-8.4 | Baker, clip layer, retargeting, the mannequin | **wrapped** | `bake(clip, bound)` (`@m3a/three`): a three.js `AnimationClip` of quaternion tracks within 0.5 mm of the live solve (`bakeError`), for `AnimationMixer` in presentation; the clip layer is the Animator's (`animator.layer(name, { clip, weight, mask, additive, speed })`, fades, loop, events, root motion); retargeting by `bind` and the solver on each body's own lengths; ground speed by `contact.contactRoot(clip, rest, clip.contacts).speed` and a graph state's `rate`; the walk–run switch as two graph transitions with a gap between their thresholds; the strike by `measureFacts(clip, rest).strike` | the mannequin body (its puppet from `body`, built with its body grammar, then bound); the √(w·r) × 1.15 and × 0.87 switch, if wanted exactly, written into its graphs |
| WP-8.5 | Tools port | **wrapped** | `m3a` (CLI and MCP): `search`, `show`, `describe`, `sheet`, `film`, `import`, `export`, `license.check`; `@m3a/io` reads glTF/GLB, VRMA, BVH and CMU ASF/AMC; a cut is a recipe `clip` step with `from`, `to` | `x anim` as aliases over `npx m3a`; `x anim cmu` (a take by HTTP ranges), which m3a has only as a repository tool (`npm run corpora`), not in the package; `--legacy` (format 1, byte for byte) is dropped with format 1 |
| WP-8.6 | Library tests and QA | **replaced** | the package's library QA (`npm run qa -- library`: every clip's verdict, G5's floors, distributions that may only improve), the sensors, the conformance vectors | a smoke test of its own use, as `tests/e2e/consumer-ts.e2e.ts` is here |
| WP-8.7 | The ACTIONS layer | **replaced** | `actions.compileAction(action, library.resolver())` (beats, ground, interrupts; paired actions by `actions.compilePaired`) and `library/actions/` (climb up, get up, heavy landing, hop down, jab and flinch, roll, vault) | game-specific actions, written as action JSON |
| WP-8.8 | Re-import from the sources | **replaced** | the package's re-imports (Mesh2Motion with hands, Quaternius v2, CMU, 100STYLE through its corpora) and `m3a import` into a `local` set; from m3a's Phase 9, new motion comes in through its intake queue | nothing |
| WP-8.9 | Clip mode in the box | **kept** | the box plays any clip on the mannequin or the hero through an Animator; its machine interface is `m3a show` and `describe`; the 100STYLE credit comes from `creditsBlock(credits)` | the scene `labs/box/scenes/clips.ts` and the credit on the page |
| WP-8.10 | 100STYLE and Quaternius v2, from shardfall | **replaced** | the `STYLE100*` sets (the `cc-by` tier, in the `@m3a/library-cc-by` pack, opted in by `openLibrary({ tiers: ["cc0", "cc-by"] })`) and `QUATERNIUS_SHARDFALL`, with their credits | the on-screen credit rule, met by `creditsBlock` |

## Other my-3dge WPs the package replaces or shrinks

| WP | Title | Verdict | Why |
|---|---|---|---|
| WP-0.11 | Port reference vectors | shrinks | done at the pin; its `humanoid-*` vectors serve only WP 3.6's differential test, which goes, and its clip decodes (WP 8.2's `--clips`) are the package's vectors |
| WP-6.1 | Moves, timelines, hits | mostly replaced | moves are procedural clips from `library/moves.json` (`procedural.moveClip(move, rest, { restSrc })`), timelines are graphs and actions (cancel windows: a transition's `window`; combos: spec/graphs/Sword_Combo.json), hits are clip events at the measured strike; weapon sweeps and `hitShape` stay (they need sockets) |
| WP-6.2 | Reactions and secondary motion | partly replaced | flinches, knockdowns and get-ups are library clips on masked or additive layers; chains, capes, hair and squash stay |
| WP-6.6 | Animation checks, QA and sheets | mostly replaced | the sensors (16 metrics, `checks.METRICS`; planted-defect recall 100/100), sheets and `sim.simulate` over a graph and a script; its state matrix over my-3dge's own rigs stays |
| WP-10.8 | Lab pages (its Library Lab half) | partly replaced | the Mocap Lab's UX it carries for the Library Lab is m3a's gallery (WP-8.1, `npm run gallery`): catalog search (`?q=`), deep links to a set, clip, recipe or graph, a frame back and forward, any clip on any test character or fetched rig (the retarget preview); the clip as text is `m3a show` and `describe`, edited by `m3a edit`, mirrored by a recipe's `mirror` step. The Animation Lab and its other labs stay |
| G8 | The library gate | replaced | with Phase 8 gone, its proofs are the package's |

## Gaps found

What `consumer-ts` needed that the package doesn't give; each is a proposal for the package, not a patch made here.

1. **No library loader for a page.** `@m3a/library`'s main entry takes a `LibrarySource` but ships none for a
   browser; the lab's Vite config reads the files the graph names with `directory(defaultSets())` from
   `@m3a/library/node` and the page wraps them in `new Library(source)` (none of the three in the manual). A bundler
   helper (the ids a graph and its recipes read, as files) would save every web game the same 20 lines.
2. **Sockets.** No weapon, head or contact sockets: a game reads bone world matrices for sweeps, trails and props.
3. **Runtime aim.** `look` is only a recipe step; a look-at chain with limits at runtime is missing.
4. **Units at the boundary.** Core speaks mm and degrees; an SI engine converts every `StepResult.root`. A helper
   (or `StepResult` in metres and radians on request) would remove a class of bugs ADR-0004 was written against.
5. **A blend's `at` is the parameter's coordinate.** To set `speed` in m/s a game places points at each clip's
   `contactRoot` speed on its body; the manual says so for `rate` but not for blend points.
6. **No CC0 run passes the sensors as shipped.** `MESH2MOTION/Jog` fails `seamVelocity` (5.84 m/s at the seam) and
   `fix` doesn't repair it; the lab plays it anyway.
7. **Hit windows exist only in `sim.simulate`.** At runtime a `hit` event fires on one step; a window over `dur` or
   until `hit_end` is the game's to track.
8. **No mannequin and no secondary motion.** Test characters are generated in code; chains, capes and ragdolls are
   the package's on-demand D.4.
9. **The CMU ledger and fetcher stay in m3a's repository** (`tools/corpora/`): a game that imports CMU takes reads
   the ledger and fetches a take itself, then runs `m3a import`.
10. **Public names the manual doesn't teach.** None left but gap 1's; the types the lab names (`graph.Graph`,
    `recipe.Recipe`, `AnimClip`, `Bound`, `Attached`, `ThreeBound`) the manual leaves to the compiler. It teaches the
    others the lab uses, within its 8,000 tokens: since v0.55.1 (D124), `VERSION`, `math.PORTABLE` and
    `math.hashValue` (its places and hash), `graph.layersOf` and `graph.clipsOf` (the clips a graph names) and the
    Animator's `step` option; since v0.55.x (D128), `@m3a/three/test-characters`' `character`, `variant` and
    `TEST_SEEDS` (the generated test characters), `loadGlb` in a page as in Node (a textured .glb in Node takes
    `{ textures: false }`), and `attach`'s handle's `apply()` (the pose written without a step, for a game stepping
    the Animator itself) and `bound`.

## The proposal for my-3dge (O9)

The owner would open, in my-3dge, one pull request that edits only its plan:

1. **ADR-0009, amendment:** the animator is m3a's `Animator`, stepped once per sim tick in `anim.step` and posed in
   `anim.pose`; WPs 3.4, 3.5 and 3.7 shrink to the wrappers named above (builds and sockets, `aim`, the actor
   binding), and WP 3.6 is dropped with its differential test.
2. **ADR-0010, amendment:** the library is m3a's; Phase 8 becomes one WP, "consume m3a" (WP 8.4's mannequin and
   `x anim` aliases, WP 8.9's clip mode), and 8.1–8.3, 8.6–8.8 and 8.10 are dropped; G8 becomes "the box plays the
   library through the package, headless and in the page", with `consumer-ts`'s e2e as the pattern.
3. **The dependency:** `@m3a/core`, `@m3a/three` and `@m3a/library` pinned exactly, three r182 shared. Until the
   packages are published (O2), from `npm run pack`'s tarballs or a git dependency at a pinned commit.
4. **Shrunk:** WP 6.1, 6.2, 6.6 and 10.8's Library Lab as in the table; their sockets, sweeps and secondary motion
   stay my-3dge's.

The gaps above are the package's to close first where my-3dge's box needs them: sockets (2) before WP 6.1's sweeps
and WP 3.9's first-person camera (the head socket), the unit helper (4) before any actor moves, runtime aim (3) when
WP 3.5's `aim` would have landed.
