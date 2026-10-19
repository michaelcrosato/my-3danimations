// The intake store's contract suite (PLAN.md §5.9, WP-8.2a): one set of cases every IntakeStore backend must pass,
// over a store opened once per role (anonymous, two contributors, one whose name claims the owner's, the checker and
// the owner). It runs on the `local` backend here, on files under a scratch .cache/intake/ (atomic writes, the lock).
// On `supabase` it is a deferred proof (G9, once O8's project is linked): set M3A_INTAKE_SUPABASE to the project's
// JSON ({ url, apikey, service, owner, a, b, impostor }, each role a { token, key?, id? }) in Actions and it runs there,
// again on every run: its texts carry the run's nonce (GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT, else the clock), since a
// text sent again is the submission already there, decided or bounced by the run before. There `agent` submits with
// `a`'s contributor key alone, no token, as an agent does (§5.9).
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serialize, type Clip } from "@m3a/core";
import { afterAll, describe, expect, it } from "vitest";
import { contentHash, IntakeError, localStore, MAX_BYTES, motionHash, submissionId, supabaseStore, type IntakeStore } from "../src/intake/index.ts";
import { intakeFiles } from "../src/node/intake.ts";

/** One backend's stores, a role each, over one store; `a` and `b` are the contributors' identities. */
interface Stores {
  anon: IntakeStore;
  a: IntakeStore;
  b: IntakeStore;
  impostor: IntakeStore;
  /** What an agent holds: `a`'s contributor key and no token (on local, `a` itself). */
  agent: IntakeStore;
  checker: IntakeStore;
  owner: IntakeStore;
  ids: { a: string; b: string };
}

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** The local backend: every role's store over one fresh directory. */
function local(): Stores {
  const dir = mkdtempSync(join(tmpdir(), "m3a-intake-")), files = intakeFiles(dir), today = () => "2026-10-19";
  dirs.push(dir);
  const as = (role: "anon" | "contributor" | "checker" | "owner", id?: string) => localStore({ files, role, ...(id ? { id } : {}), today });
  return { anon: as("anon"), a: as("contributor", "alice"), b: as("contributor", "bob"), impostor: as("contributor", "owner"), agent: as("contributor", "alice"), checker: as("checker"), owner: as("owner"), ids: { a: "alice", b: "bob" } };
}

/** The hosted backend from M3A_INTAKE_SUPABASE, or null (the deferred proof). */
function hosted(): (() => Stores) | null {
  const env = process.env.M3A_INTAKE_SUPABASE;
  if (!env) return null;
  type R = { token?: string; key?: string; id?: string };
  const c = JSON.parse(env) as { url: string; apikey: string; service: string; owner: R; a: R; b: R; impostor: R };
  const as = (r: R = {}) => supabaseStore({ url: c.url, apikey: c.apikey, ...r });
  return () => ({ anon: as(), a: as(c.a), b: as(c.b), impostor: as(c.impostor), agent: as({ key: c.a.key }), checker: as({ token: c.service }), owner: as(c.owner), ids: { a: c.a.id!, b: c.b.id! } });
}

/** A library clip's text with its description `tag`ged, so each case sends new text of the same motion; on the hosted
 *  store with the run's nonce too, so each run sends new text. */
const WALK = JSON.parse(readFileSync(join(import.meta.dirname, "../../../library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json"), "utf8")) as Clip;
const NONCE = process.env.M3A_INTAKE_SUPABASE ? ` ${process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}.${process.env.GITHUB_RUN_ATTEMPT ?? 1}` : Date.now()}` : "";
const clipText = (tag: string): string => serialize({ ...WALK, desc: `walks (${tag}${NONCE})` });
const refusal = async (p: Promise<unknown>): Promise<string> => p.then(() => "resolved", (e: unknown) => (e instanceof IntakeError ? e.code : `not an IntakeError: ${String(e)}`));

/** The contract's cases on the stores `open` gives. */
function contract(name: string, open: () => Stores): void {
  describe(`the intake store's contract on ${name}`, () => {
    const s = open(), date = "2026-10-19";
    /** A submission of `a`'s, moved by the checker to awaiting review. */
    const queued = async (tag: string) => {
      const x = await s.a.submit({ kind: "clip", text: clipText(tag) });
      await s.checker.advance(x.id, "checking");
      return s.checker.advance(x.id, "awaiting review", { report: { gates: "pass" } });
    };

    it("starts a submission submitted, with its content and motion hashes and an id from its contributor and content; the same text again is the same one", async () => {
      const text = clipText("first"), x = await s.a.submit({ kind: "clip", text, improves: "QUATERNIUS_3D2DGE/Walk_Loop" });
      expect(x).toMatchObject({ state: "submitted", content: contentHash(text), motion: motionHash(JSON.parse(text) as Clip), improves: "QUATERNIUS_3D2DGE/Walk_Loop", contributor: s.ids.a, decision: null });
      expect(x.id).toBe(submissionId(s.ids.a, x.content));
      expect((await s.a.submit({ kind: "clip", text, improves: "QUATERNIUS_3D2DGE/Walk_Loop" })).id).toBe(x.id);
      expect((await s.owner.list()).filter((y) => y.id === x.id)).toHaveLength(1);
    });

    it("takes an agent's submission on its contributor key alone, as its contributor's", async () => {
      const x = await s.agent.submit({ kind: "clip", text: clipText("an agent's") });
      expect([x.state, x.contributor]).toEqual(["submitted", s.ids.a]);
      expect((await s.a.get(x.id))?.id).toBe(x.id);
    });

    it("gives anonymous nothing", async () => {
      const x = await s.a.submit({ kind: "clip", text: clipText("anon") });
      for (const p of [s.anon.get(x.id), s.anon.list(), s.anon.advance(x.id, "checking"), s.anon.decide(x.id, { as: "adopt", hash: x.content, note: "", date })]) expect(await refusal(p)).toBe("E_ROLE");
      expect(["E_ROLE", "E_KEY"]).toContain(await refusal(s.anon.submit({ kind: "clip", text: clipText("anon 2") })));
    });

    it("lets a contributor read only its own rows", async () => {
      const mine = await s.a.submit({ kind: "clip", text: clipText("a's") }), theirs = await s.b.submit({ kind: "clip", text: clipText("b's") });
      expect([await s.a.get(theirs.id), (await s.b.get(theirs.id))?.id, (await s.a.get(mine.id))?.id]).toEqual([null, theirs.id, mine.id]);
      expect((await s.a.list()).every((x) => x.contributor === s.ids.a)).toBe(true);
      expect((await s.b.list()).map((x) => x.id)).not.toContain(mine.id);
      expect((await s.a.list({ contributor: s.ids.b })).length).toBe(0);
    });

    it("refuses a submission over the size limit, and a malformed one", async () => {
      expect(await refusal(s.a.submit({ kind: "clip", text: `{"desc":"${"x".repeat(MAX_BYTES)}"}` }))).toBe("E_SIZE");
      expect(await refusal(s.a.submit({ kind: "clip", text: clipText("bad"), improves: "walk loop" }))).toBe("E_INPUT");
    });

    it("lets only the checker move states, up to awaiting review, a bounce with its reason", async () => {
      const x = await s.a.submit({ kind: "clip", text: clipText("moves") });
      for (const who of [s.a, s.owner, s.impostor]) expect(await refusal(who.advance(x.id, "checking"))).toBe("E_ROLE");
      expect(await refusal(s.checker.advance(x.id, "awaiting review"))).toBe("E_STATE"); // checked first
      expect((await s.checker.advance(x.id, "checking")).state).toBe("checking");
      expect(await refusal(s.checker.advance(x.id, "adopted"))).toBe("E_STATE");
      expect(await refusal(s.checker.advance(x.id, "bounced"))).toBe("E_INPUT"); // a bounce says why
      expect((await s.checker.advance(x.id, "bounced", { reason: "a foot slides 4 cm" })).state).toBe("bounced");
      expect(await s.a.get(x.id)).toMatchObject({ state: "bounced", reason: "a foot slides 4 cm" });
      expect(await refusal(s.checker.advance(x.id, "checking"))).toBe("E_STATE"); // a bounced one is sent again, as a new one
    });

    it("lets only the owner decide, on the hash the decision was made on, once", async () => {
      const x = await queued("decide"), d = { as: "adopt" as const, hash: x.content, note: "clean contacts", date };
      for (const who of [s.a, s.checker, s.impostor]) expect(await refusal(who.decide(x.id, d))).toBe("E_ROLE");
      expect(await refusal(s.owner.decide(x.id, { ...d, hash: contentHash("another text") }))).toBe("E_STALE");
      expect((await s.owner.get(x.id))!.state).toBe("awaiting review");
      const first = await s.owner.decide(x.id, d);
      expect([first.applied, first.submission.state, first.submission.decision]).toMatchObject([true, "adopted", { as: "adopt", hash: x.content, note: "clean contacts", date }]);
      expect((await s.owner.decide(x.id, d)).applied).toBe(false);
      expect(await refusal(s.owner.decide(x.id, { ...d, as: "reject" }))).toBe("E_STATE");
      expect(await s.a.get(x.id)).toMatchObject({ state: "adopted", decision: { as: "adopt", note: "clean contacts" } });
    });

    it("keeps an archived or rejected submission's motion hash, so a resubmitted motion is recognized", async () => {
      const x = await queued("archived");
      await s.owner.decide(x.id, { as: "archive", hash: x.content, note: "", date });
      const again = await s.b.submit({ kind: "clip", text: clipText("archived, sent again") });
      expect(again.motion).toBe(x.motion);
      expect((await s.owner.list({ motion: x.motion! })).map((y) => [y.id, y.state])).toEqual(expect.arrayContaining([[x.id, "archived"], [again.id, "submitted"]]));
    });

    it("lets the adopt bot return an adoption whose gates failed to awaiting review, with the reason", async () => {
      const x = await queued("returned");
      await s.owner.decide(x.id, { as: "adopt", hash: x.content, note: "", date });
      expect(await refusal(s.checker.advance(x.id, "awaiting review"))).toBe("E_INPUT");
      expect(await s.checker.advance(x.id, "awaiting review", { reason: "library gates: a duplicate of CMU_CURATED/Walk" })).toMatchObject({ state: "awaiting review", reason: expect.stringMatching(/duplicate/) });
    });
  });
}

contract("local", local);
const hostedStores = hosted();
if (hostedStores) contract("supabase", hostedStores);
else it.skip("the intake store's contract on supabase: a deferred proof (G9, once O8's project is linked; set M3A_INTAKE_SUPABASE)", () => {});
