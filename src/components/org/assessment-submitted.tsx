import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * What a candidate sees after submitting an assessment. An assessment is graded for the
 * organization, not the candidate — showing them the score or the answer key
 * would hand the next candidate an advantage. So this is a quiet confirmation
 * and nothing more.
 */
export function AssessmentSubmitted({ orgName }: { orgName: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-md border border-dashed px-6 py-16 text-center">
      <span
        aria-hidden
        className="mb-5 flex size-11 items-center justify-center rounded-sm bg-muted text-muted-foreground [&_svg]:size-6"
      >
        <CheckCircleIcon weight="duotone" />
      </span>
      <p className="font-display text-display-md">
        Thanks — your answers are in
      </p>
      <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
        {orgName} will review your responses. There's nothing more to do here,
        and your score stays with them.
      </p>
    </div>
  );
}
