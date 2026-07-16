import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { DataLabel, Prose } from "@/components/ui/prose";

const STEPS = [
  {
    n: "01",
    title: "Pick a topic",
    body: "Anything — React hooks, cell biology, system design. Set difficulty, question count, and a timer if you want the pressure.",
  },
  {
    n: "02",
    title: "Answer as they arrive",
    body: "Questions stream in as they're written, so you start in seconds. Multiple choice, true/false, and short answer.",
  },
  {
    n: "03",
    title: "Find out what you missed",
    body: "Every question graded with a reason, not just a tick. Short answers get partial credit and feedback on what was missing.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 sm:pt-28">
          <DataLabel>AI interview practice</DataLabel>

          <h1 className="mt-5 max-w-4xl font-display text-display-xl sm:text-display-2xl">
            Practice interviews that tell you{" "}
            <span className="relative inline-block">
              <span className="relative z-10 italic">what to fix</span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1 z-0 h-3 bg-accent/70 sm:bottom-2 sm:h-5"
              />
            </span>
          </h1>

          <Prose className="mt-8 text-lg text-muted-foreground">
            <p>
              Pick any topic. We write the questions, you answer them, and you
              get a graded breakdown of exactly which ideas you haven't got yet
              — not just a number.
            </p>
          </Prose>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="min-w-44">
              <Link href="/start">
                Start an interview
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              No account. No card. Nothing to install.
            </p>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto grid max-w-6xl gap-px bg-border sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="bg-background p-8">
                <span className="font-mono text-xs tabular text-accent-foreground/60">
                  {step.n}
                </span>
                <h2 className="mt-3 font-display text-display-md">
                  {step.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="max-w-2xl font-display text-display-lg">
              Most quiz apps tell you that you scored 60%. That isn't useful.
            </h2>
            <Prose className="mt-6 text-muted-foreground">
              <p>
                Knowing the number doesn't tell you what to do on Monday
                morning. Every answer here comes back tagged with the concept
                behind it, so a wrong answer turns into a reading list instead
                of a bruise.
              </p>
            </Prose>
            <Button asChild variant="outline" className="mt-8">
              <Link href="/start">
                Try it
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="no-print border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
          <span className="font-display text-sm">InterviewAI</span>
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
            Built for students
          </span>
        </div>
      </footer>
    </>
  );
}
