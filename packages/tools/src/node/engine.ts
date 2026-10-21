// The m3a bin's Node check (WP-F.1, D121). src/node.ts runs `main` under `import.meta.main`, which Node 22.18 and
// 24.2 brought; an older Node leaves it undefined, and the bin did nothing at all: no output, exit 0, and an MCP client
// saw only a closed connection. `engineCheck` says what the bin does instead: run; run with a warning on stderr (a Node
// below package.json's engines that has `import.meta.main`, as 22.18 to 24.1 do); or refuse with the reason and exit 1
// (a Node without it, when this module's file is the process's entry). Every message goes to stderr: under `m3a mcp`
// stdout carries only JSON-RPC.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The Node the bin is built and tested for, as package.json's engines states it (">=24.2"; a test holds them equal). */
export const ENGINE = { major: 24, minor: 2 } as const;

/** What the bin does on this Node: `run` it or not, and a `message` for stderr with the `exitCode` to set when it
 *  refuses. */
export type EngineCheck = { run: boolean; message?: string; exitCode?: number };

/** The bin's verdict for Node `version` (process.versions.node, "22.22.0"), the entry's `import.meta.main` (undefined
 *  on a Node without it) and whether the module is the process's entry by its real path (`isEntry`, read only when
 *  `main` is undefined). An imported module runs nothing and says nothing. */
export function engineCheck(version: string, main: boolean | undefined, entry: boolean): EngineCheck {
  const [major = 0, minor = 0] = version.split(".").map(Number);
  const older = major < ENGINE.major || (major === ENGINE.major && minor < ENGINE.minor);
  const want = `Node ${ENGINE.major}.${ENGINE.minor} or later`;
  if (main === undefined) {
    if (!entry) return { run: false };
    return {
      run: false,
      exitCode: 1,
      message: `m3a: Node ${version} can't run m3a: it needs ${want} (package.json engines), whose import.meta.main starts the bin; nothing ran\nnext: put ${want} first on PATH, then run the command again\n`,
    };
  }
  if (!main) return { run: false };
  if (!older) return { run: true };
  return { run: true, message: `m3a: warning: Node ${version} is older than the ${want} m3a is built and tested for (package.json engines)\n` };
}

/** Whether the file at `url` (an import.meta.url) is the process's entry, `argv1` (process.argv[1]), both by real path:
 *  the bin is often a link (node_modules/.bin/m3a). False when either can't be resolved. */
export function isEntry(url: string, argv1: string | undefined): boolean {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(url));
  } catch {
    return false;
  }
}
