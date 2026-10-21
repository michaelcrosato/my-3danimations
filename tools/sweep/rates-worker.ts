// A worker thread of the root-motion rate sweep (rates.ts sweepRates, D123): it plays each task it is sent (loops by id
// at their rates on one body, `playTask`) and posts back the task's rows, reading the library and binding each body
// once. A task that throws ends the thread with its error, which the sweep rejects with.
import { parentPort } from "node:worker_threads";
import { playTask, type RateTask } from "./rates.ts";

parentPort!.on("message", async (t: RateTask) => parentPort!.postMessage(await playTask(t)));
