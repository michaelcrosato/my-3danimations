// Search (PLAN.md WP-5.5): `search(items, query, opts)` over the catalogs' rows (their facts' speed among them), as a
// game moment is put in words ("drinks a potion", "lands on one knee", "sneaks"): each word matched against a clip's
// tags, its name and its description, through a vocabulary of concepts (moving, fighting, reacting, working, gesturing,
// resting) and the idioms that mean one thing, the moment's verb and rare words counting most; numeric filters
// (`speed>1.5` in m/s on a body with 0.95 m hips, `dur<2`), `loop` and `once`, `set:`, `tier:` and `tag:`. It answers
// with at most 40 short rows, the core list's clips (the 40 or so a game usually needs) first among equals, and a
// `next` hint: the nearest tags when nothing matches (not an error), a closer match in a tier the game hasn't opted
// into, and the CMU ledger's takes when the library has nothing close.
import type { CatalogRow, Tier } from "../load/index.ts";

/** A catalog row with its set's tier. */
export interface SearchItem extends CatalogRow {
  tier: Tier;
}
/** A CMU ledger row (tools/corpora/cmu-takes.tsv): a take that isn't in the library but can be imported. */
export interface LedgerItem {
  id: string;
  desc: string;
  category?: string;
}
/** How to search: the tiers the game opted into (CC0 alone by default), how many rows (10, at most 40), the ledger. */
export interface SearchOptions {
  tiers?: readonly Tier[];
  limit?: number;
  ledger?: readonly LedgerItem[];
}
/** One row found: short, as an agent reads it. */
export interface SearchHit {
  id: string;
  tier: Tier;
  dur: number;
  loop: boolean;
  /** m/s on a body with 0.95 m hips, when the clip travels as a loop. */
  speed: number | null;
  tags: string[];
  desc: string;
  score: number;
  /** One of the core list's clips. */
  core?: true;
}
/** What a search found: the rows, how many matched in all (in the tiers opted into), and what to try next. */
export interface SearchResult {
  rows: SearchHit[];
  total: number;
  next?: string;
}

/** The core list: the CC0 clips a game usually needs, read first (PLAN.md WP-5.5's reading tiers). */
export const CORE: readonly string[] = [
  "QUATERNIUS_3D2DGE/Idle_Loop", "MESH2MOTION/Idle_A", "QUATERNIUS_3D2DGE/Walk_Loop", "MESH2MOTION/Walk", "QUATERNIUS_3D2DGE/Jog_Fwd_Loop",
  "QUATERNIUS_3D2DGE/Sprint_Loop", "QUATERNIUS_3D2DGE/Crouch_Idle_Loop", "QUATERNIUS_3D2DGE/Crouch_Fwd_Loop", "MESH2MOTION/Strafe_left",
  "MESH2MOTION/Strafe_right", "MESH2MOTION/Walk_Backwards", "MESH2MOTION/Turn_Left_90", "MESH2MOTION/Turn_Right_90", "QUATERNIUS_3D2DGE/Jump_Start",
  "QUATERNIUS_3D2DGE/Jump_Loop", "QUATERNIUS_3D2DGE/Jump_Land", "QUATERNIUS_3D2DGE/Roll", "MESH2MOTION/Dodge_left", "MESH2MOTION/Dodge_right",
  "QUATERNIUS_3D2DGE/Punch_Jab", "MESH2MOTION/Kick_Breach", "QUATERNIUS_3D2DGE/Sword_Attack", "QUATERNIUS_3D2DGE/Sword_Block", "QUATERNIUS_3D2DGE/Shield_OneShot",
  "QUATERNIUS_3D2DGE/Pistol_Shoot", "QUATERNIUS_3D2DGE/Spell_Simple_Shoot", "MESH2MOTION/Bow_Release", "QUATERNIUS_3D2DGE/OverhandThrow",
  "QUATERNIUS_3D2DGE/Hit_Chest", "QUATERNIUS_3D2DGE/Hit_Knockback", "QUATERNIUS_3D2DGE/Death01", "QUATERNIUS_3D2DGE/LayToIdle", "QUATERNIUS_3D2DGE/Interact",
  "QUATERNIUS_3D2DGE/PickUp_Table", "QUATERNIUS_3D2DGE/Chest_Open", "QUATERNIUS_3D2DGE/Consume", "QUATERNIUS_3D2DGE/Sitting_Idle_Loop",
  "QUATERNIUS_3D2DGE/Idle_Talking_Loop", "MESH2MOTION/Victory", "QUATERNIUS_3D2DGE/Yes", "QUATERNIUS_3D2DGE/Dance_Loop", "MESH2MOTION/Climb_Ladder",
  "QUATERNIUS_3D2DGE/Swim_Fwd_Loop",
];

/**
 * The vocabulary: concepts as game moments put them, each its words (`say`) and the words the library writes it with
 * (`lib`); a word said finds the library's words of every concept it is in. Written from the ways motion is described,
 * by kind (moving, fighting, reacting, working, gesturing, resting), not from the test queries.
 */
const CONCEPTS: readonly { say: string; lib: string }[] = [
  // moving
  { say: "walk stroll wander amble saunter pace march trudge plod stride hike mosey patrol toddle", lib: "walk" },
  { say: "run jog sprint dash race rush hurry flee bolt charge scamper scurry gallop chase pursue", lib: "run sprint jog" },
  { say: "sneak creep prowl skulk stalk tiptoe slink unseen unnoticed undetected stealthy stealthily quietly silently covert", lib: "stealth sneak crouch tiptoe" },
  { say: "crouch squat duck hunker cover", lib: "crouch" },
  { say: "crawl prone belly slither", lib: "crawl" },
  { say: "old elderly aged senior frail granny grandpa grandma decrepit", lib: "old stick" },
  { say: "shuffle scuff totter hobble", lib: "slidefeet old limp" },
  { say: "limp hobble wounded injured lame", lib: "limp hurt wounded" },
  { say: "back backward backwards retreat reverse backpedal", lib: "back backwards" },
  { say: "sidestep strafe sideways", lib: "strafe side sidestep" },
  { say: "turn pivot spin rotate whirl", lib: "turn spin" },
  { say: "swim paddle tread", lib: "swim" },
  { say: "fly soar glide hover levitate float airborne", lib: "fly levitate glide" },
  { say: "climb scale ascend clamber scramble mount", lib: "climb ladder" },
  { say: "hang cling dangle grip ledge edge cliff brink precipice", lib: "ledge hang climb" },
  { say: "jump leap hop bound spring vault hurdle", lib: "jump hop" },
  { say: "land landing touchdown", lib: "land landing" },
  { say: "slide skid", lib: "slide" },
  { say: "roll tumble somersault", lib: "roll dodge" },
  { say: "dodge evade weave sidestep", lib: "dodge roll" },
  { say: "stop halt brake", lib: "stop" },
  // fighting
  { say: "attack strike assault", lib: "attack" },
  { say: "sword blade katana saber sabre cutlass rapier longsword slash cut stab thrust cleave swing", lib: "sword attack" },
  { say: "punch jab hook uppercut haymaker fist box slug sock brawl fight", lib: "punch unarmed jab" },
  { say: "kick stomp roundhouse boot", lib: "kick" },
  { say: "block parry guard defend deflect", lib: "block defend shield" },
  { say: "shield buckler", lib: "shield" },
  { say: "gun pistol revolver handgun rifle firearm shoot fire gunfire", lib: "gun pistol shoot" },
  { say: "bow arrow archer archery crossbow nock", lib: "bow" },
  { say: "throw toss hurl lob fling pitch grenade javelin bomb", lib: "throw" },
  { say: "magic spell cast conjure sorcery sorcerer wizard mage witch fireball enchant hex curse", lib: "magic spell" },
  { say: "aim target sight", lib: "aim" },
  { say: "reload", lib: "reload gun" },
  { say: "taunt insult mock jeer", lib: "insult" },
  { say: "power charge summon", lib: "power" },
  // reacting
  { say: "hurt hit struck blow damage wound injure pain flinch recoil wince stagger reel", lib: "hurt hit" },
  { say: "knockback blasted launched", lib: "knockback" },
  { say: "fall topple collapse trip stumble slip", lib: "fall stumble slip" },
  { say: "die death dead killed slain perish", lib: "death" },
  { say: "getup rise recover", lib: "getup" },
  { say: "dizzy stunned dazed groggy woozy", lib: "dizzy" },
  { say: "tired winded exhausted breathless panting fatigued weary spent", lib: "tired rest hunched" },
  { say: "cold freezing shiver shivering chilly frozen", lib: "freezing shivering" },
  { say: "scared afraid fear frightened terrified cower panic", lib: "scared" },
  { say: "sad sorrow depressed gloomy mope grieve mourn", lib: "sad mope" },
  { say: "cry weep sob tears", lib: "crying" },
  { say: "angry mad furious rage fume", lib: "angry upset" },
  { say: "happy joy glad overjoyed elated delighted", lib: "happy overjoyed" },
  { say: "laugh giggle chuckle cackle", lib: "laugh" },
  // working and handling things
  { say: "interact use press button lever operate activate switch", lib: "interact" },
  { say: "open unlock chest door crate lid", lib: "open chest" },
  { say: "loot plunder rummage treasure", lib: "chest open search" },
  { say: "pick grab take collect gather retrieve fetch", lib: "pick item" },
  { say: "carry hold haul lug tote", lib: "carry" },
  { say: "push shove", lib: "push" },
  { say: "pull drag tug", lib: "pull drag" },
  { say: "lift raise hoist heave", lib: "lift carry" },
  { say: "chop split hack fell cleave axe lumberjack log logs firewood timber lumber wood tree", lib: "chop wood tree" },
  { say: "dig shovel spade excavate bury", lib: "dig" },
  { say: "farm harvest plant sow seed water crop garden till", lib: "farm plant harvest water" },
  { say: "fish fishing angle reel rod", lib: "fish fishing" },
  { say: "hammer nail forge smith anvil", lib: "hammer" },
  { say: "saw", lib: "saw" },
  { say: "sweep broom mop clean wash scrub", lib: "sweep wash" },
  { say: "cook stir mix bake knead", lib: "mix slice" },
  { say: "eat food meal dine munch bite", lib: "eat" },
  { say: "drink potion sip gulp quaff chug flask bottle", lib: "drink consume" },
  { say: "write scribble type keyboard laptop", lib: "write type" },
  { say: "phone call", lib: "phone talkingphone" },
  { say: "fix repair mend tinker", lib: "fixing" },
  { say: "sit seat chair bench", lib: "sit sitting" },
  { say: "sleep nap doze slumber lie", lib: "sleep lie" },
  { say: "meditate pray contemplate", lib: "meditate" },
  { say: "kneel knee", lib: "kneel kneeling point" },
  { say: "drive steer car vehicle", lib: "driving" },
  // gesturing and talking
  { say: "wave hello hi greet greeting bye goodbye farewell hail", lib: "wave greeting" },
  { say: "help signal beckon", lib: "help gesture" },
  { say: "point indicate direct", lib: "gesture directions" },
  { say: "nod yes agree approve", lib: "yes nod" },
  { say: "no refuse deny reject disagree", lib: "no reject" },
  { say: "shrug", lib: "shrug" },
  { say: "salute", lib: "salute" },
  { say: "curtsey curtsy", lib: "curtsey bow" },
  { say: "cheer celebrate victory win triumph rejoice hooray score goal", lib: "cheer victory" },
  { say: "dance groove boogie jig twirl", lib: "dance" },
  { say: "confused puzzled", lib: "confused" },
  { say: "talk speak chat converse conversation discuss explain chatter", lib: "talk explain" },
  { say: "argue quarrel bicker shout", lib: "quarrel angry" },
  { say: "listen", lib: "listening" },
  { say: "look search scan glance peer gaze survey scout", lib: "look search" },
  { say: "stretch yawn", lib: "stretch yawn" },
  { say: "exercise workout train warmup pushup", lib: "exercise pushup" },
  { say: "idle stand wait loiter linger breathe", lib: "idle wait" },
  { say: "lean rail railing", lib: "lean" },
  { say: "head jaw face skull chin temple", lib: "head" },
  { say: "chest stomach gut belly torso ribs", lib: "chest stomach" },
  { say: "zombie undead shamble ghoul", lib: "zombie" },
  { say: "monster creature beast", lib: "monster" },
];
/** The synonyms the vocabulary gives: each word said, and the library's words for it (unstemmed). */
export const SYNONYMS: Readonly<Record<string, readonly string[]>> = (() => {
  const out: Record<string, string[]> = {};
  for (const c of CONCEPTS) for (const w of c.say.split(" ")) out[w] = [...new Set([...(out[w] ?? []), ...c.lib.split(" ").filter((x) => x !== w)])];
  return out;
})();

/** Words that carry no motion: articles, pronouns, linking words; and "forward" and "ahead", a gait's own way. */
const STOP = new Set("a an the to of on in at with and or from by for as is are was were be being been his her their its my your our them it he she they someone something somebody some this that these those then when while after before during forward ahead".split(" "));
/** Phrases that mean one thing (stemmed): an idiom, or words the library writes as one; matched before particles go. */
export const PHRASES: Readonly<Record<string, string>> = {
  "throw punch": "punch", "get up": "getup", "stand up": "getup", "pick up": "pick", "sit down": "sit", "lie down": "lie", "knock back": "knockback",
  "knock down": "knockback", "fall over": "fall", "fall down": "fall", "look around": "look", "shake head": "no", "fist pump": "cheer",
  "high five": "gesture", "slip past": "sneak", "sneak past": "sneak", "flag down": "wave", "call help": "help", "tread water": "swim", "cast line": "fish",
  "out breath": "tired", "warm up": "exercise", "take cover": "crouch",
};
/** Particles and degree words, which only place or size a motion (once the phrases have had them), and light verbs. */
const AFTER = new Set("up down off out away along through across past around over about toward towards into onto under long short very quite really just little get become start begin try keep".split(" "));
const IRREGULAR: Readonly<Record<string, string>> = { ran: "run", died: "die", dies: "die", dying: "die", fell: "fall", threw: "throw", thrown: "throw", swam: "swim", sat: "sit", lay: "lie", lying: "lie", got: "get", struck: "strike", fought: "fight", flew: "fly", drank: "drink", ate: "eat", knelt: "kneel", leapt: "leap", slain: "slay", stung: "sting", clung: "cling", hung: "hang", ridden: "ride", rode: "ride", swung: "swing", spun: "spin", stood: "stand", woke: "wake", drew: "draw" };

/** A word's stem: lower case, irregular forms mapped, then -ies, -ily, -ing, -ed, -es, -s and -ly taken off. */
export function stem(word: string): string {
  const w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length <= 3) return w;
  let s = w;
  if (s.endsWith("ies") && s.length > 4) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith("ily") && s.length > 5) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith("ing") && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith("ed") && s.length > 4) s = s.slice(0, -2);
  else if (/(sh|ch|x|ss|zz)es$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith("ly") && s.length > 5) s = s.slice(0, -2);
  else if (s.endsWith("s") && !s.endsWith("ss") && s.length > 3) s = s.slice(0, -1);
  // a doubled last consonant left by -ing or -ed (running, stopped)
  if (s !== w && /([b-df-hj-np-tv-z])\1$/.test(s) && !/(ll|ss|zz)$/.test(s)) s = s.slice(0, -1);
  return s;
}
/** Text's words: camelCase and `_` split, lower case. */
const wordsOf = (text: string) => text.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().match(/[a-z0-9]+/g) ?? [];
const PHRASE = new Map(Object.entries(PHRASES).map(([k, v]) => [k.split(" ").map(stem).join(" "), stem(v)]));
/** Each stemmed word said: the library's words for it, and whether each is its concept's first. */
const SYN = new Map<string, [string, boolean][]>();
for (const c of CONCEPTS) {
  const lib = c.lib.split(" ").map(stem);
  for (const w of c.say.split(" ").map(stem)) {
    const had = SYN.get(w) ?? [];
    for (const [i, l] of lib.entries()) if (l !== w && !had.some(([x, f]) => x === l && (f || i > 0))) had.push([l, i === 0]);
    SYN.set(w, had);
  }
}

/** A filter in a query: a fact compared, a flag, or a field matched. */
type Filter = { kind: "num"; key: "speed" | "dur"; op: string; value: number } | { kind: "loop"; loop: boolean } | { kind: "field"; key: "set" | "tier" | "tag"; value: string };
/**
 * A query's words and filters: stop words out, the rest stemmed; a phrase that means one thing made that word ("throws
 * a punch" is a punch, "slips past" a sneak); then particles, degree words and light verbs out ("gets hit" is a hit,
 * "shuffles down the lane" a shuffle).
 */
export function parseQuery(query: string): { words: string[]; filters: Filter[] } {
  const words: string[] = [], filters: Filter[] = [];
  for (const raw of query.trim().split(/\s+/).filter(Boolean)) {
    const num = /^(speed|dur)(<=|>=|<|>|=)(\d+(?:\.\d+)?)$/.exec(raw), field = /^(set|tier|tag):(\S+)$/.exec(raw);
    if (num) filters.push({ kind: "num", key: num[1] as "speed" | "dur", op: num[2]!, value: Number(num[3]) });
    else if (field) filters.push({ kind: "field", key: field[1] as "set" | "tier" | "tag", value: field[2]! });
    else if (raw === "loop" || raw === "once") filters.push({ kind: "loop", loop: raw === "loop" });
    else for (const w of wordsOf(raw)) if (!STOP.has(w)) words.push(stem(w));
  }
  for (let i = 0; i + 1 < words.length; i++) {
    const one = PHRASE.get(`${words[i]} ${words[i + 1]}`);
    if (one) words.splice(i, 2, one);
  }
  return { words: words.filter((w) => !AFTER.has(w)), filters };
}

/** m/s on the reference body (0.95 m hips) from a catalog speed (% of the hip height a second). */
const mps = (speed: number | null) => (speed === null ? null : Math.round(speed * 0.95) / 100);
const passes = (it: SearchItem, f: Filter): boolean => {
  if (f.kind === "loop") return it.loop === f.loop;
  if (f.kind === "field") return f.key === "set" ? it.id.split("/")[0]!.toLowerCase() === f.value.toLowerCase() : f.key === "tier" ? it.tier === f.value : it.tags.includes(f.value);
  const v = f.key === "dur" ? it.dur : mps(it.speed);
  if (v === null) return false;
  return f.op === "<" ? v < f.value : f.op === "<=" ? v <= f.value : f.op === ">" ? v > f.value : f.op === ">=" ? v >= f.value : v === f.value;
};

/** An item's words by where they come from: tags weigh most, then its name, then its description. */
interface Indexed {
  it: SearchItem;
  tags: Set<string>;
  name: Set<string>;
  desc: Set<string>;
}
const cache = new WeakMap<readonly SearchItem[], Indexed[]>();
function index(items: readonly SearchItem[]): Indexed[] {
  let ix = cache.get(items);
  if (!ix) {
    ix = items.map((it) => ({ it, tags: new Set(it.tags.map(stem)), name: new Set(wordsOf(it.id.split("/")[1] ?? it.id).map(stem)), desc: new Set(wordsOf(it.desc).filter((w) => !STOP.has(w)).map(stem)) }));
    cache.set(items, ix);
  }
  return ix;
}
/** How well one item answers one word: its tags 3, name 2.5, description 1; through a synonym 0.7 of that for the
 *  concept's first library word ("cut" is a sword's), 0.5 for its others (an attack's). */
function wordScore(x: Indexed, w: string): number {
  const direct = x.tags.has(w) ? 3 : x.name.has(w) ? 2.5 : x.desc.has(w) ? 1 : 0;
  if (direct >= 2.5) return direct;
  let syn = 0;
  for (const [s, first] of SYN.get(w) ?? []) syn = Math.max(syn, (first ? 0.7 : 0.5) * (x.tags.has(s) ? 3 : x.name.has(s) ? 2.5 : x.desc.has(s) ? 1 : 0));
  return Math.max(direct, syn);
}
/** Scores every item for the query's words: each word's best match times how rare the word is (the first word, the
 *  moment's verb, half again: "sneaks past a guard" is a sneak), and a third more for an item that answers every word. */
function scored(ix: Indexed[], words: string[]): Map<SearchItem, number> {
  const out = new Map<SearchItem, number>(), n = ix.length;
  const idf = words.map((w) => {
    const df = ix.filter((x) => wordScore(x, w) > 0).length;
    return 1 + Math.log((n + 1) / (df + 1));
  });
  for (const x of ix) {
    let s = 0, all = true;
    words.forEach((w, i) => {
      const v = wordScore(x, w);
      if (v === 0) all = false;
      s += v * idf[i]! * (i === 0 ? 1.5 : 1);
    });
    if (s > 0) out.set(x.it, all && words.length > 1 ? s * 1.3 : s);
  }
  return out;
}

const edit = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
};

/**
 * Searches catalog rows for a query (words and filters). Rows outside the tiers opted into (CC0 alone by default) are
 * never returned; `next` names one when it answers better. At most `limit` rows (10; 40 at most), best first.
 */
export function search(items: readonly SearchItem[], query: string, opts: SearchOptions = {}): SearchResult {
  const tiers = opts.tiers ?? ["cc0"], limit = Math.max(1, Math.min(40, opts.limit ?? 10)), { words, filters } = parseQuery(query);
  const ix = index(items), ok = (it: SearchItem) => filters.every((f) => passes(it, f));
  const scores = words.length ? scored(ix, words) : new Map(ix.map((x) => [x.it, CORE.includes(x.it.id) ? 1 : 0.1]));
  const ranked = [...scores].filter(([it]) => ok(it)).sort((a, b) => b[1] - a[1] || (CORE.includes(a[0].id) ? -1 : 0) - (CORE.includes(b[0].id) ? -1 : 0) || (a[0].id < b[0].id ? -1 : 1));
  const mine = ranked.filter(([it]) => tiers.includes(it.tier)), other = ranked.find(([it]) => !tiers.includes(it.tier));
  const rows = mine.slice(0, limit).map(([it, s]): SearchHit => ({ id: it.id, tier: it.tier, dur: it.dur, loop: it.loop, speed: mps(it.speed), tags: it.tags, desc: it.desc.length > 90 ? `${it.desc.slice(0, 87)}...` : it.desc, score: Math.round(s * 10) / 10, ...(CORE.includes(it.id) ? { core: true as const } : {}) }));
  const notes: string[] = [];
  if (!rows.length) {
    const tags = [...new Set(items.flatMap((it) => it.tags))], near = words.flatMap((w) => tags.map((t) => [t, edit(w, stem(t))] as const).filter(([, d]) => d <= 2).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([t]) => t));
    notes.push(`no clip matches "${query}"${near.length ? `; the nearest tags: ${[...new Set(near)].join(", ")}` : `; try fewer words, or a tag (${tags.slice(0, 12).join(", ")}, ...)`}`);
  }
  if (other && (!mine.length || other[1] > mine[0]![1])) notes.push(`a closer match is in tier ${other[0].tier}: ${other[0].id} ("${other[0].desc.slice(0, 50)}"); opt in with tiers: [${[...tiers, other[0].tier].map((t) => `"${t}"`).join(", ")}]`);
  if (opts.ledger && words.length && (!mine.length || mine[0]![1] < 4)) {
    const takes = opts.ledger.map((t) => [t, words.filter((w) => wordsOf(`${t.desc} ${t.category ?? ""}`).map(stem).some((x) => x === w || (SYN.get(w) ?? []).some(([l]) => l === x))).length] as const).filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (takes.length) notes.push(`the CMU ledger has takes to import: ${takes.map(([t]) => `${t.id} ("${t.desc.slice(0, 40)}")`).join(", ")} (npm run corpora -- cmu --ledger ${words[0]})`);
  }
  if (mine.length > rows.length) notes.push(`${mine.length - rows.length} more: raise limit (at most 40), or add a word or a filter (loop, dur<2, speed>1.5, tag:..., set:...)`);
  return { rows, total: mine.length, ...(notes.length ? { next: notes.join("; ") } : {}) };
}
