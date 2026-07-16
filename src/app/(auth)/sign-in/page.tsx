import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { DataLabel, Prose } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { isGoogleOAuthEnabled } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

type SearchParams = Promise<{
  [key: string]: string | string[] | undefined;
}>;

export default function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <>
      <section>
        <DataLabel>Sign in</DataLabel>
        <h1 className="mt-3 font-display text-display-lg">
          Pick up where you left off.
        </h1>
        <Prose className="mt-6 text-muted-foreground">
          <p>
            Your account holds every interview you took while signed in — the
            questions, what you answered, and what the grader said about it.
          </p>
          <p>
            Interviews you took signed out aren't in there. Those live at their
            own link, and signing in doesn't go looking for them.
          </p>
        </Prose>
      </section>

      <div className="lg:border-l lg:pl-16">
        <Suspense fallback={<FormFallback rows={2} />}>
          <Panel searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

// `next` is a dynamic read, so it sits under its own boundary and the editorial
// half of the page still prerenders.
async function Panel({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;

  return (
    <SignInForm
      next={typeof next === "string" ? next : undefined}
      googleEnabled={isGoogleOAuthEnabled}
    />
  );
}

function FormFallback({ rows }: { rows: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
