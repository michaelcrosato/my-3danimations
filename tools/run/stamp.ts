// The build stamp's commit (WP-8.3), one helper for every page's Vite config and the preview site: Vercel's
// VERCEL_GIT_COMMIT_SHA, else GitHub Actions' GITHUB_SHA, else git's HEAD, seven characters; "unknown" without any.
import { execSync } from "node:child_process";

/** The commit a page's build stamp names, read in the checkout at `root`. */
export function buildCommit(root: string): string {
  const env = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (env) return env.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
  } catch {
    return "unknown";
  }
}
