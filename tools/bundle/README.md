# tools/bundle: the packaging (WP-7.4)

`npm run pack [-- --check] [--example <file>] [--publishable]` builds into `.cache/pack/` (git-ignored; nothing built
is committed, and nothing here publishes: `publish.yml` does, [below](#publishing-o2-answered-2026-10-22)):

- **The packages** (`build.ts`): each `@m3a/*` package as ES modules with its declarations. Node's own type stripping
  turns `src/x.ts` into `dist/x.js` line for line, relative imports point at `.js`, and `tsc -b` writes the `.d.ts`.
  Each is staged in `stage/<name>/` with the package.json it ships with: its exports and `"types"` point at `dist/`,
  the `m3a` bin is `dist/node.js` (shebang kept), and `"private": true` stays unless `--publishable` drops it.
  `@m3a/library`'s license names its clips' beside the code's (`MIT AND CC0-1.0`). `@m3a/three`'s declarations import
  three's types, so `@types/three` (the version they were written against) is an optional peer: a strict TypeScript
  consumer installs it.
  `@m3a/tools` ships the manual and m3a's agentskills.io skill beside `dist/` (`MANUAL.md`, `skills/m3a/SKILL.md`, the
  repository's, D119), so an installed package gives an agent both. The workspace's own package.json files name source
  files alone (exports, `"types"`, the bin `src/node.ts`), which Node 24 runs directly, so a fresh `npm ci` links
  `npx m3a` to the source (`bundle.test.ts` fails on a path the workspace lacks). Then `npm pack` writes
  `m3a-<name>-<version>.tgz`.
- **The version and changelog rule**: one version for every package (`node tools/version.ts`), the opt-in packs taking
  the library's. Each tarball carries the repository's `CHANGELOG.md`, whose section for that version
  `node tools/version.ts --check` requires.
- **The library's packs** (D10): `@m3a/library` holds the CC0 sets alone. The cc-by and cmu sets ship as
  `@m3a/library-cc-by` and `@m3a/library-cmu`, each with its own lock, license texts and a README with the credits a
  game owes. Installed beside the library, `openLibrary({ tiers: ["cc0", "cc-by"] })` from `@m3a/library/node` (and
  the m3a tools, through game.json's `"tiers"`) finds them. A tier opted in to whose pack isn't installed is warned of
  with the `npm install` that brings it, in every tool reply too.
- **The single file** (`single.ts`, `runtime.ts`): `single/m3a.js`, one self-contained ES module for agents that can't
  install packages. It holds `@m3a/core`, `sensors`, `io`, `library` and `tools`' API, every name once, plus the CC0
  clips that `manifest.json` lists (a game manifest: `tiers: ["cc0"]` and its clips; every clip the manual's complete
  example names among them, which `bundle.test.ts` checks). `openLibrary()` opens those
  clips, verified with core's SHA-256, and `tools.call(name, args, { host })` runs a tool on them. Its opening comment
  carries the code's MIT license, the credits block and the license text of every tier it includes, which are also
  exported as `CREDITS` and `LICENSES`. three.js and `@m3a/three`'s API are left out (only its three-free test-character generator is inside, for
  `gen-<seed>`). An agent that can't install packages
  can't install three either, and the API it can use is headless (find, make, check, export, the tools). A bundled
  three would also triple the file and sit beside a game's own copy, whose objects fail the other copy's `instanceof`.
  m3a.js has no Node built-in either (it runs in a browser), so `@m3a/sensors/node`'s `writePng` isn't in it.

`--check` also proves the build, failing on any of these:
- a set in the wrong pack;
- the bin;
- the tools' tarball without `skills/m3a/SKILL.md`, or with one other than the repository's;
- the version rule (`node tools/version.ts --check`), a pack at another version, or one without `CHANGELOG.md`;
- a staged package.json without `"private": true` (with `--publishable`: one that keeps it, or lacks provenance);
- m3a.js's credits or license texts;
- `npm run license -- check tools/bundle/manifest.json`;
- the sensors on every clip m3a.js carries: each passes, or carries its WP-5.8 baseline, and reads the same there as
  in the packages;
- a scratch project in a temp directory that installs the tarballs and runs the manual's complete example, `npx m3a
  help`, `npx m3a version`, `m3a mcp`'s `tools/list` and `openLibrary` over the opt-in packs;
- the complete example's headless form, run there and on m3a.js, failing on either, printing otherwise on the two, or
  playing otherwise than the example did on `@m3a/three`;
- the complete example's m3a calls on m3a.js, through its own `runCli`, each exiting 0 as on the packages.

A step that fails says why and the rest still run, so the report always prints. `m3a mcp` (`mcp.ts`) fails its step
when npm linked no bin (a `"bin"` naming a file the tarball lacks), the server can't start, exits or writes what isn't
JSON-RPC first, or doesn't answer `tools/list` within 30 s; it is stopped either way, so the gate never hangs on it.

## The complete example's marker

The complete example is the section of `packages/tools/MANUAL.md` whose heading starts with `## A complete example`,
read as `packages/tools/test/manual.test.ts` reads it. No info string needs adding: the heading is the marker.
- Its json blocks named as files (```` ```json knight.json ````) are written into the scratch project, with
  `character.glb`, a generated test character (`@m3a/three/test-characters`), which the manual says a game has.
- Its ts blocks run in order as one program, `example.ts`: their imports merged at the top, their names shared, and
  `@m3a/three`'s player recorded (below). A block marked `norun` is left out.
- Its sh lines are m3a calls (`m3a ...` or `npx m3a ...`), run after it in order through the installed bin. Each must
  exit 0; a line that isn't an m3a call fails the check.

A manual without that section, or with no ts block in it, fails the check, naming the heading. `--example <file>`
runs another one: a manual (`.md`), its section read the same way, or a program (`.ts`) run alone.

## The headless form: m3a.js runs the same example

The complete example binds a three.js character (`@m3a/three`'s `bind` and `attach`, `@m3a/three/test-characters`'
`loadGlb`) and writes a PNG through Node (`@m3a/sensors/node`'s `writePng`). m3a.js leaves those out by design, so
m3a.js runs the example's headless form (`example.ts`, `headlessForm`): the same program, the same files and clips,
with those four names taken from `headless.ts` and what they saw printed at the end. On the installed packages and on
m3a.js it must print the same, bit for bit, and it must play as the example does on `@m3a/three` itself:
- `loadGlb` reads the character's skeleton from its glTF nodes (`@m3a/io`'s `parseGlb`, `skeletonOfGltf`);
- `bind` recognizes and binds it with core's solver as `@m3a/three`'s bind does, each foot's last bone ending on the
  sole (D49, `meshEnds`);
- `attach` steps and poses the Animator as `@m3a/three`'s player does, and gives the root's travel (metres, along the
  way the character faces);
- `writePng` keeps the image's size and a fingerprint of its pixels instead of a file (a PNG needs `node:zlib`).

Each Animator's hash, every pose's fingerprint, the events, the travel and the images are printed. On the packages
the example itself runs in its recorded form (`recordedForm`): its `@m3a/three` imports come from `recorded.ts`, which
gives every name `@m3a/three` does and records three's own player as `headless.ts` records its stand-in (`record`).
The headless form's record must equal it, bit for bit (`sameRun`): the updates, the events, every pose's joints, the
travel and each Animator's hash. The bones' local rotations are left out of that comparison, as three's loader names
the bones its own way (`mixamorig:Hips` is `mixamorigHips`) and its bind reads their rest orientations through three's
matrices, so they may differ in the last bit. The images are left out too: the real `writePng` writes its file.
`bundle.test.ts` holds the two equal on the test character: the same Animator hash and travel at every step, the
same record at the end.

On m3a.js the example's `@m3a/*` imports are taken from `./m3a.js`. Anything else (`three`, a name of `@m3a/three`
that `headless.ts` doesn't stand in for, another Node entry) is refused before it runs, and named. The example's m3a
calls run on m3a.js too (`callsOnSingle`): each sh line, read as sh reads it (`argvOf`; what only a shell makes
something of, such as a pipe, a redirection or `$`, is refused and named), goes through m3a.js's own `runCli`. m3a.js
reads no files (a tool given a path answers `E_HOST`: pass the text instead), so its host is given the example's
files as text and keeps what each call writes for the calls after it (`recipe.compile`'s clip, which `graph.sim`
reads). Each call must exit 0, as it does on the packages.

## Publishing (O2, answered 2026-10-22)

The owner answered O2 on 2026-10-22 (D130): the packages are published to npm under the working names, the `@m3a`
scope, from CI alone, with npm provenance (Sigstore) from the first version on. `npm run pack` publishes nothing;
`.github/workflows/publish.yml` publishes a release tag's packages, run by hand from that tag:

- **The go-ahead.** Each of its three jobs first stops the run, before anything is checked out, unless the repository
  variable `M3A_O2_PUBLISH` is `yes`, the repository's owner started both the run and this attempt, the tag reads
  `vX.Y.Z` and the run was started from that tag. npm's provenance names the run's ref and commit, so a run started
  from `main` would name `main`'s head for good, not the tag's commit. Every job checks it, so "Re-run failed jobs",
  which re-runs the failed job and not the go-ahead before it, is checked too: a re-run by anyone else stops.
- **The build.** The build job has `permissions: { contents: read }` and no token. It checks the tag out keeping no
  credentials, sets up Node 24.21.0 with no cache, holds the tag to `main`, to the version in its package.json and to
  the run's commit, runs `npm ci --ignore-scripts`, then `npm run pack -- --check --publishable`, and hands the eight
  tarballs to the publish job as an artifact, kept a week. Nothing is fetched first: the check reads no rig and no
  pinned source (its characters are generated).
- **`--publishable`** changes the staged copy of each package.json before `npm pack`, never the workspace's own: it
  drops `"private"` and adds `"publishConfig": { "access": "public", "provenance": true }` and `"repository": {
  "type": "git", "url": "git+https://github.com/michaelcrosato/my-3danimations.git", "directory": "packages/<name>" }`.
  The opt-in packs get `"directory": "library"`, where their sets live. Provenance is checked against that repository.
  `--check` then fails on a staged package.json that keeps `"private"` or lacks either field.
- **The publish.** The publish job has `permissions: { contents: read, id-token: write }` (its OIDC token signs each
  package's provenance) and deploys to the environment `npm`, which holds the token: only a `v*` tag deploys there,
  and each run of the job waits for the owner's approval. It checks nothing out, so none of the repository's code or
  dev dependencies runs beside the tokens. It downloads the tarballs and reads each one's own package.json: every pack
  at the tag's version, publishable, naming this repository, each after every `@m3a` package it needs, none missing
  and none extra. Then `npm publish --provenance --access public <tarball>` for each pack in dependency order: `core`,
  `sensors`, `io`, `library`, `library-cc-by`, `library-cmu`, `three`, `tools` (the job's `PACKS`;
  `tools/release/publish.test.ts` derives the order from `build.ts`). npm runs no lifecycle script when it publishes a
  tarball. The token, the environment's secret `NPM_TOKEN`, reaches this last step alone, as `NODE_AUTH_TOKEN`. A
  version already on the registry (`npm view <name>@<version>`) is skipped and said, so a re-run after a partial
  failure publishes the rest and never fails on a published version, which can't be replaced. A failed publish stops
  the packs after it, which need it, and so does a registry that answers `npm view` with neither the version nor
  E404. Either error names the codes npm gives a token it refuses.

`tools/release/publish.test.ts` reads the workflow as YAML and holds each of these, with no key that lets a check be
skipped or ignored (`if`, `continue-on-error`, `shell`, `defaults`) and no expression but the ones it names. It runs
the go-ahead, the tag check, the tarball check and the publish loop on stubs (a stub `npm` for the registry).

The owner's steps, in order, each signed in as `michaelcrosato`, the repository's owner. A run another account starts
or re-runs (`michaelcrosatoDM`, which opens this session's pull requests, among them) stops at the go-ahead.
1. Create the npm organization `m3a` on npmjs.com (the free plan: public packages). Its name is the `@m3a` scope.
2. Create an npm granular access token: under Packages and scopes, "Read and write (publish and stage)" on the scope
   `@m3a` alone, not "(stage only)", whose token `npm publish` refuses with E_STAGE_REQUIRED; nothing under
   Organizations. Tick "Bypass two-factor authentication": CI can't give a one-time password. Set an expiration
   of 90 days at most, npm's limit for a write token, and renew the token before a release past that date: a stale
   token fails the publish step with E401, E403 or E404.
3. In this repository, Settings → Environments → New environment, named `npm`. Required reviewers: `michaelcrosato`,
   with "Prevent self-review" off (you approve your own run). "Allow administrators to bypass configured protection
   rules" off. Deployment branches and tags: "Selected branches and tags", one rule of type Tag, `v*`. Add the token
   there as the environment secret `NPM_TOKEN`, never as a repository secret, which a workflow on any branch could
   read.
4. Set the repository variable `M3A_O2_PUBLISH` to `yes` (Settings → Secrets and variables → Actions → Variables).
5. Protect the release tags, since a run uses the tag's own `publish.yml` and anyone with write access could otherwise
   make or move one: Settings → Rules → Rulesets → New ruleset → New tag ruleset, named `release tags`. Enforcement:
   Active. Bypass list: Repository admin, Always allow. Target tags: Include by pattern, `v*`. Rules: Restrict
   creations, Restrict updates, Restrict deletions. After it, only you make or move a tag the environment `npm`
   deploys from.
6. Tag `main` at a version not yet published: the commit on `main` whose package.json files are at X.Y.Z (the pull
   request that ran `node tools/version.ts X.Y.Z`, merged). It must hold this workflow, since a run uses the tag's.
   `git tag vX.Y.Z <commit>`, then `git push origin vX.Y.Z`, as yourself. A tag made before the ruleset is checked
   first on the repository's Tags page: it must be the commit you merged.
7. Actions → publish → Run workflow. Under "Use workflow from", pick Tags → `vX.Y.Z`; give `vX.Y.Z` as the tag. Or
   `gh workflow run publish.yml --ref vX.Y.Z -f tag=vX.Y.Z`.
8. When the build job has passed, the run waits for you: Review deployments → `npm` → Approve and deploy. Approve
   only a run you started. Each package's npm page then shows its provenance: built and signed on GitHub Actions,
   from this repository and the tag's commit.

npm's trusted publishing (OIDC, no long-lived token) is configured per package, so it needs each package to exist
first; and npm stops taking `npm publish` with a granular token in January 2027. So move to it right after the first
release: on each package's settings on npmjs.com, a trusted publisher (this repository, `publish.yml`, the environment
`npm`) with `npm publish` ticked under Allowed actions (a publisher set up since 2026-09-03 allows only `npm stage
publish` otherwise), and a publish through it within two days of setting it up, or it lapses. This workflow then drops
the token's check, and the token is deleted.
