import {
  ArrowRightIcon,
  BrainIcon,
  GraduationCapIcon,
  ListChecksIcon,
  TargetIcon,
  TextAlignLeftIcon,
  ToggleLeftIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Faq } from "@/components/marketing/faq";
import { GradedQuestionMock } from "@/components/marketing/graded-question-mock";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { DataLabel, Prose } from "@/components/ui/prose";

const STEPS = [
  {
    n: "01",
    title: "Pick a topic",
    body: "Anything — React hooks, cell biology, system design. Set the difficulty, how many questions you want, and a timer if you want the pressure.",
    aside: "Narrow topics make sharper questions.",
  },
  {
    n: "02",
    title: "Answer as they arrive",
    body: "Questions stream in as they're written, so the first one is on screen in seconds while the rest are still being generated.",
    aside: "No waiting on a loading bar.",
  },
  {
    n: "03",
    title: "Find out what you missed",
    body: "Every question comes back graded with a reason, not just a tick. Short answers get partial credit and a note on what was missing.",
    aside: "The result page is the point.",
  },
];

const TYPES = [
  {
    Icon: ListChecksIcon,
    title: "Multiple choice",
    body: "One right answer among plausible wrong ones. Graded on our server the moment you submit — no model involved, no waiting.",
    meta: "Instant",
  },
  {
    Icon: ToggleLeftIcon,
    title: "True / false",
    body: "Cheap to answer, good at catching a belief you hold confidently and wrongly. Also graded locally and instantly.",
    meta: "Instant",
  },
  {
    Icon: TextAlignLeftIcon,
    title: "Short answer",
    body: "You write a few sentences. The model reads it against the expected answer, awards partial credit for what you got, and tells you what was missing.",
    meta: "Model-graded",
  },
];

const AUDIENCE = [
  {
    Icon: GraduationCapIcon,
    title: "Students",
    body: "Turn a lecture or a chapter into questions and find out whether you understood it or just recognised it. Recognition feels identical to knowledge right up until the exam.",
  },
  {
    Icon: BrainIcon,
    title: "Self-teachers",
    body: "Nobody is setting you homework. Reading a docs page leaves no evidence of what stuck — a graded result does, and it names the gaps.",
  },
  {
    Icon: TargetIcon,
    title: "Interview prep",
    body: "Rehearse the questions you'd be asked about a stack before someone asks them for real. Fumble the explanation here, where the cost is nothing.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>

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

        <section aria-labelledby="how" className="border-t">
          <div className="mx-auto max-w-6xl px-6 pt-14">
            <DataLabel as="h2" id="how">
              How it works
            </DataLabel>
          </div>
          <div className="mx-auto mt-8 grid max-w-6xl gap-px bg-border sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="flex flex-col bg-background p-8">
                {/* --accent-foreground is only validated as ink *on* the accent
                    fill; as text on the page background it is near-invisible in
                    dark mode. */}
                <span className="font-mono text-xs tabular text-muted-foreground">
                  {step.n}
                </span>
                <h3 className="mt-3 font-display text-display-md">
                  {step.title}
                </h3>
                {/* flex-1 so the rules below align across the row rather than
                    tracking each column's copy length. */}
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
                <p className="mt-6 border-t pt-4 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                  {step.aside}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* The whole argument in one picture: this is what you get back. */}
        <section aria-labelledby="result" className="border-t bg-muted/40">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <DataLabel>The result page</DataLabel>
              <h2
                id="result"
                className="mt-4 font-display text-display-lg text-balance"
              >
                This is what you actually get back
              </h2>
              <Prose className="mt-6 text-muted-foreground">
                <p>
                  Not a score and a shrug. Every question is shown with what you
                  said, what the answer was, and why the difference matters —
                  then tagged with the concepts it was testing.
                </p>
                <p>
                  A wrong answer stops being a bruise and starts being a reading
                  list.
                </p>
              </Prose>
              <p className="mt-6 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                Example — not a real session
              </p>
            </div>

            <GradedQuestionMock />
          </div>
        </section>

        <section aria-labelledby="types" className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="max-w-2xl">
              <DataLabel>Question types</DataLabel>
              <h2 id="types" className="mt-4 font-display text-display-lg">
                Three kinds of question. That's the whole list.
              </h2>
            </div>

            <div className="mt-12 grid gap-px bg-border sm:grid-cols-3">
              {TYPES.map((type) => (
                <div
                  key={type.title}
                  className="flex flex-col bg-background p-8"
                >
                  <type.Icon className="size-5 text-muted-foreground" />
                  <h3 className="mt-4 font-display text-display-md">
                    {type.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {type.body}
                  </p>
                  <p className="mt-5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                    {type.meta}
                  </p>
                </div>
              ))}
            </div>

            <Prose className="mt-10 border-l-2 pl-5 text-sm text-muted-foreground">
              <p>
                There is no code execution and there are no coding challenges.
                Nothing you write here is run. You'll be asked to explain code,
                not to ship it — if you want a compiler, this is the wrong tool
                and we'd rather say so than waste your afternoon.
              </p>
            </Prose>
          </div>
        </section>

        <section aria-labelledby="concepts" className="border-t">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <div>
              <h2
                id="concepts"
                className="font-display text-display-lg text-balance"
              >
                Most quiz apps tell you that you scored 60%. That isn't useful.
              </h2>
              <Prose className="mt-6 text-muted-foreground">
                <p>
                  Sixty per cent is a fact about the past. It doesn't tell you
                  what to open on Monday morning. Two people can score the same
                  and need completely different afternoons — one has four small
                  gaps, the other has one deep misunderstanding wearing four
                  costumes.
                </p>
                <p>
                  So every question carries the concepts behind it. When you
                  miss one, the concept is what gets recorded — and the result
                  page ranks them by how often you missed them. If the same idea
                  keeps surfacing across four questions, that's not four
                  problems. It's one, and now you know its name.
                </p>
              </Prose>
              <Button asChild variant="outline" className="mt-8">
                <Link href="/start">
                  Try it
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="lg:pt-2">
              <DataLabel as="h3">Signed in, this compounds</DataLabel>
              <dl className="mt-5 divide-y border-y">
                <div className="py-4">
                  <dt className="text-sm font-medium">History</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Every session you've taken, kept and searchable.
                  </dd>
                </div>
                <div className="py-4">
                  <dt className="text-sm font-medium">Mistakes review</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Every question you've got wrong, across all sessions, in one
                    place.
                  </dd>
                </div>
                <div className="py-4">
                  <dt className="text-sm font-medium">Analytics</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Which concepts keep costing you marks, over time rather than
                    on one bad afternoon.
                  </dd>
                </div>
              </dl>
              <p className="mt-5 text-sm text-muted-foreground">
                Optional. Everything above works signed out.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="who" className="border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="max-w-2xl">
              <DataLabel>Who it's for</DataLabel>
              <h2 id="who" className="mt-4 font-display text-display-lg">
                Anyone who needs to find the gap before it finds them
              </h2>
            </div>
            <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {AUDIENCE.map((item) => (
                <div key={item.title}>
                  <item.Icon className="size-5 text-muted-foreground" />
                  <h3 className="mt-4 font-display text-xl tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="faq" className="border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.6fr_1.4fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <DataLabel>FAQ</DataLabel>
              <h2 id="faq" className="mt-4 font-display text-display-lg">
                Questions, answered
              </h2>
            </div>
            <Faq />
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="max-w-3xl font-display text-display-xl text-balance">
              Find out what you don't know{" "}
              <span className="relative inline-block">
                <span className="relative z-10 italic">before it counts</span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-1 z-0 h-3 bg-accent/70 sm:h-4"
                />
              </span>
            </h2>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="min-w-44">
                <Link href="/start">
                  Start an interview
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                Takes about a minute. Free, and it stays free.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
