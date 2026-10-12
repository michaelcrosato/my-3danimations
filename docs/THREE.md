# THREE: the pinned three.js

`@m3a/three` pins **three.js r182** (`three@0.182.0`), a peer dependency the game brings, in
`packages/three/package.json` (installed here as a dev dependency, with its types, `@types/three@0.182.0`).
`tools/doctrine/banned-three.json` records the pin and the banned APIs, and `npm run doctrine` enforces both (D45).
Moving the pin is a commit of its own that reruns the cold-write check below and rewrites this page.

## Why r182

**The cold-write check (WP-4.1, 2026-10-11).** Two fresh agents, given no docs and writing from memory, each wrote the
scene an agent writes first: load a skinned glTF (the Khronos Fox), play a clip, crossfade to others, through
`WebGPURenderer`. One wrote it against r182, the other against r186 (the latest, resolved as 0.186.1). Both were run
unedited in headless Chromium 141 (Playwright 1.56.1's build), once with `forceWebGL` and once on WebGPU (SwiftShader's
Vulkan):

| | WebGL 2 backend | WebGPU backend |
|---|---|---|
| r182 | starts, plays, crossfades, draws | starts, plays, crossfades, draws |
| r186 | starts, plays, crossfades, draws | fails at `renderer.init()`: `createView` rejects the texture view's `swizzle` |

Both agents wrote correct code for their release (`three/webgpu`, `await renderer.init()`, `loadAsync`,
`crossFadeTo`, `Timer`). r186 passes a texture-view `swizzle` that Chromium 141 does not know, so on any browser of
that age its WebGPU backend never starts. r182 is the owner's prior pin (my-3d2dge's "Why these versions": r180 and
later have the mature `WebGPURenderer`, and the models know r182 well); my-3dge found the same r186 failure.

**The test.** `tests/e2e/three.e2e.ts` (in `npm run e2e`) repeats the check on a character built in code: a skinned
arm written to glTF by `GLTFExporter`, read back by `GLTFLoader`, a clip playing and a crossfade to another. On the
forced WebGL 2 backend the frame must be drawn, not blank, move between frames, and print no warning; on the WebGPU
backend (where the browser has an adapter) the pinned release must start and draw too. CI's `three-next` job runs the
same test on r186 (`M3A_THREE_DIR`): its WebGL 2 result is checked and its WebGPU result reported, so the day a
browser or a release fixes it shows up there.

## How to use it

- **Import from `three/webgpu`** (and TSL from `three/tsl`, loaders and exporters from `three/addons/`). Demos use
  `WebGPURenderer`; where WebGPU has no adapter it falls back to WebGL 2 by itself.
- **Captures force WebGL 2:** `new WebGPURenderer({ forceWebGL: true })`, read back from a render target with
  `readRenderTargetPixelsAsync` (headless WebGPU canvases screenshot blank).
- **`await renderer.init()` once**, then the synchronous `render()`. r181 deprecated `renderAsync()` and its family;
  they warn.
- **Serve from a secure origin** (`https:` or `http://localhost`). WebGPU's interfaces exist only there, and r182's
  `three.webgpu.js` reads `GPUShaderStage` as it loads, so on any other origin the module fails to load at all
  (`Cannot read properties of undefined (reading 'VERTEX')`), WebGL 2 included. A Playwright test routes
  `http://localhost:<port>`, never a made-up host.
- **Names r182 does not have** (agents who know r183 and later reach for them): `RenderPipeline` (r182:
  `PostProcessing`), `TextureSource` (r182: `Source`), `Object3D.dispose()` (dispose geometries, materials and
  textures yourself). my-3dge's `docs/THREE-DELTA.md` at its pin lists the rest, both ways.

## The banned APIs

WebGL-era APIs that agents write from habit and that `WebGPURenderer` cannot run. Each is banned in every source and
Markdown file outside `docs/`, `PLAN.md` and the doctrine checks; the finding names the replacement.

| Banned | Use instead |
|---|---|
| `ShaderMaterial`, `RawShaderMaterial` | a node material (`MeshStandardNodeMaterial` and kin) with TSL nodes |
| `onBeforeCompile` | the node material's slots (`colorNode`, `positionNode`, ...) in TSL |
| `EffectComposer`, `ShaderPass`, imports from `postprocessing/` | `PostProcessing` from `three/webgpu` with TSL passes (`pass()`, `three/addons/tsl/display/*`) |
| `WebGLRenderer` | `WebGPURenderer` (`forceWebGL: true` for WebGL 2) |
| raw GLSL (`gl_Position`, `gl_FragColor`) | TSL |
| `renderAsync()` | `await renderer.init()`, then `render()` |
| `RenderPipeline` | `PostProcessing` (r183's name for it) |
