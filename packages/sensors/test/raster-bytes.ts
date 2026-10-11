// The raster test's second process: renders the test pose in every view and a turntable, and prints each PNG's SHA-256.
import { createHash } from "node:crypto";
import { render, turntable } from "../src/index.ts";
import { png } from "../src/node.ts";
import { testPose, VIEW_NAMES } from "./raster-pose.ts";

const X = testPose();
const images = [...VIEW_NAMES.map((v) => render(X, { view: v, width: 320, height: 320, label: v })), turntable(X, { n: 6, size: 120 })];
console.log(images.map((img) => createHash("sha256").update(png(img)).digest("hex")).join("\n"));
