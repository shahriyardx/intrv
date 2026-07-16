"use client";

import { RichText } from "@/components/session/rich-text";
import { Prose } from "@/components/ui/prose";
import { Textarea } from "@/components/ui/textarea";
import type { AnswerResponse } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { ClientQuestion } from "@/server/dal/dto";

type Props = {
  question: ClientQuestion;
  value: AnswerResponse | null;
  onChange: (response: AnswerResponse) => void;
  disabled?: boolean;
};

export function QuestionCard({ question, value, onChange, disabled }: Props) {
  return (
    <div className="space-y-6">
      <Prose>
        <h2 className="font-display text-display-md leading-tight">
          <RichText>{question.prompt}</RichText>
        </h2>
      </Prose>

      {question.type === "MCQ" ? (
        <ChoiceList
          name={question.id}
          options={(question.choices ?? []).map((c) => ({
            key: c.key,
            label: c.text,
          }))}
          selected={value?.kind === "MCQ" ? value.key : null}
          disabled={disabled}
          onSelect={(key) => onChange({ kind: "MCQ", key })}
        />
      ) : null}

      {question.type === "TRUE_FALSE" ? (
        <ChoiceList
          name={question.id}
          options={[
            { key: "true", label: "True" },
            { key: "false", label: "False" },
          ]}
          selected={value?.kind === "TRUE_FALSE" ? String(value.value) : null}
          disabled={disabled}
          onSelect={(key) =>
            onChange({ kind: "TRUE_FALSE", value: key === "true" })
          }
        />
      ) : null}

      {question.type === "SHORT_ANSWER" ? (
        <div className="space-y-2">
          <Textarea
            rows={6}
            maxLength={4000}
            disabled={disabled}
            placeholder="Answer in a sentence or three. We grade the idea, not the wording."
            value={value?.kind === "SHORT_ANSWER" ? value.text : ""}
            onChange={(e) =>
              onChange({ kind: "SHORT_ANSWER", text: e.target.value })
            }
            className="resize-y text-base leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            Spelling and grammar never cost marks.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ChoiceList({
  name,
  options,
  selected,
  onSelect,
  disabled,
}: {
  name: string;
  options: { key: string; label: string }[];
  selected: string | null;
  onSelect: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" className="grid gap-2">
      {options.map((option) => {
        const isSelected = selected === option.key;
        return (
          <label
            key={option.key}
            className={cn(
              "group flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors",
              isSelected
                ? "border-foreground bg-secondary"
                : "hover:border-foreground/30",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.key}
              checked={isSelected}
              disabled={disabled}
              onChange={() => onSelect(option.key)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[0.625rem] transition-colors",
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground",
              )}
            >
              {option.key.slice(0, 1).toUpperCase()}
            </span>
            <span className="text-base leading-relaxed">
              <RichText>{option.label}</RichText>
            </span>
          </label>
        );
      })}
    </div>
  );
}
