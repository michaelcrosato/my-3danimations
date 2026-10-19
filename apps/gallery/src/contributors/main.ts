// The contributor page (PLAN.md §5.9, WP-8.2b): how a contributor's human gets and revokes the key their agent submits
// with. Once O8's project is linked, the build is given its URL and publishable key (VITE_M3A_INTAKE_URL and
// VITE_M3A_INTAKE_KEY, public by design as Supabase's anon key is) and the page signs in with GitHub through Supabase
// Auth, lists the signed-in contributor's keys (row-level security shows only theirs), adds the SHA-256 of a key their
// agent made (the key itself never leaves the agent's environment) and revokes one for good. Until then it says the
// hosted store isn't linked and how agents submit to the local store. No secret is ever in the page: a secret key given
// to the build is refused unused, and the session's token is kept in memory alone, taken out of the link at once.
import { VERSION } from "@m3a/core";

const env = import.meta.env as Record<string, string | undefined>, URL0 = (env.VITE_M3A_INTAKE_URL ?? "").replace(/\/+$/, ""), KEY = env.VITE_M3A_INTAKE_KEY ?? "";
const $ = (id: string) => document.getElementById(id)!;
const el = (tag: string, attrs: Record<string, string> = {}, ...kids: (Node | string)[]) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};

/** Whether a key is a secret one (Supabase's sb_secret_ keys, or a legacy JWT whose role is service_role). */
function secret(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  try {
    return (JSON.parse(atob(key.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string }).role === "service_role";
  } catch {
    return false;
  }
}

const refused = KEY !== "" && secret(KEY), linked = URL0 !== "" && KEY !== "" && !refused;
const back = new URLSearchParams(location.hash.slice(1)), token = linked ? back.get("access_token") : null;
if (location.hash) history.replaceState(null, "", location.pathname + location.search);
let user: { id: string; login: string } | null = null, said = back.get("error_description") ?? "";

/** A call to the hosted project as the signed-in contributor; an Error with the status and what it said otherwise. */
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${URL0}${path}`, { ...init, headers: { apikey: KEY, authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** The signed-in contributor's keys, newest first: what row-level security lets them read. */
const keys = () => api<{ hash: string; label: string; created_at: string; revoked_at: string | null }[]>("/rest/v1/contributor_keys?select=hash,label,created_at,revoked_at&order=created_at.desc");

/** Draws the signed-in part: who, the keys (each live one revocable), the form that adds a key's SHA-256, sign out. */
async function drawSession(): Promise<void> {
  const box = $("session");
  if (!token) {
    box.replaceChildren(el("button", { type: "button", id: "sign-in" }, "Sign in with GitHub"), el("p", { class: "note" }, said));
    return;
  }
  try {
    if (!user) {
      const u = await api<{ id: string; user_metadata?: { user_name?: string } }>("/auth/v1/user");
      user = { id: u.id, login: u.user_metadata?.user_name ?? u.id };
    }
    const list = await keys(), rows = list.map((k) => el("li", { "data-key": k.hash }, el("code", {}, k.hash.slice(0, 12)), ` ${k.label || "(no label)"}, added ${k.created_at.slice(0, 10)}${k.revoked_at ? `, revoked ${k.revoked_at.slice(0, 10)}` : ""} `, ...(k.revoked_at ? [] : [el("button", { type: "button", "data-revoke": k.hash }, "Revoke")])));
    const form = el("form", { id: "add" }, el("input", { name: "hash", required: "", pattern: "[0-9a-f]{64}", placeholder: "the key's SHA-256 (64 hex digits)", "aria-label": "the key's SHA-256" }), el("input", { name: "label", maxlength: "80", placeholder: "a label (which agent, where)", "aria-label": "label" }), el("button", { type: "submit" }, "Add the key"));
    box.replaceChildren(el("p", {}, `Signed in as ${user.login}. `, el("button", { type: "button", id: "sign-out" }, "Sign out")), el("h2", {}, `Your keys (${list.length})`), el("ul", { class: "keys" }, ...rows), form, el("p", { class: "note", role: "status" }, said));
  } catch (err) {
    box.replaceChildren(el("p", { class: "fail" }, `the hosted store refused: ${(err as Error).message}; sign in again`), el("button", { type: "button", id: "sign-in" }, "Sign in with GitHub"));
  }
}

/** The page's text for the state it is in: linked or not, and what a contributor does. */
function drawText(): void {
  const steps = [
    "Sign in here with GitHub (Supabase Auth): your GitHub identity is the accountable one on every submission your agent sends.",
    "Your agent makes a key where it runs and keeps it as an environment secret, never in a file: KEY=$(openssl rand -hex 32). It gives you only the key's SHA-256: printf %s \"$KEY\" | sha256sum.",
    "Add that SHA-256 here with a label. The store keeps the hash alone; the key never leaves the agent's environment.",
    "The agent submits with the key (the submit function takes it in x-m3a-key): at most 20 a day, 256 KiB each.",
    "Revoke a key here when it leaks or its agent retires: from then on it is refused, for good. Add a new one.",
  ];
  $("state").replaceChildren(
    linked
      ? el("p", {}, "The hosted intake store is linked: sign in to get or revoke your agent's key.")
      : el("p", { class: "warn" }, refused ? "This build was given a secret key: it is not used. Build with the project's publishable (anon) key." : "The hosted intake store isn't linked yet (O8): there are no keys to get here. Until the owner links the project, agents submit to the local store."),
    el("h2", {}, linked ? "Getting and revoking a key" : "Once it is linked"),
    el("ol", {}, ...steps.map((t) => el("li", {}, t))),
    el("h2", {}, "Submitting locally (until then, and in tests and CI)"),
    el("p", {}, "The local store is files under .cache/intake/ in the repository's checkout, one s-<16 hex>.json record a submission, sent as a contributor named by its human's GitHub login. m3a review lists what awaits review; the owner decides on the review page or with m3a review adopt|archive|reject <id@hash>."),
    el("pre", {}, 'import { intake } from "@m3a/tools";\nconst store = intake.localStore({ files, role: "contributor", id: "<your GitHub login>", today: () => "<YYYY-MM-DD>" });\nawait store.submit({ kind: "clip", text: "<the clip\'s JSON>", improves: "SET/Clip" });\n// files: the store\'s records under .cache/intake/; m3a library submit (WP-9.1) will send one in one command'),
  );
}

$("session").addEventListener("click", (e) => {
  const t = e.target as HTMLElement, hash = t.getAttribute("data-revoke");
  if (t.id === "sign-in") location.assign(`${URL0}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(location.origin + location.pathname)}`);
  else if (t.id === "sign-out") void api("/auth/v1/logout", { method: "POST" }).catch(() => null).then(() => location.reload());
  else if (hash) {
    void api(`/rest/v1/contributor_keys?hash=eq.${hash}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ revoked_at: new Date().toISOString() }) })
      .then(() => (said = `revoked ${hash.slice(0, 12)}: it is refused from now on`), (err: Error) => (said = `not revoked: ${err.message}`))
      .then(drawSession);
  }
});
$("session").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target as HTMLFormElement), hash = String(f.get("hash")).trim().toLowerCase(), label = String(f.get("label") ?? "").trim();
  void api("/rest/v1/contributor_keys", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ hash, uid: user!.id, label }) })
    .then(() => (said = `added ${hash.slice(0, 12)}: your agent submits with its key now`), (err: Error) => (said = `not added: ${err.message}`))
    .then(drawSession);
});

$("stamp").textContent = `m3a ${VERSION} · ${__COMMIT__}`;
drawText();
if (linked) void drawSession();
(window as unknown as { __m3a: unknown }).__m3a = { ready: true, page: "contributors", version: VERSION, linked, signedIn: () => user?.login ?? null };
