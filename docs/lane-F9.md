# Lane F.9: honest per-loop contact readings for the rate sweep's failing loops (D129)

Branch `claude/cool-goldberg-qgyu06` at `main` faf3fe4 (0.55.3). Written as the work goes; the integrator writes
PLAN.md, the ledger, DECISIONS.md, CHANGELOG.md, PROGRESS.md and HANDOFF.md from it.

## The rule, written before any sweep was measured

Written at the start, before step 1 ran and before any of the rate sweep's rows were read for a loop. Its code is
`tools/facts/readings.ts` (`chooseReading`, `checkReading`), on core's `clip.readContacts` and `clip.CONTACT_READINGS`.

- **The loops:** the 126 loops `library/baselines/rates.json` answers (every loop that fails a rate-sweep row, 473 rows).
  That list is the rule's only input from the sweep: which loops to read. Nothing in the rule reads a row, a verdict, a
  slide or a skate.
- **The readings** (none needs a new detector; six are readings measureFacts and its fallbacks take, six are new to
  core, below):
  - `file`: the contacts its file holds, as `playable` reads them (`measureFacts`' default chain, with D104's, D122's
    and D127's fallbacks where they fire);
  - twelve named readings, core's `clip.CONTACT_READINGS`, each a height pass refined by the world:
    - the points that read a foot: ankle, ball and toe (the default), or `sole-`: heel, ball and toe (D104's sole
      fallback, D122's `bySole`);
    - the velocity taken for the body's: `planted`, the planted feet's in that height pass (the default refinement,
      `reread`'s first try, `bySole`), or `lower`, the lower foot's (`reread`'s second try);
    - how slow a planted foot is: the refinement's own (0.3 H0/s and at most half the body's speed), `-half` (half the
      body's speed, `reread`'s), or `-quarter` (a quarter, D122's other "still").
  - Which of the twelve the chain takes (corrected after review: the first draft said all twelve). Six, each where its
    path fires: `planted` (the default refinement), `planted-half` and `lower-half` (`reread`'s two tries),
    `sole-planted` (D104's sole pass refined, and `bySole`), `sole-planted-half` and `sole-lower-half` (`reread` after
    the sole pass). The other six (`planted-quarter`, `lower`, `lower-quarter`, `sole-planted-quarter`, `sole-lower`,
    `sole-lower-quarter`) no path takes: none sets "still" to a quarter of the body's speed, and none refines by the
    lower foot's velocity with the refinement's own "still". They are readings D122 weighed ("every reading
    `measureFacts` takes and ... those it could": the lower foot's velocity, "still" at a quarter or half), named
    before the rate sweep existed, so not fitted to it; but they are new to core here, an extension D129 puts to the
    owner as one (what it changes: step 2's last bullet).
  - Left out: the height pass with no refinement (D108: "nothing falls back to the height pass"), and the captured speed
    as the body's velocity (D122: it stays out of core, a new input).
- **D108's bar**, independent of the sweep. A reading passes when, on the loop as the library plays it (rate 1) and
  retimed at 0.5, 0.75, 1.5 and 2 (core's `ops.retime`, as a game retimes it):
  1. both feet plant (footL and footR each have a contact);
  2. a foot is down at least a fifth of the loop's samples (60 a second, sampleAll's grid: core's `stands`);
  3. the planter holds every ankle within 10% of H0: over two cycles, 60 samples a second, under the root `contactRoot`
     reads from the contacts, neither ankle is moved 10% of H0 or more from where the motion has it (clip.test.ts's
     `pull`, core's `holds`: both ankles at every sample, so a foot the planter sets back onto the floor counts too).
  At a retimed speed the reading is the one `playable` would give there: for `file`, `measureFacts` on the retimed loop;
  for a named reading, the reading taken afresh on the retimed loop **and** the loop's own reading moved with its keys
  (what a reading written into the file as `labelled` plays: core's retime moves contacts with the keys). Both must
  pass.
- **The choice:** of the readings that pass, the one whose ground speed at rate 1 (`contactRoot(clip, R,
  contacts).speed`, as % of H0 a second) is nearest the loop's captured speed (`facts.speed` where `facts.captured`
  names it, @m3a/library's `capturedSpeed`), by the absolute difference; a tie keeps `file`, then the earlier name in
  `CONTACT_READINGS`. A loop with no captured speed keeps `file`; so does a loop no reading passes for. (The ground
  speeds are compared as `checkReading` reports them, to a tenth of a percent of H0 a second, the facts' precision; the
  code was written with this rule, before step 1 ran. At that precision 29 loops had a tie between readings whose
  contacts differ: the order decided, the file's first. Among the 45 adopted it decided 11: `Balance_Walk` (4 distinct
  contacts tied), `StartStop_WalkBack`, `DragLeftLeg_RunBack`, `Flapping_SideRight`, `LimpRight_SideLeft`,
  `Robot_SideLeft`, `Strutting_SideLeft`, `WalkingStickLeft_SideLeft`, `Zombie_SideLeft`,
  `LimpRight_SideRunLeft`, `RaisedLeftArm_SideRunRight`.)
- **Then measured, per loop whose chosen reading differs from `file`:** its rate-sweep rows on all six bodies, the
  retarget judge on the six sweep skeletons, and its QA verdict, with the new contacts. Adopted only if it adds no
  failing row (any body, any rate), adds no judge fail, and its QA verdict is no worse; else its file's contacts stay.

## Step 1: the rule applied (before any sweep row was read)

`chooseReading` over the 126 answered loops, 13 readings each at five speeds (283 s of CPU, four processes):

- **12 keep their file's, no captured speed:** the eight MESH2MOTION loops (keyed: `Crouch_Walk`, `Run_Female`,
  `Sprint`, `Strafe_left`, `Strafe_right`, `Walk_Female`, `Walk_Stealth`, `Zombie_Walk_2`), the three
  QUATERNIUS_3D2DGE loops (`Crouch_Fwd_Loop`, `Walk_Loop`, `Zombie_Walk_Fwd_Loop`) and `STYLE100/WiggleHips_Walk`.
- **20 keep their file's, no reading passes the bar:** 17 plant one foot (or none, or one under a fifth of the loop) on
  every reading at some speed (the hops `LeftHop_*` and `RightHop_*`, nine; `Elated_Run`, `CrowdAvoidance_SideRunRight`,
  `HandsBetweenLegs_WalkBack`, `DragRightLeg_RunBack`, `InTheDark_Walk`, `SwingArmsRound_Run`, `Penguin_Run`,
  `RaisedLeftArm_RunBack`); three the planter pulls an ankle 10% of H0 or more on every reading that plants both feet (`CMU_CURATED/Wounded_Walk_Loop` on
  all 13, `Morris_RunBack` on 8, `STYLE100/Rushed_Walk` on 11: its free toe dips 119 mm under the floor and the planter
  sets it back on it, 12.2% of H0 on every reading).
- **37 keep their file's, nearest the captured speed** among the readings that pass (the file's passes on 80 of the 114
  loops with a captured speed; of the 34 where it fails, 27 plant one foot at some speed, 4 keep a foot down under a
  fifth of the loop, 3 pull past 10%).
- **57 choose another reading:** `planted-quarter` 22, `planted-half` 12, `sole-planted-quarter` 8, `lower-quarter` 5,
  `lower` 3, `sole-planted` 2, `sole-planted-half` 2, `sole-lower-quarter` 2, `lower-half` 1. Every one holds both
  feet, a foot down 55 to 100% of the loop, the worst pull 1.1 to 8.6% of H0 over the five speeds and both ways a
  retimed reading is read.

## Step 2: the 57 measured

Each loop's 30 rate rows on the six bodies (`rateRows`, the sweep's own function, on the clip with the chosen reading
written as `withReading` writes it), the judge on the six sweep skeletons (`sweepOne`, the G4 sweep's), and the sensors'
verdict (`metrics`), against the same with its file's contacts. The file's rows matched `rates.json` for all 57 loops
(174 failing rows, none missing, none extra).

- **The rule's readings before the veto** (all 57): their failing rows 174 → 125, 61 dropped and 12 added on 8 loops;
  3 judge fails added and 2 gone; 1 QA verdict worse; 19 of the 57 would fail no row. The veto below is the WP's bar,
  and it reads each loop's own result, so the "0 added" after it holds by construction; the 12 it turned down would
  have dropped 16 rows and added the 12.
- **45 adopted:** no failing row added on any body or rate, no judge fail added, the QA verdict as good or better
  (`STYLE100_BACKRUN/DragLeftLeg_RunBack` warn → pass; the other 44 the same). Their rows: 129 → 84 (45 dropped, 0
  added); 18 of the 45 fail no row now. The judge: one fail gone (`Elated_RunBack` on gen-3, skate 29.5 cm/s), none
  added; counted by metric, 13 warns new on 11 loop-and-skeleton pairs and 7 gone, 19 → 25 (listed with the judge,
  D80).
- **12 rejected, their file's contacts kept:**
  - a failing rate row added (8): `STYLE100/Penguin_Walk` (3: 0.5 on gen-1, gen-2, gen-3, slide 177 to 270 mm),
    `STYLE100_SIDE/Monk_SideLeft` (3: 0.5 on gen-1 to gen-3, slide 186 to 279 mm), `STYLE100/OnPhoneRight_Walk` (the
    knight at 1.5, slide 139.5 mm, skate 27.0), `STYLE100/Robot_Walk` (gen-0 at 0.5, slide 107.5 against 105.9),
    `STYLE100_RUN/WhirlArms_Run` (gen-0 at 0.5, slide 110.1 against 105.9), `STYLE100_SIDERUN/Old_SideRunRight` (gen-1
    at 0.5, slide 259.0 against 253.4), `STYLE100_RUN/Teapot_Run` (gen-0 at 2, skate 21.0 against 17.5),
    `STYLE100_RUN/BigSteps_Run` (gen-2 at 1.5, skate 43.7 against 43.4; it would have dropped 5 rows);
  - a judge fail added (3), each as the judge words it: `QUATERNIUS_SHARDFALL/Crouch_Fwd_Loop` on gen-1 ("slide 105 on
    its own body → 254 played on this one"), `STYLE100/StartStop_Walk` on gen-0 ("slide 221 → 108", the fail D127 saw
    move from the knight to gen-0; it would have dropped 3 rows), `STYLE100_SIDERUN/WhirlArms_SideRunLeft` on the knight
    ("skate 36.9 → 20.8", past the knight's lower fail level; it would have dropped 3 rows);
  - a worse QA verdict (1): `STYLE100_SIDE/Skip_SideLeft` (pass → warn).
- **What the six readings new to core change** (counted after review, from step 1's checks): 31 of the 45 adopted
  readings are among them (`planted-quarter` 19, `sole-planted-quarter` 7, `lower-quarter` 3, `lower` 2). Restricted
  to the six the chain takes, the rule gives 31 of the 126 loops another reading, not 57; of the 45 adopted, 14 would
  keep theirs, 10 take another (each with other contacts, so unmeasured on the sweep) and 21 keep the file's.

## Step 3: the mechanism and the writers

- **Is there a per-clip route already?** No. Every library clip's contacts were `by: "detected"`, and core detects a detected clip's contacts again wherever it plays it (`playable` calls `measureFacts`,
  which sets aside contacts a tool detected). A reading written into a file as `detected` would be thrown away at play:
  the rate sweep (which reads the file, `rateClip`) would measure contacts no game plays, and `npm run facts -- --check`
  would call the clip stale. The format has two words for contacts, `detected` and `labelled` (spec/MOTION.md §7.1:
  "whether a tool detected them or a person or source labelled them"), and the spec is frozen (D119), so a third word or
  a new field (`requires`) is a format change: not taken here.
- **The route built:** a set's import spec names, per clip by slug, one of core's readings (`contacts: { Quail_SideLeft:
  "sole-planted-quarter", ... }` in `tools/import/sets.ts`, typed by core's `clip.ContactReading`); the importer writes
  that clip's contacts with @m3a/library's `withReading` (core's `clip.readContacts` on the motion as kept, written
  `labelled`, its facts measured from them) and records the name in the set's `_import.json` (`contacts`, an enum of
  core's names in `tools/import/import.schema.json`). It refuses a name on a clip the owner adopted, on a one-shot, on a
  clip with a root of its own, on a loop tagged off its feet (core's `OFF_FEET`: D108 keeps it the strict reading), a
  reading that doesn't stand (both feet plant, a foot down a fifth of the loop: core's `stands`, so a name that reads no
  contact, as `planted` on `CMU_CURATED/Waiting_Loop`, isn't written as empty `labelled` contacts that would never be
  read again), and a name for a clip the set doesn't write (`withReading`, `specReading`, `unwritten`, each an error of
  the import; the two D108 refusals added after review, with tests). `labelled` is what makes the reading the one
  every reader plays: `playable`, `measure`, the facts check, the sweep and the judge take it as given; a game that
  retimes the loop gets it moved with the keys (core's retime), which is why the rule held each reading that way too.
- **What `labelled` misstates (two reviewers; the owner's call is needed before D129 lands):** spec/MOTION.md §7.1
  (frozen, D119) says `by` tells "whether a tool detected them (WP-2.2) or a person or source labelled them". These 45
  a tool read: core's detector, with a parameter a tool rule chose (`chooseReading`), kept under an automated veto
  (the sweep, the judge, QA). No person chose them, and the sources (100STYLE's and CMU's captures) label no contacts.
  So `labelled` misstates their provenance (Principle 10), and nothing in the clip says otherwise: the reading's name
  is only in the set's `_import.json`, and the clip's provenance reads producer `m3a-import@1` as before. A game or an
  agent loading `STYLE100/Balance_Walk.json` reads `{"by":"labelled",...}` and can't tell these from a source's labels;
  an edit to the motion no longer reads them again. (Procedural gaits and recipes write `labelled` for contacts their
  generator authors, but there the generator is the source.) `labelled` is the one word that makes every reader play
  the chosen reading without a format change: core reads a `detected` clip's contacts again wherever it plays it. The
  options, for the owner:
  1. Amend §7.1 (a logged decision and the freeze's rerun) so `labelled` covers a writer's named reading of a tool's,
     and name the reading in the clip (an optional informational field, in `facts` beside `captured`, say): the 45
     land, their provenance read from the clip. The way to keep the 45 rows honestly.
  2. Land as written, the misstatement logged: not recommended.
  3. Hold the data: land the code (core's named readings, `withReading` with its refusals, the rule, the import spec's
     `contacts`) with no names in `tools/import/sets.ts`; the 45 keep their detected contacts and the baselines stay
     as at faf3fe4 (the pins of the 45 in `readings.test.ts` and the sets' data go with it).
  Until the owner answers, the data change is `blocked-owner`; the code doesn't depend on it.
- **No `chosen` route in the tree (said plainly after the second review):** nothing here writes, reads or defines a
  third `by` word (`chosen`) or a `contacts.reading`. `git diff -- spec/` is empty; spec/frozen.json is still D119
  (`npm run doctrine`: "spec 2.0-rc: 14 files frozen (D119)"), so there is no refreeze and no D129 in it; core's
  validator (`validate/clip.ts`, M2-E016), its `Contacts` type, `measureFacts` (which detects again any contacts not
  `labelled`), the library's `measure` and the intake's submit check are as at faf3fe4. It wasn't built because it
  changes the frozen format, which is the owner's call, and the owner hasn't answered: their latest message asks what
  is needed so they can approve or not. So the tree holds option 2's data, staged: landing it as it stands *is* option
  2. Option 1 would also reword the comments that say `labelled` means a source's labels: core's
  `clip/facts.ts` (`measureFacts`' doc), `animator/animator.ts` (`playable`'s doc) and the library's `measure` doc.
- **What a new word would cost readers (measured after the second review, for the owner's call):** on core as at
  0.55.3 (its validator unchanged here), `validate(STYLE100/Balance_Walk, { mode: "read" })` with `contacts.by:
  "chosen"` fails (M2-E016: `contacts.by "chosen" is not "detected" or "labelled"`), with a `contacts.reading` key
  fails (M2-E016: `"reading" is not an end`: `contacts` is a closed object), and with `facts.reading:
  "planted-quarter"` passes, in read and in lint mode. A new `by` word or a key in `contacts` isn't an unknown field
  spec §4's "readers accept unknown fields" covers: every 0.55.3 reader would refuse the 45 clips, and one that skipped
  validation would detect their contacts again (`measureFacts` keeps `labelled` alone). Option 1 as worded (`labelled`
  amended in §7.1, the reading named in `facts`, an open object) passes every deployed reader; a new word would need a
  compatibility path in the spec (a `requires` entry, or a format minor version and what 2.0 readers do with it).
- **The named readings held by the facts check (after the second review):** `npm run facts -- --check` took a named
  loop's `labelled` contacts as given, so it compared them with themselves: planted on `STYLE100/Balance_Walk` with
  its facts measured again (`withFacts`), footL ending 0.1 s sooner, the `planted` reading in place of its
  `planted-quarter`, or one foot's contacts alone each gave 0 stale (and `validate` ok); only T1's pins in
  `readings.test.ts` and `npm run import -- --check` (not in CI) would see them. The check (`tools/facts/facts.ts`
  `namedReadings`, `checkFacts`) now holds every clip whose set's `_import.json` names a reading to that reading, read
  on its motion today by `withReading`: each plant is stale ("its contacts aren't the reading "planted-quarter" its
  set's import record names (D129)"), the 45 as written are not (0.27 s for the 45). `facts.test.ts` plants the three
  and shows each passes without the record's name. It reads the name from `_import.json` because the clip names none;
  under option 1 it could read the clip's, and under option 3 it checks nothing.
- **The facts' `travel` moves:** an in-place loop's `travel` is read from its contacts (D34's first pass), and labelled
  contacts are that pass, so 44 of the 45 clips' `travel` moves (`TwoFootJump_SideRunLeft`'s doesn't), its length
  ×0.99 to ×1.78 (corrected after review: the first draft said "slightly"). The three backward runs most:
  `PendulumHands_RunBack` `[-55.7, -8.7]` → `[-99.2, -13.9]` (×1.78), `Elated_RunBack` `[-97.6, -10.3]` →
  `[-173.2, -15.7]` (×1.77), `DragLeftLeg_RunBack` `[-31.3, 20.8]` → `[-56.3, 29.3]` (×1.69); then `TwoFootJump_Walk`
  ×1.29, `Penguin_SideRunRight` ×1.19, `Rocket_Run` ×1.18, `StartStop_RunBack` ×1.16; the other 37 ×0.99 to ×1.11.
  Its heading turns 11.3° on `RaisedLeftArm_SideRunLeft` (`[15.6, -103.4]` → `[37.5, -103.8]`) and 6.1° on
  `DragLeftLeg_RunBack`, under 5° on the rest. The travel's own speed (its length over the loop's duration) moves
  nearer the captured speed on 17, further on 24 (`LawnMower_SideRunLeft` most: 150 → 160 against 127), about the same
  (within 0.05) on 4. `speed` stays the captured one on every one. The sensors' `describe` reads `facts.travel` for how
  far and which way a clip goes.
- **Written by the writers:** `npm run import -- --set X` for CMU_CURATED, STYLE100, STYLE100_RUN, STYLE100_BACK,
  STYLE100_BACKRUN, STYLE100_SIDE and STYLE100_SIDERUN (the CMU corpus fetched first, `npm run corpora -- cmu --fetch`,
  57.9 s): 45 clips' contacts (and `travel`), 7 `_import.json`, 7 `_set.json` (content ids), the lock; each set's
  `--check` then 962 files byte for byte. `npm run index` once: serial 5, a version 2 of each of the 7 sets. The 45
  files match the contacts step 2 measured, interval for interval.

## Done when, with the proof

1. **The rule is written before the sweep is read, and reads nothing of it.** Above, first section; `readings.test.ts`
   holds that `readings.ts` imports `@m3a/core` alone and its code names no file, no rates and no sweep, and that
   `chooseReading` takes the loop, its rest and its captured speed. In full (`npm run test:full --
   tools/facts/readings.test.ts`) the rule run again on all 126 loops gives the same 126 results: the 57 choices, and
   the 69 file-keepers by the same three reasons (12, 20, 37; extended after review from the 57 alone; with B1, 359 s
   beside other checks).
2. **Qualifying readings counted:** 57 of the 126 loops have a reading by the rule different from their file's (12 keep
   theirs with no captured speed, 20 with no reading that passes, 37 because their file's is nearest).
3. **Adopted only where the sweep, the judge and QA find it no worse:** 45 adopted, 12 rejected (8 a failing row added,
   3 a judge fail added, 1 a worse QA verdict), each named with its numbers in step 2. Before that veto the rule's 57
   readings take their 174 failing rows to 125 (61 dropped, 12 added on 8 loops), add 3 judge fails (2 gone) and one
   worse verdict; the veto reads each loop's own result, so the 45's "0 added" holds by construction, and some of its
   calls turn on margins near the noise (`BigSteps_Run`'s gen-2 row at 1.5, skate 43.7 against 43.4, where its reading
   would have dropped 5 rows; `Robot_Walk`'s gen-0 row at 0.5, slide 107.5 against 105.9).
4. **Rows:** `npm run sweep -- --rates --baseline`: 428 failing rows (0 added, 45 dropped) from 473; 108 loops answered
   from 126 (18 answers dropped, their loops failing no row). The distribution (24,330 rows): 22,996 pass (22,917), 906
   warn (940), 428 fail (473). By rate 153 / 35 / 31 / 55 / 154 (164 / 45 / 40 / 61 / 163); by body gen-0 68, gen-1 75,
   gen-2 74, gen-3 71, the mannequin 66, the knight 74 (74, 79, 80, 73, 71, 96). `--check` after: 0 rows not baselined,
   0 baselined rows passing, 108 of 108 failing loops answered (run again after review: the same, 81.5 s). By cause
   (loops, rows): edge-slide 18, 53 (18, 54); knight-feet 21, 29 (31, 41); short-contacts 12, 40 (18, 61);
   steps-merge 26, 168 (28, 180); stride-varies 3, 35 (same); swing-stands 23, 83 (24, 87); unheld-step 5, 20 (4,
   15). Six of D127's 18 short-contacts loops fail no row
   now (DragLeftLeg_RunBack, Elated_RunBack, PendulumHands_RunBack, Rocket_Run, LawnMower_SideRunLeft,
   RaisedLeftArm_SideRunLeft).
   - **Read honestly, not only counted:** of the 84 rows the 45 adopted loops still fail, 53 read further past their
     fail level than before, 21 less far, 10 the same; 20 of the 45 have at least one such row (StartStop_WalkBack's
     mannequin row at 0.5: slide 380.0 → 406.7 mm against 220.7; Sweep_Walk's knight row at 0.5: 107.7 → 129.8 against
     98.2; Flapping_SideRight's knight row at 2: skate 17.1 → 25.7 against 16.2). The task's bar was "adds no failing
     row", which they meet; a stricter bar (no failing row reads worse) would adopt 25 and drop fewer rows.
5. **Answers:** 25 of the 27 adopted loops that still fail had rows or readings that moved; each is answered again from
   its rows read back to the motion (the worst row's finding: the sensors' stance against the loop's contacts as played,
   where the foot drifts, how high, how fast), written into `rates.json` with the sweep's own writer. Two changed cause:
   `STYLE100_SIDE/Quail_SideLeft` steps-merge → unheld-step (its new contacts are 0.28 s apart at 2, so the sensors no
   longer join two contacts: the foot stands 0.28 s between them, 71% of the time under their bar, and moves 271 mm),
   `STYLE100_SIDERUN/Robot_SideRunRight` steps-merge → edge-slide (204 mm dragged along the floor after its contact
   ends, at 3.78 H0/s). The method checks itself: on the two adopted loops whose rows didn't move
   (StartStop_RunBack, LimpRight_SideRunLeft) it writes D127's answers word for word. `rates-answers.test.ts` passes
   (each answer's bodies, rates and quoted readings its rows').
6. **The judge** on the six sweep skeletons (`npm run sweep -- gen-0 gen-1 gen-2 gen-3 quaternius-mannequin-m
   kaykit-knight --clip ID`, all 45): 267 of 270 pairs pass; the 3 that fail are the knight's seam (seamVelocity on
   RaisedLeftArm_SideRunLeft, Teapot_SideRunLeft, Robot_SideRunRight), failing before too; one fail gone
   (Elated_RunBack on gen-3, skate); 25 warns listed against 19 before (D80): by metric 13 new on 11 pairs, 7 gone (a
   warn whose value moved, `HandsInPockets_Run`'s seamVelocity on gen-0 1289 → 1290, is neither). The command's rows
   equal step 2's (run again after review: all 45 files' rows the same, 73 s).
7. **QA:** verdicts 1,015 pass, 229 warn, 154 fail (1,014 / 230 / 154): DragLeftLeg_RunBack warn → pass, no other
   verdict moves. `packages/sensors/fixtures/baseline.json` rewritten for 44 of the 45 (TwoFootJump_SideRunLeft's
   readings don't move): the planted-feet readings move both ways, as the contacts move the root the sensors read the
   world by (slide 22 worse, 22 better; skate 24 worse, 18 better; skateMean 21 worse, 23 better); four clips read a
   skate where they read 0 before (Elated_RunBack 14.4, PendulumHands_RunBack 8.37, Rocket_Run 15.9,
   RaisedLeftArm_SideRunLeft 12.9 cm/s: a contact now long enough to read, D122's "a zero that measured nothing").
   `library/baselines/distributions.json`: slide p95 123 → 122, skate p95 22.5 → 22.4, skateMean p95 19.8 → 19.4
   better; skate p50 5.31 → 5.36 and skateMean p50 4.75 → 4.76 worse, which "may only improve" admits only by a logged
   decision (D104, D108 and D122 did so): D129's draft below gives the reason. `docs/LIBRARY.md` written by the same run.
   `npm run qa -- --check` and `npm run qa -- library --check` pass after (and again after review).
8. **Everything else holds:** `npm run facts -- --check` 1,398 clips, 0 stale; `npm run index -- --check` and `npm run
   library -- check` byte for byte; `npm run test:full -- bench/graders/B1` 11 of 11; T2's library sweeps in full
   (contact, gaits, sidesteps, siderun, sweep, dedup, actions, describe-tokens: 42 tests) and the graders B2 to B8, the
   runner, intake check and adopt and the rate sweep in full (87 tests) pass; `npm run check` passes. After review
   (the refusals, the wording, the tests): `npm run check` passes; `npm test` 1,267 passed, 33 skipped, 69.7 s; each
   of the 7 sets' `npm run import -- --set X --check` byte for byte (962 files); `npm run index -- --check`, `npm run
   library -- check` and `npm run facts -- --check` (1,398 clips, 0 stale) pass. After the second review (the facts
   check's rule for named readings, the tests' pins and titles, the README): each of the 7 sets' `npm run import --
   --set X --check` byte for byte (162, 99, 102, 102, 102, 198 and 197 files: 962); `npm run facts -- --check` 1,398
   clips, 0 stale, the 45 held to their named readings; `npm run index -- --check` and `npm run library -- check`
   pass; `npm run qa -- --check` and `npm run qa -- library --check` 1,015 / 229 / 154, as baselined; `npm run sweep --
   --rates --check` 428 failing rows, 0 not baselined, 108 of 108 loops answered (60.7 s); `npm run vectors --
   --check` 16 files byte for byte; `npm run conformance -- --impl ts` tiers 1a, 1b, 2 and 3, 3,662 cases; `npm run
   doctrine` 8 checks (spec 2.0-rc: 14 files frozen (D119), 128 decisions); `npm run check` passes; `npm test` 1,268
   passed, 33 skipped, 64.0 s.

## The WP entry (PLAN.md §8.1)

#### WP-F.9 Honest per-loop contact readings for the rate sweep's failing loops
- **Owns:** `tools/facts/readings.ts` (new), `tools/facts/readings.test.ts` (new), `packages/core/src/clip/facts.ts`
  (`readContacts`, `CONTACT_READINGS`), `packages/core/src/clip/index.ts`, `packages/core/test/clip.test.ts`,
  `packages/library/src/facts/index.ts` (`withReading`), `packages/library/src/index.ts` (its export),
  `packages/library/test/library/facts.test.ts`, `tools/facts/facts.ts` (`namedReadings`, the named-reading rule in
  `checkFacts`), `tools/facts/facts.test.ts`, `tools/import/sets.ts` (`contacts` per spec), `tools/import/import.ts`
  (`specReading`, `unwritten`, the record's `contacts`), `tools/import/import.schema.json`, `library/sets/` of
  CMU_CURATED, STYLE100, STYLE100_RUN, STYLE100_BACK, STYLE100_BACKRUN, STYLE100_SIDE and STYLE100_SIDERUN (through
  `npm run import`), and what the writers write from them: `library/sets.lock.json`, `library/index.json`,
  `library/baselines/rates.json`, `packages/sensors/fixtures/baseline.json`, `library/baselines/distributions.json`,
  `docs/LIBRARY.md`; `library/README.md` (two sentences)
- **Also touches:** `tools/run/changed.ts` and `tools/run/run.test.ts` (`test:changed`'s library rule runs the readings'
  test too)
- **Needs:** WP-F.7 (D127: the answers and `holds`), WP-F.3 (D123: the rate sweep), WP-F.2 (D122), D104, D108
- **Size:** M (610 new lines, tests included: readings.test.ts 217, readings.ts 120, tools/import 66 (import.ts 33,
  sets.ts 31, the schema 2), core's facts.ts 35 and index.ts 1, clip.test.ts 43, the library's facts 35 and index 2,
  its facts.test.ts 23, tools/facts/facts.ts 36 and facts.test.ts 24, README 6, changed.ts 1, run.test.ts 1; 40
  removed; plus the data the tools wrote: 45 clips and
  14 set files (+187 −142), rates.json +99 −162 (45 rows and 18 answers gone, 25 answers rewritten), index.json +148
  −1, the lock, the sensors' baseline 44 rows, distributions 4 lines, LIBRARY.md 4 lines)
- **Carry:** none
- **Trigger:** D127's "per-loop readings would fix 167 rows on 68 loops, none added, each fitted to the sweep: not
  taken", and the owner's goal: fix through the writer what the contacts can fix, by a reading chosen on D108's own
  criteria, not on the sweep's result
- **Build:**
  - Twelve named contact readings of an in-place loop (`clip.readContacts`, `CONTACT_READINGS`: the points, the
    velocity, the "still"): the six measureFacts and its fallbacks take, each the same as the chain where its path
    fires, and six the chain never takes (a quarter of the body's speed as "still", the lower foot's velocity under the
    refinement's own), readings D122 weighed, new to core.
  - The rule (`chooseReading`): each reading held to D108's bar at the loop's own speed and retimed at 0.5, 0.75, 1.5
    and 2 (both feet, a foot down a fifth of the loop, both ankles within 10% of H0), and of those that pass the one
    whose ground speed is nearest the captured speed; written down before the sweep was read.
  - Each loop whose chosen reading differs measured on the rate sweep, the judge and QA; adopted where none is worse.
  - The adopted readings written by the importer from a name in the set's import spec (`labelled`, the name in
    `_import.json`); the baselines rewritten by their tools; the answers of the loops that still fail written again
    from their rows.
- **Done when:**
  1. The rule is written in the record before any sweep is read for it, its code reads nothing of the sweep, and it
     gives the same choice again from each loop's motion.
  2. Every loop whose chosen reading differs is measured on its 30 rate rows, its 6 judge pairs and its QA verdict, and
     adopted only where it adds no failing row, no judge fail and no worse verdict; the rest keep their contacts, each
     named with why; the rule's effect before that veto is stated beside the outcome after it.
  3. The adopted readings are written by `npm run import` from the import spec's names, each set regenerating byte for
     byte with `--check`, the import refusing a name it can't honour (an adopted clip, a one-shot, a root of its own, a
     loop tagged off its feet, a reading that doesn't stand, a clip the set doesn't write); `npm run facts -- --check`
     holds each loop its set's import record names a reading for to that reading's contacts.
  4. `npm run sweep -- --rates --baseline` adds 0 rows; every loop that still fails is answered with its rows' numbers.
  5. QA's verdicts are no worse; the sensors' baseline and the distributions are rewritten with the reason (D129).
  6. B1's known-good passes in full; T0, T1 and T2's library sweeps pass.
- **Verify:** `npm run check`; `npm test`; `npm run test:full -- tools/facts/readings.test.ts bench/graders/B1`; `npm run
  import -- --set <each of the 7> --check`; `npm run index -- --check`; `npm run facts -- --check`; `npm run qa --
  --check`; `npm run qa -- library --check`; `npm run sweep -- --rates --check`; `npm run sweep -- gen-0 gen-1 gen-2
  gen-3 quaternius-mannequin-m kaykit-knight --clip <each of the 45>`

## Draft decision

## D129 · 2026-10-22 · The rate sweep's failing loops read by D108's bar and their captured speed: 45 loops given a named contact reading, labelled, 45 rows gone (the owner's call first)

- **Principle:** 3, 8, 10 (the `labelled` question), 11, D104, D108, D119 (spec §7.1, frozen), D122, D123, D127 (its
  "per-loop readings ... fitted to the sweep: not taken"), WP-F.9
- **Call:**
  - **The rule, chosen before the sweep was read:** for each of the 126 loops that fail a rate-sweep row, the file's
    reading and twelve named ones (ankle, ball and toe or the whole sole; the planted feet's or the lower foot's
    velocity; the refinement's "still", half or a quarter of the body's speed) are held to D108's bar at the loop's own
    speed and retimed at 0.5, 0.75, 1.5 and 2, read afresh and moved with the keys: both feet plant, a foot is down a
    fifth of the loop, the planter holds both ankles within 10% of H0. Of those that pass, the one whose ground speed,
    to a tenth, is nearest the loop's captured speed; a tie keeps the file's, then the earlier name in
    `CONTACT_READINGS` (the order decided 11 of the 45 adopted, between readings whose contacts differ); with no
    captured speed, or none that passes, the file's. 57 loops get another reading; in full the rule gives the same 126
    results again from the files.
  - **An extension of core's readings, put to the owner as one:** six of the twelve are readings measureFacts and its
    fallbacks take (`planted`, `planted-half`, `lower-half`, `sole-planted`, `sole-planted-half`, `sole-lower-half`);
    the other six (a quarter of the body's speed as "still", or the lower foot's velocity under the refinement's own)
    no path of the chain takes. D122 weighed them before the rate sweep existed, so they aren't fitted to it, but they
    are new to core. 31 of the 45 adopted readings are among them (`planted-quarter` 19, `sole-planted-quarter` 7,
    `lower-quarter` 3, `lower` 2). Restricted to the six the chain takes, the rule gives 31 loops another reading, not
    57; of the 45, 14 keep theirs, 10 take another and 21 the file's.
  - **Then vetoed by the sweep, the judge and QA:** each of the 57 played on its 30 rate rows, its 6 judge pairs and its
    QA verdict. Before the veto the 57 readings take their 174 failing rows to 125 (61 dropped, 12 added on 8 loops),
    add 3 judge fails (2 gone) and one worse verdict. The veto reads each loop's own result, so "0 added" after it holds
    by construction: 45 adopted (no row, judge fail or worse verdict added: 45 rows dropped); 12 keep their file's (8
    add a failing row, 3 a judge fail, 1 a worse verdict: StartStop_Walk's would again move its judge fail to gen-0,
    D127), which would have dropped 16 rows; some calls turn on margins near the noise (BigSteps_Run's gen-2 row at
    1.5, skate 43.7 against 43.4, where it would drop 5).
  - **Written by the importer, labelled, which misstates them:** core detects a `detected` clip's contacts again
    wherever it plays it, so a reading written as `detected` would be thrown away at play. A set's import spec names the
    reading per clip; the importer writes it `labelled` (@m3a/library's `withReading`, which refuses a reading D108
    wouldn't keep: one that doesn't stand, a loop tagged off its feet) and records the name in `_import.json` (a schema
    enum of core's names). `playable`, the facts check, the sweep and the judge then read the same contacts; a retimed
    loop moves them with its keys. But spec §7.1 (frozen, D119) says `labelled` means a person or source labelled them,
    and a tool read these: the clip misstates its contacts' provenance (Principle 10), and only `_import.json` names
    the reading. An edit to the motion doesn't read them again. **Owner's call before this lands:** (1) amend §7.1 and
    name the reading in the clip (an optional field), the way to keep the 45 honestly; (2) land as written, the
    misstatement logged (not recommended); (3) hold the data, land the code. Until answered, the data is
    `blocked-owner`. A name in `facts` passes 0.55.3's validator in read and lint mode; a new `by` word or a
    `contacts.reading` key fails it (M2-E016), so would need a compatibility path in the spec.
  - **The facts' travel moves:** an in-place loop's `travel` is read from its contacts, so 44 of the 45 move, ×0.99 to
    ×1.78 in length (PendulumHands_RunBack, Elated_RunBack, DragLeftLeg_RunBack ×1.69 to ×1.78; TwoFootJump_Walk
    ×1.29; Penguin_SideRunRight, Rocket_Run, StartStop_RunBack ×1.16 to ×1.19; the other 37 within 11%), and
    RaisedLeftArm_SideRunLeft's heading turns 11°; `speed` stays captured. The sensors' `describe` reads the travel.
  - **What it gives:** 473 → 428 failing rows (0 added, 45 dropped), 126 → 108 loops answered; 18 loops fail no row
    (6 of D127's short-contacts, 12 of its knight-feet, edge-slide and swing-stands); 25 answers written again from
    their rows (two causes change: Quail_SideLeft unheld-step, Robot_SideRunRight edge-slide). The judge: one fail gone,
    none added, 6 warns more on the 270 pairs (13 new on 11 pairs, 7 gone). QA: DragLeftLeg_RunBack warn → pass,
    nothing worse.
  - **What it doesn't:** of the 84 rows the 45 still fail, 53 read further past their fail level (20 loops; the worst
    Flapping_SideRight on the knight at 2, skate 17.1 → 25.7 cm/s against 16.2). The bar was "adds no failing row".
  - **The baselines:** the sensors' readings move on 44 clips, both ways (slide 22 worse and 22 better, skate 24 and 18,
    skateMean 21 and 23); the distributions' p95s improve (slide 123 → 122, skate 22.5 → 22.4, skateMean 19.8 → 19.4)
    and two p50s worsen in their last digits (skate 5.31 → 5.36, skateMean 4.75 → 4.76), admitted here: four clips that
    read a skate of 0 (no contact long enough to read) now read one (8.4 to 15.9 cm/s), and the contacts that hold both
    feet move the root the sensors read the world by.
  - **None of the clips the briefs' agents pick moves:** the 45 are 100STYLE's and one CMU loop, opt-in tiers; the
    core jogs, Mesh2Motion's runs and the Quaternius sets keep their contacts byte for byte (Mesh2Motion's keyed loops
    have no captured speed to grade by; the one Quaternius loop chosen added a judge fail). B1's known-good passes.
- **Why:** a reading picked by the sweep's own result is fitted to the sweep; one picked by D108's criteria and the
  captured speed, and only then vetoed where the sweep, the judge or QA find it worse, is the reading the loop's motion
  supports (the veto only keeps a file's contacts, never picks among readings). Where the sweep, the judge or QA say
  otherwise, the file's contacts stay and the answer says why.
- **Answered:** no. The owner's call is needed before it lands: the `labelled` route first (options above), then the
  six readings new to core, then the bar ("no failing row added", against "no still-failing row reads worse"). No
  `chosen` word or `contacts.reading` was built (a format change, and it would fail every 0.55.3 reader: M2-E016); a
  name in `facts` passes them. The facts check holds each named loop to its reading whichever way it goes.
- **Landed in:** (integrator)

## Changelog lines, by part

- **core:** `clip.readContacts(clip, R, reading)` and `clip.CONTACT_READINGS`: twelve named contact readings of an
  in-place loop (the points that read a foot, the velocity, the "still"): the six `measureFacts` and its fallbacks
  take, and six more it never takes (a quarter of the body's speed as "still", the lower foot's velocity under the
  refinement's own) (D129).
- **library (package):** `withReading(clip, R, reading)`: a clip with its contacts written by a named reading of core's,
  labelled, and its facts measured from them; it refuses a reading that doesn't stand and a loop tagged off its feet
  (D129).
- **tools:** an import spec names, per clip, the reading its contacts are written by; the importer writes it labelled,
  records it in `_import.json` (`contacts`, in the record's schema) and refuses a name it can't honour; `tools/facts/
  readings.ts` holds the rule that chooses a reading by D108's bar and the captured speed (D129). `npm run facts --
  --check` holds each loop its set's import record names a reading for to that reading's contacts, so an edit to them
  is stale even with its facts measured again (D129). `test:changed` runs the readings' test on a library change.
- **library (data):** 45 loops of STYLE100's sets and CMU_CURATED carry a named reading's contacts: the rate sweep's
  failing rows 473 → 428 (0 added), 108 loops answered (126), 25 answers rewritten; QA 1,015 / 229 / 154; the sensors'
  baseline (44 clips) and the distributions rewritten with D129's reason; index serial 5.

## Files changed

- New: `tools/facts/readings.ts`, `tools/facts/readings.test.ts`, `docs/lane-F9.md` (this record, untracked).
- Code: `packages/core/src/clip/facts.ts`, `packages/core/src/clip/index.ts`, `packages/library/src/facts/index.ts`,
  `packages/library/src/index.ts`, `tools/import/import.ts`, `tools/import/sets.ts`, `tools/import/import.schema.json`,
  `tools/facts/facts.ts`, `tools/run/changed.ts`.
- Tests: `packages/core/test/clip.test.ts` (four of the six readings the chain takes give its contacts where each
  fires on a library loop; `sole-planted-half` and `sole-lower-half`, reread after the sole pass, fire on none, so they
  and the six the chain never takes are shown only coinciding: for those two the equivalence is the code's, corrected
  after the second review; D127's keep list reads the default chain on the two loops now labelled and pins its contacts
  there exactly, as their files held them at faf3fe4), `packages/library/test/library/facts.test.ts` (`withReading`,
  and its refusals), `tools/facts/facts.test.ts` (the facts check holds a named loop to its reading: an edit, another
  reading, one foot), `tools/run/run.test.ts`.
- Data, by the writers: the 45 clips below, `_import.json` and `_set.json` of the 7 sets, `library/sets.lock.json`,
  `library/index.json`, `library/baselines/rates.json`, `packages/sensors/fixtures/baseline.json`,
  `library/baselines/distributions.json`, `docs/LIBRARY.md`; `library/README.md` (two sentences: the 45 named as a
  tool's reading written `labelled`, the owner's call, and the facts check holding them to it).
- The 45 clips (reading; captured speed; ground speed file → now, % of H0 a second; the worst pull of H0 over the five
  speeds; the share of the loop a foot is down; failing rows before → after):

| Clip | Reading | Captured | Ground | Pull | Down | Rows |
|---|---|---:|---|---:|---:|---|
| `CMU_CURATED/Frankenstein_Walk_Loop` | sole-planted-quarter | 47 | 43.7 → 43.8 | 4.1% | 1.00 | 3 → 3 |
| `STYLE100/Balance_Walk` | planted-quarter | 36 | 36.6 → 36.3 | 1.1% | 0.99 | 3 → 3 |
| `STYLE100/Sweep_Walk` | planted-quarter | 69 | 70.1 → 69.8 | 2.6% | 1.00 | 2 → 2 |
| `STYLE100/TwoFootJump_Walk` | lower-quarter | 61 | 51.6 → 54.7 | 2.3% | 0.69 | 5 → 2 |
| `STYLE100_BACK/DragRightLeg_WalkBack` | planted-quarter | 50 | 45.4 → 48.6 | 2.7% | 1.00 | 4 → 4 |
| `STYLE100_BACK/LeanRight_WalkBack` | planted-quarter | 71 | 68.9 → 72.8 | 3.0% | 0.96 | 1 → 1 |
| `STYLE100_BACK/Old_WalkBack` | planted-quarter | 23 | 22.1 → 22.4 | 2.2% | 0.77 | 6 → 5 |
| `STYLE100_BACK/Robot_WalkBack` | planted-quarter | 28 | 27.4 → 28.2 | 1.3% | 1.00 | 1 → 0 |
| `STYLE100_BACK/Rushed_WalkBack` | planted-half | 117 | 124.4 → 119.8 | 6.5% | 1.00 | 1 → 0 |
| `STYLE100_BACK/StartStop_WalkBack` | planted-quarter | 19 | 17.4 → 18.7 | 3.9% | 0.98 | 16 → 16 |
| `STYLE100_BACKRUN/DragLeftLeg_RunBack` | lower | 101 | 40.8 → 98.4 | 7.7% | 0.92 | 6 → 0 |
| `STYLE100_BACKRUN/Elated_RunBack` | lower-half | 189 | 128.5 → 166.1 | 6.3% | 0.82 | 7 → 0 |
| `STYLE100_BACKRUN/PendulumHands_RunBack` | lower | 131 | 82.2 → 125 | 3.3% | 0.90 | 1 → 0 |
| `STYLE100_BACKRUN/Rushed_RunBack` | planted-half | 129 | 136.6 → 129.1 | 6.7% | 0.94 | 1 → 0 |
| `STYLE100_BACKRUN/StartStop_RunBack` | planted-quarter | 57 | 54.5 → 56 | 1.9% | 0.78 | 3 → 3 |
| `STYLE100_RUN/HandsInPockets_Run` | planted-half | 172 | 194.1 → 177.8 | 7.0% | 0.98 | 1 → 0 |
| `STYLE100_RUN/Lunge_Run` | planted-quarter | 71 | 67.9 → 69.1 | 4.7% | 0.93 | 3 → 3 |
| `STYLE100_RUN/Rocket_Run` | sole-planted-half | 220 | 216.6 → 209.7 | 3.6% | 1.00 | 3 → 0 |
| `STYLE100_RUN/WildLegs_Run` | planted-quarter | 119 | 108.1 → 108.4 | 3.0% | 0.55 | 1 → 0 |
| `STYLE100_SIDE/Balance_SideRight` | sole-planted-quarter | 27 | 23.8 → 24.2 | 3.5% | 0.97 | 4 → 2 |
| `STYLE100_SIDE/CrowdAvoidance_SideLeft` | planted-quarter | 31 | 27.3 → 29 | 2.2% | 1.00 | 3 → 3 |
| `STYLE100_SIDE/Flapping_SideRight` | planted-quarter | 52 | 49.5 → 50.8 | 2.8% | 1.00 | 1 → 1 |
| `STYLE100_SIDE/LeanBack_SideRight` | planted-quarter | 44 | 42.3 → 42.6 | 1.6% | 1.00 | 2 → 1 |
| `STYLE100_SIDE/LimpLeft_SideRight` | planted-quarter | 43 | 40.8 → 41.4 | 4.0% | 1.00 | 5 → 5 |
| `STYLE100_SIDE/LimpRight_SideLeft` | planted-quarter | 57 | 51.9 → 54.2 | 3.4% | 0.98 | 1 → 1 |
| `STYLE100_SIDE/Old_SideRight` | sole-planted-quarter | 18 | 17.2 → 18.1 | 3.6% | 1.00 | 3 → 3 |
| `STYLE100_SIDE/Quail_SideLeft` | sole-planted-quarter | 43 | 37.8 → 41.5 | 2.4% | 0.79 | 7 → 5 |
| `STYLE100_SIDE/Robot_SideLeft` | lower-quarter | 33 | 30.6 → 32.5 | 1.2% | 1.00 | 4 → 4 |
| `STYLE100_SIDE/Skip_SideRight` | planted-quarter | 75 | 80.1 → 78.6 | 2.1% | 0.66 | 1 → 1 |
| `STYLE100_SIDE/Strutting_SideLeft` | planted-quarter | 38 | 36.3 → 36.5 | 1.7% | 1.00 | 1 → 0 |
| `STYLE100_SIDE/TogetherStep_SideLeft` | planted-quarter | 45 | 42.3 → 42.8 | 1.9% | 0.99 | 1 → 0 |
| `STYLE100_SIDE/WalkingStickLeft_SideLeft` | sole-planted-quarter | 35 | 32.2 → 32.3 | 3.1% | 0.97 | 1 → 1 |
| `STYLE100_SIDE/WiggleHips_SideLeft` | lower-quarter | 24 | 22.2 → 22.5 | 4.1% | 1.00 | 4 → 4 |
| `STYLE100_SIDE/Zombie_SideLeft` | sole-planted-quarter | 37 | 32 → 32.8 | 2.1% | 0.97 | 3 → 3 |
| `STYLE100_SIDERUN/Akimbo_SideRunLeft` | planted-half | 126 | 136.5 → 132.5 | 7.5% | 0.95 | 1 → 0 |
| `STYLE100_SIDERUN/LawnMower_SideRunLeft` | planted-half | 127 | 144.1 → 160.8 | 4.1% | 0.94 | 1 → 0 |
| `STYLE100_SIDERUN/LimpRight_SideRunLeft` | sole-planted-half | 119 | 120.1 → 118.6 | 4.1% | 0.92 | 1 → 1 |
| `STYLE100_SIDERUN/Penguin_SideRunRight` | sole-planted | 95 | 97.8 → 95.3 | 6.3% | 0.97 | 6 → 5 |
| `STYLE100_SIDERUN/Proud_SideRunRight` | planted-half | 145 | 154.2 → 149.7 | 6.4% | 0.85 | 2 → 0 |
| `STYLE100_SIDERUN/RaisedLeftArm_SideRunLeft` | sole-planted-quarter | 159 | 68.4 → 161.3 | 2.0% | 0.64 | 3 → 0 |
| `STYLE100_SIDERUN/RaisedLeftArm_SideRunRight` | planted-half | 165 | 174.2 → 164.4 | 4.2% | 0.85 | 1 → 0 |
| `STYLE100_SIDERUN/Robot_SideRunRight` | planted-quarter | 72 | 70.5 → 71.9 | 3.9% | 0.64 | 1 → 1 |
| `STYLE100_SIDERUN/Rushed_SideRunLeft` | planted-half | 165 | 157 → 160.4 | 8.6% | 0.73 | 2 → 0 |
| `STYLE100_SIDERUN/Teapot_SideRunLeft` | planted-half | 133 | 141.2 → 137.9 | 5.7% | 0.87 | 1 → 1 |
| `STYLE100_SIDERUN/TwoFootJump_SideRunLeft` | planted-half | 129 | 149.6 → 139.6 | 5.5% | 0.67 | 1 → 0 |

## What the integrator must re-run

- **The briefs: not for the clips.** No clip B1 to B8's agents commonly pick changed: the core jogs, Mesh2Motion's Jog,
  Run_Female and Sprint, and every Quaternius clip keep their files byte for byte (the 45 are in 100STYLE's six sets
  and CMU_CURATED, opt-in tiers outside the default pack; `bench/` names none of them outside the G4 and G8 gate
  records). The manual is unchanged. B1's known-good passes in full (11 of 11). No real-agent run was made here.
- **CI:** the `rates` job (the whole rate sweep against the new baseline: run here by hand, `--check` 0 not baselined)
  and T2 (its library sweeps and graders passed here by `test:full`; the playwright step wasn't run: nothing in a
  browser changed).
- **The version:** core and @m3a/library gain exports (`clip.readContacts`, `clip.CONTACT_READINGS`, `withReading`):
  a minor bump by the rule, unless the integrator reads it as D127's kind (a fix to the data).
- **The full rule test** (`npm run test:full -- tools/facts/readings.test.ts`, all 126 loops, about 6 minutes on one
  thread) isn't in T2's list (`tools/run/e2e.ts` SWEEPS); T1 runs the rule on four loops and pins all 45. Add it to a gate step if the rule should
  be re-derived on every gate.
- **Owner needed before D129 lands (`blocked-owner` for the data):** (1) the `labelled` route, which misstates the 45
  clips' contacts under spec §7.1 (a tool read them; no person or source labelled them) and leaves their reading named
  only in `_import.json`: amend §7.1 and name the reading in the clip, land as written, or hold the data and land the
  code (step 3 has the options); (2) the six readings new to core (31 of the 45 adopted use one); (3) whether a
  stricter adoption bar (no still-failing row reads worse) should replace "adds no failing row": it would adopt 25 of
  the 45 (the other 20 each have a still-failing row that reads worse). Post exactly these on the pull request; the
  code (core's readings, `withReading` and its refusals, the rule, the importer's route) doesn't depend on the answer.
