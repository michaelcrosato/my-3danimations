// The modules vite.config.ts's plugin makes: the library's index and each set's clip files, as text.
declare module "virtual:m3a-library" {
  /** Each set's _set.json and catalog.tsv as text, and its file names. */
  export const SETS: Record<string, { manifest: string; catalog: string; files: string[] }>;
  /** library/sets.lock.json as text. */
  export const LOCK: string;
  /** Each set's clip files (name to text), loaded on demand. */
  export const LOADERS: Record<string, () => Promise<Record<string, string>>>;
  /** Each fetched rig's URL by id, loaded on demand. */
  export const RIGS: Record<string, () => Promise<string>>;
}
/** The commit the build was made from (vite.config.ts). */
declare const __COMMIT__: string;
/** The review queue's JSON text the build bundled (M3A_REVIEW_QUEUE), or null. */
declare const __REVIEW_QUEUE__: string | null;
