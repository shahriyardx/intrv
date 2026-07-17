import { describe, expect, it } from "vitest";
import {
  emitQuestionsSchema,
  normalizeQuestion,
  stripInlineMcqOptions,
} from "@/server/ai/schemas";

describe("stripInlineMcqOptions", () => {
  const mcq = (prompt: string) =>
    normalizeQuestion({
      type: "MCQ",
      prompt,
      choices: [
        { key: "A", text: "one" },
        { key: "B", text: "two" },
        { key: "C", text: "three" },
        { key: "D", text: "four" },
      ],
      answerKey: "C",
      explanation: "because",
      concepts: ["git"],
      keyPoints: [],
    })?.prompt;

  it("removes an inlined option block from the end of the prompt", () => {
    const prompt = [
      "What is the resulting commit graph on main?",
      "",
      "A) A -- B -- C -- D' (where D' is a copy of D)",
      "B) A -- B -- C -- D (where D has moved to main)",
      "C) A -- B -- C -- E (feature commits are squashed)",
      "D) Nothing changes because D is not an ancestor of main",
    ].join("\n");

    expect(stripInlineMcqOptions(prompt)).toBe(
      "What is the resulting commit graph on main?",
    );
    expect(mcq(prompt)).toBe("What is the resulting commit graph on main?");
  });

  it("handles the compact 'A.' and '(A)' marker styles too", () => {
    expect(
      stripInlineMcqOptions("Pick one.\nA. first\nB. second\nC. third"),
    ).toBe("Pick one.");
    expect(stripInlineMcqOptions("Pick one.\n(A) first\n(B) second")).toBe(
      "Pick one.",
    );
  });

  it("leaves a normal stem untouched", () => {
    const prompt = "Which HTTP method is idempotent by definition?";
    expect(stripInlineMcqOptions(prompt)).toBe(prompt);
  });

  it("does not strip a lone sentence that opens with a letter marker", () => {
    // One option-shaped line is not a block — could be a real sentence.
    const prompt = "A) is a note on the diagram. What does it mean?";
    expect(stripInlineMcqOptions(prompt)).toBe(prompt);
  });

  it("never eats a fenced code block", () => {
    const prompt = [
      "What does this print?",
      "```js",
      "console.log(1 + 1)",
      "```",
    ].join("\n");
    expect(stripInlineMcqOptions(prompt)).toBe(prompt);
  });

  it("keeps the prompt when the option block is the whole thing", () => {
    // Nothing to show if we strip everything — a duplicated option beats a blank.
    const prompt = "A) first\nB) second\nC) third";
    expect(stripInlineMcqOptions(prompt)).toBe(prompt);
  });
});

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

describe("normalizeQuestion — code questions must contain their code", () => {
  const mcq = {
    explanation: "why",
    concepts: ["a"],
    keyPoints: [],
    type: "MCQ" as const,
    choices: [
      { key: "A", text: "1" },
      { key: "B", text: "2" },
    ],
    answerKey: "A",
  };

  it("drops a question that promises code and has none", () => {
    // Observed from the live model: the stem arrives without the snippet, and
    // the reader gets something unanswerable.
    expect(
      normalizeQuestion({
        ...mcq,
        prompt: "What does the following code print?",
      }),
    ).toBeNull();
    expect(
      normalizeQuestion({
        ...mcq,
        prompt: "What is wrong with this function?",
      }),
    ).toBeNull();
    expect(
      normalizeQuestion({
        ...mcq,
        prompt: "What does this JavaScript snippet output?",
      }),
    ).toBeNull();
  });

  it("keeps it when the code is actually there", () => {
    expect(
      normalizeQuestion({
        ...mcq,
        prompt:
          "What does the following code print?\n\n```js\nconsole.log(1)\n```",
      }),
    ).not.toBeNull();
  });

  it("does not drop ordinary prose that happens to say 'code'", () => {
    expect(
      normalizeQuestion({
        ...mcq,
        prompt: "Why is dead code elimination useful?",
      }),
    ).not.toBeNull();
    expect(
      normalizeQuestion({
        ...mcq,
        prompt: "What does a 404 status code mean?",
      }),
    ).not.toBeNull();
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
