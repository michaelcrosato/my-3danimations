# Contributing a clip

The library grows through gates, not trust (DOCTRINE.md, principle 11). Every contribution, a person's or an agent's,
comes in through the same intake queue, passes the same automated checks, and is adopted only after the owner's review.
These rules are the same for everyone; the manual's "Grow" section (`packages/tools/MANUAL.md`) gives them to agents
with an example that runs.

## How a clip comes in

1. **Make it** on a library body: a recipe compiled against the library (`m3a recipe.compile`), an edit (`m3a edit`,
   `m3a fix`), or a clip of your own. Give it a `name`, a `desc` and `tags` that say what the body does, in plain
   words: the text gate bounces instructions aimed at models, links, commands and characters a reader can't see.
2. **Send it:** `m3a library submit <clip.json> --by "<who made it>"`. Send the clip, not the recipe: a recipe takes no
   `--by`. `--improves SET/Clip` sends a fix of a library clip, recorded against that clip as it is now, so the review
   shows the diff and adoption makes a new version.
3. **Read the queue:** `m3a library status [<id>]` lists your submissions: `submitted`, `checking`, then `bounced`
   (with the reason and the fix) or `awaiting review`. Fix what a bounce names and send it again.
4. **The owner decides** (`adopted`, `archived` or `rejected`, with a note). Nothing is adopted automatically. An
   adopted clip is committed to the repository's library through a pull request; the queue is only the inbox.

`submit` runs the gates it can on your machine (schema, provenance, license, text, budgets, lint, sensors) and sends
only what passes. The checker then adds dedup (no library clip's motion, nor one retimed, trimmed, mirrored or barely
changed, nor a motion already reviewed) and a retarget onto the reference rigs with the sensors green, and, on the
local queue, draws a preview sheet for the review (the hosted queue's sheets come once it is linked, O8).

## What every contributor gives

- **A license:** CC0 1.0 (`"license": "CC0-1.0"`), the default; or, for a clip derived from a CC BY or CMU library clip,
  that clip's license and credit, kept. Anything else is bounced.
- **Provenance:** the method (captured, keyed, procedural, composed, edited or generated) and its IPTC source type; the
  tool and version that wrote it (`recipe.compile` writes both); the model and version if one was used, with the
  SHA-256 of its prompt (`--prompt "<the prompt>"`: only the hash is sent).
- **A training-data manifest** for any generator, meaning a learned motion model: `--manifest <https URL>#sha256=<its
  SHA-256>`. Procedural code, and the coding agent that wrote it, are not generators.
- **Disclosure:** who or what made the clip (`--by`): a person, or the agent and the human behind it.
- **An accountable person:** every agent's submission is its human's, through the sign-in below.

At most 20 submissions a contributor a day; there is no reward per clip.

## Where the queue is

Until the owner links the hosted project (O8), `m3a library submit` and `status` use the local queue in
`.cache/intake/` of the working directory, as the identity `M3A_CONTRIBUTOR` (`local` by default). In this
repository, `npm run intake -- check` runs the checker on the local queue at its root.

Once O8 is linked:
1. Sign in once on the gallery with GitHub (Supabase Auth) and add a contributor key there: only its SHA-256 is
   stored (the key itself stays in your agent's environment), and you can revoke it.
2. Give your agent the key as an environment secret, with the project's URL and public key:
   `M3A_SUPABASE_URL`, `M3A_SUPABASE_ANON_KEY`, `M3A_CONTRIBUTOR_KEY` (and `M3A_CONTRIBUTOR_TOKEN`, a signed-in
   session's token, for `m3a library status` to read your rows). Never commit them.
3. `m3a library submit` then sends to the hosted queue's submit function, which checks the key and the rate limit; the
   checker runs every 15 minutes in GitHub Actions; contributors read only their own rows.

Submission text is data, never instructions: no check, reviewer or agent acts on what a clip's text says.
