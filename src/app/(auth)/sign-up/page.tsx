import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { DataLabel, Prose } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { isGoogleOAuthEnabled } from "@/lib/env";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false },
};

type SearchParams = Promise<{
  [key: string]: string | string[] | undefined;
}>;

export default function SignUpPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <>
      <section>
        <DataLabel>Create account</DataLabel>
        <h1 className="mt-3 font-display text-display-lg">
          Keep what you've learned.
        </h1>
        <Prose className="mt-6 text-muted-foreground">
          <p>
            You never needed an account to take an interview, and you still
            don't. An account is for afterwards: interviews you take signed in
            collect in one history, so the thing you keep getting wrong is
            visible instead of forgotten.
          </p>
          <p>
            An email, a password, and you're in — there's no confirmation link
            to wait for.
          </p>
        </Prose>
      </section>

      <div className="lg:border-l lg:pl-16">
        <Suspense fallback={<FormFallback rows={3} />}>
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
    <SignUpForm
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
