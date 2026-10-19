// Which intake keys may go into a page (WP-8.2b): Supabase's publishable keys may, a secret one never. Read by the
// contributor page (it refuses a secret key unused) and by the gallery's Vite config, which fails the build given one,
// since Vite has inlined the key into the bundle before the page could refuse it.

/** Whether a key is a secret one: Supabase's sb_secret_ keys, or a legacy JWT whose role is service_role. */
export function secretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  try {
    return (JSON.parse(atob(key.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string }).role === "service_role";
  } catch {
    return false;
  }
}
