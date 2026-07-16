import { describe, expect, it } from "vitest";
import { emitQuestionsSchema, normalizeQuestion } from "@/server/ai/schemas";

describe("emitQuestionsSchema — tolerating DeepSeek strict mode", () => {
  it("accepts a TRUE_FALSE question with no `choices` key at all", () => {
    // Regression: DeepSeek strict mode lists `choices` as required but omits it
    // for question types where it makes no sense. Treating that as a validation
    // error failed every mixed-type batch after all four retries.
    const parsed = emitQuestionsSchema.safeParse({
      questions: [
        {
          type: "TRUE_FALSE",
          prompt: "Promises are eager.",
          answerKey: "TRUE",
          explanation: "They start on creation.",
          concepts: ["promises"],
          // no `choices`, no `keyPoints`
        },
      ],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.questions[0]?.choices).toEqual([]);
    expect(parsed.data?.questions[0]?.keyPoints).toEqual([]);
  });

  it("still rejects output missing a field we cannot invent", () => {
    const parsed = emitQuestionsSchema.safeParse({
      questions: [{ type: "MCQ", choices: [], concepts: [] }],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("normalizeQuestion", () => {
  const base = { explanation: "why", concepts: ["a"], keyPoints: [] };

  it("maps an MCQ and preserves the model's key casing", () => {
    const q = normalizeQuestion({
      ...base,
      type: "MCQ",
      prompt: "Pick one",
      choices: [
        { key: "A", text: "one" },
        { key: "B", text: "two" },
      ],
      answerKey: "b",
    });

    expect(q?.answerKey).toEqual({ kind: "MCQ", key: "B" });
  });

  it("drops an MCQ whose answer key names no choice", () => {
    // A question we cannot grade is worse than one fewer question.
    expect(
      normalizeQuestion({
        ...base,
        type: "MCQ",
        prompt: "Pick one",
        choices: [{ key: "A", text: "one" }],
        answerKey: "Z",
      }),
    ).toBeNull();
  });

  it("drops an MCQ with fewer than two choices", () => {
    expect(
      normalizeQuestion({
        ...base,
        type: "MCQ",
        prompt: "Pick one",
        choices: [{ key: "A", text: "one" }],
        answerKey: "A",
      }),
    ).toBeNull();
  });

  it("parses TRUE_FALSE case-insensitively", () => {
    expect(
      normalizeQuestion({
        ...base,
        type: "TRUE_FALSE",
        prompt: "x",
        choices: [],
        answerKey: "False",
      })?.answerKey,
    ).toEqual({ kind: "TRUE_FALSE", value: false });
  });

  it("drops a TRUE_FALSE whose key is neither true nor false", () => {
    expect(
      normalizeQuestion({
        ...base,
        type: "TRUE_FALSE",
        prompt: "x",
        choices: [],
        answerKey: "maybe",
      }),
    ).toBeNull();
  });

  it("keeps key points on a short answer", () => {
    const q = normalizeQuestion({
      ...base,
      type: "SHORT_ANSWER",
      prompt: "Explain",
      choices: [],
      answerKey: "Because X",
      keyPoints: ["mentions X", " "],
    });

    expect(q?.answerKey).toEqual({
      kind: "SHORT_ANSWER",
      expected: "Because X",
      keyPoints: ["mentions X"],
    });
  });

  it("caps concepts at three and lowercases them", () => {
    const q = normalizeQuestion({
      ...base,
      type: "TRUE_FALSE",
      prompt: "x",
      choices: [],
      answerKey: "TRUE",
      concepts: ["Closures", "SCOPE", "hoisting", "extra"],
    });

    expect(q?.concepts).toEqual(["closures", "scope", "hoisting"]);
  });
});
