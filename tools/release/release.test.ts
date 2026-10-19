// The registry index (WP-9.4): library/index.json regenerates byte for byte and every core set verifies from its files;
// on fixture sets, a changed set gets a new version and the old one stands, a deleted set or a rewritten version is
// refused, a yank is recorded; a community pack whose files miss its content id or whose namespace's proof doesn't
// vouch for it is refused, and an admitted one verifies; release.yml runs only by hand and fails closed until O2.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { contentId, type LibrarySource } from "../../packages/library/src/index.ts";
import { directory, sha256 } from "../../packages/library/src/node.ts";
import { ROOT } from "../run/cli.ts";
import { admit, buildIndex, history, ids, indexText, proofUrl, verifySet, type Candidate, type Files, type Registry, type RegistryIndex } from "./index.ts";
import { INDEX, REGISTRY } from "./main.ts";

/** A fixture set's files: its clips (a QA verdict, a review state) and a manifest that carries their content id. */
function setFiles(clips: Record<string, string>, tier = "cc0", license = "CC0-1.0"): Files {
  const files: Files = Object.fromEntries(Object.entries(clips).map(([n, qa]) => [`${n}.json`, JSON.stringify({ quality: { qa }, ...(n === "A" ? { review: { state: "approved" } } : {}) })]));
  const content = contentId(Object.fromEntries(Object.entries(files).map(([f, t]) => [f, sha256(t)])), sha256);
  return { ...files, "_set.json": JSON.stringify({ title: "Fixture", tier, content: { sha256: content }, sources: { s: { license } } }), "catalog.tsv": "id\n" };
}
const source = (sets: Record<string, Files>): LibrarySource => ({ sets: () => Object.keys(sets), files: (s) => Object.keys(sets[s]!), read: (s, f) => sets[s]![f]! });
const none: Registry = { yanked: {}, community: {} };

describe("the core", () => {
  it("regenerates library/index.json byte for byte, and every set verifies from its files", () => {
    const committed = readFileSync(INDEX, "utf8"), index = JSON.parse(committed) as RegistryIndex, lib = join(ROOT, "library/sets");
    expect(indexText(buildIndex(directory(lib), sha256, JSON.parse(readFileSync(REGISTRY, "utf8")) as Registry, index))).toBe(committed);
    for (const s of Object.keys(index.core)) expect(verifySet(index, s, Object.fromEntries(directory(lib).files(s).map((f) => [f, directory(lib).read(s, f)])), sha256), s).toEqual([]);
  });
  it("keeps every version: a change is a new one, a deleted set or a rewritten version is refused, a yank recorded", () => {
    const one = setFiles({ A: "pass", B: "baselined" }), v1 = buildIndex(source({ FIX: one }), sha256, none);
    expect(v1.core.FIX!.versions[0]).toMatchObject({ v: 1, clips: 2, tier: "cc0", licenses: ["CC0-1.0"], qa: { baselined: 1, pass: 1 }, review: { approved: 1, flagged: 0, unreviewed: 1 } });
    expect(indexText(buildIndex(source({ FIX: one }), sha256, none, v1))).toBe(indexText(v1));
    const two = setFiles({ A: "pass", B: "pass" }), v2 = buildIndex(source({ FIX: two }), sha256, { yanked: { "FIX@1": "B's feet slid" }, community: {} }, v1);
    expect([v2.serial, v2.core.FIX!.versions.map((v) => [v.v, v.yanked])]).toEqual([2, [[1, "B's feet slid"], [2, undefined]]]);
    expect(verifySet(v2, "FIX", one, sha256, { v: 1 })).toEqual([]);
    expect(verifySet(v2, "FIX", one, sha256).join()).toMatch(/FIX v2: its clip files give content id .* a clip file differs/);
    expect(verifySet(v2, "FIX", { ...two, "extra.txt": "x" }, sha256).join()).toMatch(/digest .* is missing or is extra/);
    expect(() => buildIndex(source({}), sha256, none, v2)).toThrow(/FIX is gone from the index's core: a set is yanked, never deleted/);
    expect(() => buildIndex(source({ FIX: two }), sha256, { yanked: { "FIX@3": "x" }, community: {} }, v2)).toThrow(/yanks FIX@3, which the index doesn't hold/);
    const rewritten = { ...v2, core: { FIX: { versions: [{ ...v2.core.FIX!.versions[0]!, clips: 9 }, v2.core.FIX!.versions[1]!] } } };
    expect(history(v2, rewritten)).toEqual(["FIX v1 changed: versions are immutable; a change is a new version"]);
    expect(() => buildIndex(source({ FIX: { ...two, "_set.json": one["_set.json"]! } }), sha256, none)).toThrow(/clip files give content id .* its _set.json says/);
  });
});

/** The index's JSON Schema, compiled. */
const valid = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(join(import.meta.dirname, "index.schema.json"), "utf8")) as object);

describe("the index's schema", () => {
  it("holds the committed index, and refuses a version with no content id or a set deleted to nothing", () => {
    const committed = JSON.parse(readFileSync(INDEX, "utf8")) as RegistryIndex;
    expect(valid(committed), JSON.stringify(valid.errors)).toBe(true);
    const [name, set] = Object.entries(committed.core)[0]!;
    expect(valid({ ...committed, core: { ...committed.core, [name]: { versions: [{ ...set.versions[0]!, content: "x" }] } } })).toBe(false);
    expect(valid({ ...committed, core: { ...committed.core, [name]: { versions: [] } } })).toBe(false);
    expect(valid({ ...committed, format: "2" })).toBe(false);
  });
});

describe("community packs", () => {
  const files = setFiles({ A: "pass" }), real = ids(files, sha256).content;
  const pack: Candidate = { namespace: "packs.example.org", set: "DANCES", license: "CC0-1.0", url: "https://packs.example.org/dances-v1.tar.gz", content: real };
  const proof = { url: "https://packs.example.org/.well-known/m3a-packs.json", text: JSON.stringify({ namespace: "packs.example.org", packs: { DANCES: [real] } }) };
  it("admits a pack whose files give its content id and whose namespace's proof vouches for it, and it verifies", () => {
    expect(real).toBe(JSON.parse(files["_set.json"]!).content.sha256);
    expect(proofUrl("github.com/alice")).toBe("https://raw.githubusercontent.com/alice/.github/HEAD/m3a-packs.json");
    const reg = admit(none, pack, files, proof, sha256), index = buildIndex(source({}), sha256, reg);
    expect(index.community["packs.example.org/DANCES"]).toMatchObject({ proof: proof.url, versions: [{ v: 1, content: real, tier: "cc0" }] });
    expect(valid(index), JSON.stringify(valid.errors)).toBe(true);
    expect(verifySet(index, "packs.example.org/DANCES", files, sha256, { proof })).toEqual([]);
    expect(verifySet(index, "packs.example.org/DANCES", setFiles({ A: "fail" }), sha256, { proof }).join()).toMatch(/content id/);
    expect(() => admit(reg, pack, files, proof, sha256)).toThrow(/holds that content id already/);
  });
  it("refuses a mismatched hash and an unverified namespace", () => {
    const refused = (c: Candidate, f: Files, p: typeof proof | undefined) => expect(() => admit(none, c, f, p, sha256));
    refused(pack, setFiles({ A: "fail" }), proof).toThrow(/refused: its files give content id .*, not /);
    refused(pack, files, undefined).toThrow(/packs.example.org is unverified: fetch its proof from https:\/\/packs.example.org\/.well-known/);
    refused(pack, files, { ...proof, url: "https://evil.example.com/.well-known/m3a-packs.json" }).toThrow(/its proof came from https:\/\/evil.example.com.*only https:\/\/packs.example.org/);
    refused(pack, files, { ...proof, text: JSON.stringify({ namespace: "other.org", packs: { DANCES: [real] } }) }).toThrow(/the proof at .* names "other.org"/);
    refused(pack, files, { ...proof, text: JSON.stringify({ namespace: "packs.example.org", packs: { DANCES: ["0".repeat(64)] } }) }).toThrow(/unverified for DANCES at/);
    refused({ ...pack, namespace: "not a namespace" }, files, proof).toThrow(/isn't a namespace/);
    refused({ ...pack, license: "LicenseRef-Private" }, files, proof).toThrow(/a redistributable license/);
  });
});

describe("release.yml", () => {
  const text = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
  it("runs only by hand, reads by default, and its upload waits on the owner's go-ahead and replaces nothing", () => {
    expect(/^on:\n((?: {2}.*\n)+)/m.exec(text)![1]!.match(/^ {2}\w[\w-]*:/gm)).toEqual(["  workflow_dispatch:"]);
    expect(text).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(text).toMatch(/ {2}assets:\n(?: {4}.*\n)*? {4}needs: go-ahead\n/);
    expect(text).toMatch(/gh release upload "\$TAG" .cache\/release\/assets\/\*\n/);
    expect(text).not.toMatch(/--clobber/);
  });
  it("fails closed: nothing runs unless the owner set M3A_O2_RELEASE_ASSETS to yes and started the run", () => {
    const script = /O2 answered by the owner, or nothing runs\n(?: {8}.*\n)*? {8}run: \|\n((?: {10}.*\n)+)/.exec(text)![1]!.replace(/^ {10}/gm, "");
    const run = (env: Record<string, string>) => spawnSync("bash", ["-c", script], { env: { PATH: process.env.PATH!, ...env }, encoding: "utf8" });
    expect(run({ ACTOR: "o", OWNER: "o" })).toMatchObject({ status: 1, stdout: expect.stringMatching(/^::error title=release::O2 is unanswered/) });
    expect(run({ O2: "true", ACTOR: "o", OWNER: "o" }).status).toBe(1);
    expect(run({ O2: "yes", ACTOR: "someone", OWNER: "o" })).toMatchObject({ status: 1, stdout: expect.stringMatching(/Only the repository's owner \(o\) starts a release, not someone/) });
    expect(run({ O2: "yes", ACTOR: "o", OWNER: "o" }).status).toBe(0);
  });
});
