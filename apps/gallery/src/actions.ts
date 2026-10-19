// Nothing can be done only in the gallery (PLAN.md WP-8.1, DOCTRINE.md principle 2): every action the page offers, and
// the m3a tool (the same name in the API, the CLI, MCP and the console handle) or the command that does the same
// without a display. The e2e test checks that every tool named here is in the registry, on the page and in Node.

/** One action: what the gallery does, the registry tool that does the same (null where a command does), and the call
 *  as an agent writes it (an m3a command, or the file or npm script). */
export interface Action {
  action: string;
  tool: string | null;
  call: string;
}

/** Every action the gallery offers, in the order the page shows them. */
export const ACTIONS: readonly Action[] = [
  { action: "list the sets, each with its tier and its clips", tool: "search", call: 'm3a search "set:<SET>" --limit 40; library/sets/<SET>/catalog.tsv is the whole catalog' },
  { action: "search the library for a game moment, every tier", tool: "search", call: 'm3a search "<words and filters>" (game.json\'s "tiers" opts in to cc-by, cmu)' },
  { action: "open a clip: what it is, where it came from, its keys", tool: "show", call: "m3a show <SET/Name> [--from <seconds>]" },
  { action: "play a clip on a character in 3D", tool: "retarget.apply", call: "m3a retarget.apply <character file> --clips '[\"<SET/Name>\"]'; m3a export <SET/Name> --character <file> --format glb writes it played" },
  { action: "choose the character (gen-<seed> or a fetched rig)", tool: "retarget.inspect", call: "m3a retarget.inspect <character file>; gen-<seed> is @m3a/three/test-characters character(variant(seed)).glb, rigs npm run fixtures -- fetch" },
  { action: "see it from the front, side, back, top or three-quarter view", tool: "sheet", call: "m3a sheet <SET/Name> --view <front|side|back|top|three-quarter>" },
  { action: "orbit the camera round it", tool: "sheet", call: "m3a sheet <SET/Name> --view <view> for each named view (raster.turntable draws any azimuth)" },
  { action: "slow motion (0.1x to 2x) round a moment", tool: "film", call: "m3a film <SET/Name> --around <seconds> --frames 16" },
  { action: "step frame by frame, or scrub to a time", tool: "show", call: "m3a show <SET/Name> --from <seconds> (the keys there); m3a film <SET/Name> --around <seconds>" },
  { action: "read its timeline", tool: "describe", call: "m3a describe <SET/Name> --detail" },
  { action: "read its metrics: verdict and findings with their times", tool: "metrics", call: "m3a metrics <SET/Name> --limit 50" },
  { action: "jump to a finding's time", tool: "film", call: "m3a film <SET/Name> --around <the finding's t0>" },
  { action: "draw its contact sheet", tool: "sheet", call: "m3a sheet <SET/Name> --frames 8 --view <view>" },
  { action: "open an example recipe, compiled and played", tool: "recipe.compile", call: "m3a recipe.compile spec/recipes/<Name>.json; m3a sheet check-output/recipe.compile/<Name>.clip.json" },
  { action: "open an example graph: its layers, states and clips", tool: "graph.validate", call: "m3a graph.validate spec/graphs/<Name>.json" },
  { action: "run a graph's scripted simulation, played in 3D", tool: "graph.sim", call: "m3a graph.sim spec/graphs/<Name>.json --script spec/sims/<Script>.json --character <file>" },
  { action: "play one of a graph's states' clips", tool: "show", call: "m3a show <the state's SET/Name>" },
  { action: "copy a deep link to what is on screen", tool: null, call: "the link is text: ?set= ?clip= ?recipe= ?graph= ?char= ?view= ?t= ?rate= ?panel= ?q= (apps/gallery/README.md)" },
  { action: "drive it all from a console", tool: null, call: "window.__m3a (state, open, play, pause, step, seek, hash) and window.__M3A_TOOLS__ (every tool)" },
  { action: "read the build stamp", tool: "version", call: "m3a version (the stamp's commit: git rev-parse --short HEAD)" },
];
