import { describe, expect, it } from "vitest";
import { toClientQuestion } from "@/server/dal/dto";

const mcqRow = {
  id: "q1",
  index: 0,
  type: "MCQ" as const,
  prompt: "What is 2 + 2?",
  choices: [
    { key: "A", text: "3" },
    { key: "B", text: "4" },
  ],
  answerKey: { kind: "MCQ", key: "B" },
  explanation: "Because arithmetic.",
  answer: null,
};

describe("toClientQuestion", () => {
  it("strips answerKey and explanation before grading", () => {
    const out = toClientQuestion(mcqRow, false);

    expect(out.answerKey).toBeNull();
    expect(out.explanation).toBeNull();
    // The question itself must still be usable.
    expect(out.prompt).toBe("What is 2 + 2?");
    expect(out.choices).toHaveLength(2);
  });

  it("never leaks the answer through serialization before grading", () => {
    // The real threat is the whole object crossing the wire, not the named
    // field: a stray property would still ship. Assert on the payload.
    const serialized = JSON.stringify(toClientQuestion(mcqRow, false));

    expect(serialized).not.toContain("Because arithmetic");
    // "B" appears as a choice key, so assert the answerKey shape is absent
    // rather than the letter itself.
    expect(serialized).not.toContain('"answerKey":{');
    expect(JSON.parse(serialized).answerKey).toBeNull();
  });

  it("reveals answerKey and explanation once graded", () => {
    const out = toClientQuestion(mcqRow, true);

    expect(out.answerKey).toEqual({ kind: "MCQ", key: "B" });
    expect(out.explanation).toBe("Because arithmetic.");
  });

  it("drops an answerKey that does not match the schema", () => {
    const out = toClientQuestion(
      { ...mcqRow, answerKey: { kind: "NONSENSE" } },
      true,
    );

    expect(out.answerKey).toBeNull();
  });

  it("converts Decimal-ish scores to numbers", () => {
    const out = toClientQuestion(
      {
        ...mcqRow,
        answer: {
          response: { kind: "MCQ", key: "B" },
          isCorrect: true,
          score: "100" as unknown,
          feedback: "Nice.",
        },
      },
      true,
    );

    expect(out.answer?.score).toBe(100);
    expect(typeof out.answer?.score).toBe("number");
  });
});
