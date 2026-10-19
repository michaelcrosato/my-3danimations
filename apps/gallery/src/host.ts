// The registry as the gallery runs it (PLAN.md WP-8.1, DOCTRINE.md principle 2): the m3a tools over a browser host.
// Files read are the example documents of spec/ and what the tools wrote this session (kept in memory: a compiled
// recipe's clip, a simulation's trace); characters are `characters/<id>.glb` (a generated one built in code, a fetched
// rig fetched); the library is every tier's; images are kept for the page to draw. Before each call the sets its
// arguments name (and the documents they name name) are loaded, so a console call works as the page's own do.
import type { Image } from "@m3a/sensors";
import { character, variant } from "@m3a/three/test-characters";
import { registry, TOOLS } from "@m3a/tools";
import { RIGS } from "virtual:m3a-library";
import { libraryAt, loadSets, setsIn, source, SPEC, warnings } from "./library.ts";

/** The browser host, with what the tools wrote and drew this session. */
export interface GalleryHost extends registry.Host {
  /** Files the tools wrote, by path. */
  files: Map<string, string>;
  /** Images the tools attached, by name: the latest MAX_IMAGES kept. */
  images: Map<string, Image>;
  /** Loads the sets a call's arguments name, and those the documents they name name. */
  prepare(args: unknown): Promise<void>;
}

/** The most images the host keeps (a contact sheet's pixels are about 1 MB). */
export const MAX_IMAGES = 24;

/** A character's file path for the tools ("characters/gen-1.glb"). */
export const characterPath = (id: string): string => `characters/${id}.glb`;

/** The bytes of a character by id: gen-<seed> built in code, else a fetched rig; null for neither. */
export async function characterBytes(id: string): Promise<Uint8Array | null> {
  const gen = /^gen-(-?\d+)$/.exec(id);
  if (gen) return character(variant(Number(gen[1]))).glb;
  const url = RIGS[id] && (await RIGS[id]());
  return url ? new Uint8Array(await (await fetch(url)).arrayBuffer()) : null;
}

/** The gallery's host. */
export function galleryHost(): GalleryHost {
  const files = new Map<string, string>(), images = new Map<string, Image>();
  const text = (path: string) => files.get(path) ?? SPEC[path] ?? null;
  const missing = (path: string) => new registry.ToolError("E_PATH", `the gallery has no file ${JSON.stringify(path)}: it reads spec/recipes, spec/graphs, spec/sims and what the tools wrote this session`, true);
  const host: GalleryHost = {
    files,
    images,
    read: async (path) => text(path) ?? Promise.reject(missing(path)),
    tryRead: async (path) => text(path),
    async bytes(path) {
      const id = /^characters\/(.+)\.glb$/.exec(path)?.[1], b = id ? await characterBytes(id) : null;
      if (!b) throw missing(path);
      return b;
    },
    write(path, data) {
      files.set(path, typeof data === "string" ? data : new TextDecoder().decode(data));
      return path;
    },
    remove: (path) => void files.delete(path),
    library(tiers) {
      const list: string[] = [];
      warnings.to = list;
      const library = libraryAt(tiers);
      return { library, source, licenseText: () => null, tiers: library.tiers, warnings: list };
    },
    image(_tool, name, img) {
      images.delete(name);
      images.set(name, img);
      if (images.size > MAX_IMAGES) images.delete(images.keys().next().value!);
      return { path: null, png: null };
    },
    async prepare(args) {
      const docs = new Set<unknown>();
      const look = (v: unknown, depth: number): void => {
        if (typeof v === "string" && depth < 2) {
          const doc = text(v) ?? (/^\s*[[{]/.test(v) ? v : null);
          if (doc) {
            try {
              const data: unknown = JSON.parse(doc);
              docs.add(data);
              look(data, depth + 1);
            } catch {
              // not JSON: the tool says so
            }
          }
        } else if (v && typeof v === "object") for (const x of Object.values(v)) look(x, depth);
      };
      look(args, 0);
      await loadSets(setsIn([args, ...docs]));
    },
  };
  return host;
}

/** The m3a tools as one registry whose every call loads what it names first (the console handle's too). */
export class GalleryRegistry extends registry.Registry {
  readonly host: GalleryHost;
  constructor(host: GalleryHost) {
    super(TOOLS);
    this.host = host;
  }
  /** Calls a tool on the gallery's host, its sets loaded first. */
  override async call(name: string, args: unknown = {}, opts: registry.CallOptions = {}): Promise<registry.Reply> {
    await this.host.prepare(args);
    return super.call(name, args, { ...opts, host: opts.host ?? this.host });
  }
}
