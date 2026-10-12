// The legend quiz (WP-1.1's deferred proof, run here in WP-4.7): a fresh agent with no tools is given the legend
// (spec/LEGEND.md) and one clip, answers ten fixed questions as JSON, and scores at least nine.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
/** The quiz: its clip and questions with their answers. */
export interface Quiz {
  clip: string;
  questions: { q: string; answer: string | number }[];
}
/** The quiz in bench/quiz/legend.json. */
export const QUIZ = JSON.parse(readFileSync(join(ROOT, "bench/quiz/legend.json"), "utf8")) as Quiz;

/** The prompt: the legend, the clip's file as it is, the questions, and how to answer. */
export function quizPrompt(quiz: Quiz = QUIZ): string {
  const [set, name] = quiz.clip.split("/");
  const legend = readFileSync(join(ROOT, "spec/LEGEND.md"), "utf8"), clip = readFileSync(join(ROOT, "library/sets", set!, `${name}.json`), "utf8");
  return [
    "Below are a motion format's legend and one clip file in that format. Answer the questions from them alone.",
    "", "LEGEND", legend, "", "CLIP", clip, "", "QUESTIONS",
    ...quiz.questions.map((x, i) => `${i + 1}. ${x.q}`),
    "", 'Reply with only a JSON object from question number to answer, e.g. {"1": "yes", "2": 0.5}: numbers as numbers, words as single words.',
  ].join("\n");
}

/** The answers in a reply (its first JSON object), by question number. */
export function answersIn(reply: string): Record<string, unknown> {
  const m = /\{[\s\S]*\}/.exec(reply);
  if (!m) return {};
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}
/** The score: right answers (numbers within 0.01, words without case or spaces), and each wrong one. */
export function score(answers: Record<string, unknown>, quiz: Quiz = QUIZ): { right: number; of: number; wrong: string[] } {
  const wrong: string[] = [];
  quiz.questions.forEach((x, i) => {
    const got = answers[String(i + 1)];
    const ok = typeof x.answer === "number" ? Math.abs(Number(got) - x.answer) <= 0.01 : String(got ?? "").trim().toLowerCase() === x.answer;
    if (!ok) wrong.push(`${i + 1}: ${JSON.stringify(got)} (expected ${JSON.stringify(x.answer)})`);
  });
  return { right: quiz.questions.length - wrong.length, of: quiz.questions.length, wrong };
}
