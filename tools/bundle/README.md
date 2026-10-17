# tools/bundle: the packaging (WP-7.4)

`npm run pack [-- --check] [--example <file>]` (`node tools/bundle/main.ts` until the root script exists) builds into
`.cache/pack/` (git-ignored; nothing built is committed, and nothing is published: O2):

- **The packages** (`build.ts`): each `@m3a/*` package as ES modules with its declarations. Node's own type stripping
  turns `src/x.ts` into `dist/x.js` line for line, relative imports point at `.js`, and `tsc -b` writes the `.d.ts`.
  Each is staged in `stage/<name>/` with the package.json it ships with: its exports point at `dist/`, the `m3a` bin
  is `dist/node.js` (shebang kept), and `"private": true` stays until O2. The workspace's own package.json files keep
  their exports on `src/`, which Node 24 runs directly. Then `npm pack` writes `m3a-<name>-<version>.tgz`.
- **The library's packs** (D10): `@m3a/library` holds the CC0 sets alone. The cc-by and cmu sets ship as
  `@m3a/library-cc-by` and `@m3a/library-cmu`, each with its own lock, license texts and a README with the credits a
  game owes. Installed beside the library, `openLibrary({ tiers: ["cc0", "cc-by"] })` from `@m3a/library/node` (and
  the m3a tools, through game.json's `"tiers"`) finds them.
- **The single file** (`single.ts`, `runtime.ts`): `single/m3a.js`, one self-contained ES module for agents that can't
  install packages. It holds `@m3a/core`, `sensors`, `io`, `library` and `tools`' API, every name once, plus the CC0
  clips that `manifest.json` lists (a game manifest: `tiers: ["cc0"]` and its clips). `openLibrary()` opens those
  clips, verified with core's SHA-256, and `tools.call(name, args, { host })` runs a tool on them. Its opening comment
  carries the code's MIT license, the credits block and the license text of every tier it includes, which are also
  exported as `CREDITS` and `LICENSES`. three.js and `@m3a/three` are left out. An agent that can't install packages
  can't install three either, and the API it can use is headless (find, make, check, export, the tools). A bundled
  three would also triple the file and sit beside a game's own copy, whose objects fail the other copy's `instanceof`.

`--check` also proves the build, failing on any of these:
- a set in the wrong pack;
- the bin;
- m3a.js's credits or license texts;
- `npm run license -- check tools/bundle/manifest.json`;
- the sensors on every clip m3a.js carries: each passes, or carries its WP-5.8 baseline, and reads the same there as
  in the packages;
- a scratch project in a temp directory that installs the tarballs and runs the complete example, `npx m3a help`,
  `npx m3a version`, `m3a mcp`'s `tools/list` and `openLibrary` over the opt-in packs;
- m3a.js running the same example and printing the same thing.

## The complete example's marker

The example is the first fenced block in `packages/tools/MANUAL.md` whose info string is `ts example`:

````md
```ts example
import { Animator, playable } from "@m3a/core";
...
```
````

It runs as `example.ts` in the scratch project (Node strips the types), then on m3a.js with its `@m3a/*` imports taken
from `./m3a.js`. On m3a.js it may import `@m3a/core`, `sensors`, `io`, `library`, `tools`, and `openLibrary` and
`licenseText` from `@m3a/library/node`; anything else (`three`, `@m3a/three`, another Node entry) is refused, named. A
manual without the marker fails the check. `--example tools/bundle/standin.ts` runs the stand-in instead: a walk, a jab
with a hit event and a flinch, on core alone.

## Publishing, when O2 is answered

Nothing here publishes. When it does, every release is published from CI with npm provenance (Sigstore). The
workflow gets `permissions: id-token: write`, the staged package.json files get `"publishConfig": { "provenance":
true, "access": "public" }` with `"private"` dropped in the staged copy only, and the job runs `npm publish --provenance`
for each tarball in dependency order (`core`, `sensors`, `io`, `library`, the opt-in packs, `three`, `tools`).
