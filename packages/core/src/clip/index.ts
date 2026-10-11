// The clip runtime's public surface (PLAN.md WP-2.2): sampling, root motion, events, contacts and measured facts.
export { sample, rootAt, rootDelta, type Playable, type RootPose } from "./sample.ts";
export { events, type Fired } from "./events.ts";
export { contactsAt, detectContacts, sampleAll, endLow, END_POINTS, type End, type DetectOptions, type Sampled } from "./contacts.ts";
export { measureFacts, type Facts, type Measurable } from "./facts.ts";
