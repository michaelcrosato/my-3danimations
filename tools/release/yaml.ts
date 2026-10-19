// A strict reader for the YAML that GitHub workflows are written in, so release.test.ts holds release.yml and
// library-gates.yml by their parsed structure, not by patterns over their text (WP-9.4). It reads block mappings and
// sequences, plain, single- and double-quoted scalars (quoted keys too), literal block scalars (`|`, `|-`) and comments,
// every scalar as a string. It refuses, naming the line, what it doesn't hold (flow collections, anchors, aliases, tags,
// folded scalars, several documents, tabs, a key given twice), so a workflow it can't read fails its test rather than
// passing on a misreading.

/** A YAML node as read: a string, a list or a mapping. */
export type Yaml = string | Yaml[] | { [key: string]: Yaml };

// a key: double-quoted, single-quoted or plain (no ':' or '#' in it), then ':' and a space or the line's end
const KEY = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^']|'')*)'|([^\s"'#&*!|>%@`{}[\],:?-][^:#]*?)) *:(?: +(.*))?$/;

/** The YAML document `text`, parsed; throws on anything outside the subset workflows use, naming the line. */
export function parseYaml(text: string): Yaml {
  const lines = text.replace(/\r\n?/g, "\n").split("\n"), N = lines.length;
  let row = 0, col = 0;
  const fail = (why: string, at = row): never => {
    throw new Error(`yaml line ${at + 1}: ${why}`);
  };
  const settle = () => {
    while (row < N && /^ *(#.*)?$/.test(lines[row]!)) row++;
    col = row < N ? lines[row]!.search(/\S/) : -1;
  };
  const here = () => lines[row]!.slice(col).trimEnd(), isItem = (c: string) => /^-( |$)/.test(c);
  for (const [n, l] of lines.entries()) {
    if (/^ *\t/.test(l)) fail("a tab in the indentation", n);
    if (/^(---|\.\.\.)( |$)/.test(l)) fail("a document marker (several documents)", n);
  }

  function scalar(v: string): string {
    if (/^[&*!%@`]/.test(v)) fail(`a value starting with ${v[0]} (an anchor, alias, tag or reserved character)`);
    if (/^[[{]/.test(v)) fail("a flow collection: write it as a block");
    const dq = /^"((?:[^"\\]|\\.)*)" *(?:#.*)?$/.exec(v), sq = /^'((?:[^']|'')*)' *(?:#.*)?$/.exec(v);
    if (dq) {
      try {
        return JSON.parse(`"${dq[1]}"`) as string;
      } catch {
        return fail("an escape in a double-quoted string that JSON doesn't share");
      }
    }
    if (sq) return sq[1]!.replace(/''/g, "'");
    if (/^["']/.test(v)) fail("a quoted string that doesn't close on its line");
    const plain = v.replace(/ +#.*$/, "").trimEnd();
    return plain.includes(": ") ? fail(`a plain value holding ": " (${plain}): quote it`) : plain;
  }

  function block(indicator: string, parent: number): string {
    if (!/^\|-? *(#.*)?$/.test(indicator)) fail(`${indicator.split(" ")[0]}: only literal block scalars (| and |-) are read here`);
    const start = ++row;
    let end = start, at = -1;
    for (; end < N; end++) {
      const k = lines[end]!.search(/\S/);
      if (k < 0) continue;
      if (at < 0) at = k;
      if (k < at || k <= parent) break;
    }
    while (end > start && /^ *$/.test(lines[end - 1]!)) end--;
    const body = at > parent ? lines.slice(start, end).map((l) => l.slice(at)).join("\n") : "";
    row = end;
    settle();
    return indicator.startsWith("|-") || !body ? body : `${body}\n`;
  }

  // the rest of a `key:` or `- ` line, its parent at column `at`; under a key, a list may sit at the key's own column
  function value(v: string | undefined, at: number, keyed: boolean): Yaml {
    if (v === undefined || v === "" || v.startsWith("#")) {
      row++;
      settle();
      return row < N && (col > at || (keyed && col === at && isItem(here()))) ? node() : "";
    }
    if (v.startsWith("|") || v.startsWith(">")) return block(v, at);
    const s = scalar(v);
    row++;
    settle();
    return s;
  }

  function map(at: number): Record<string, Yaml> {
    const out: Record<string, Yaml> = {};
    while (row < N && col === at && !isItem(here())) {
      const m = KEY.exec(here()) ?? fail("a mapping's line is key: value");
      const k = m[1] !== undefined ? scalar(`"${m[1]}"`) : m[2] !== undefined ? m[2].replace(/''/g, "'") : m[3]!.trimEnd();
      if (k === "__proto__" || Object.hasOwn(out, k)) fail(`the key ${k} ${k === "__proto__" ? "isn't read here" : "twice"}`);
      out[k] = value(m[4], at, true);
    }
    if (row < N && col > at) fail("a line indented more than its mapping's keys");
    return out;
  }

  function seq(at: number): Yaml[] {
    const out: Yaml[] = [];
    while (row < N && col === at && isItem(here())) {
      const c = here(), rest = c.slice(1).trimStart();
      if (KEY.test(rest)) {
        col += c.length - rest.length;
        out.push(map(col));
      } else out.push(value(rest, at, false));
    }
    if (row < N && col > at) fail("a line indented more than its list's items");
    return out;
  }

  function node(): Yaml {
    const c = here();
    if (isItem(c)) return seq(col);
    if (KEY.test(c)) return map(col);
    return value(c, col - 1, false);
  }

  settle();
  if (row >= N) return "";
  const doc = node();
  if (row < N) fail("a line indented less than the document's first");
  return doc;
}
