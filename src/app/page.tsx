import {
  ArrowRightIcon,
  CalendarBlankIcon,
  FlameIcon,
  MedalIcon,
  TrophyIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { DataLabel, Prose } from "@/components/ui/prose";
import { xpForLevel } from "@/server/learning/levels";

/**
 * The home page is four sections and no more: hero, how it works, the loop that
 * brings people back, one closing call to action. It used to be eleven, which
 * is eleven chances to stop reading.
 *
 * Everything cut still exists — job descriptions, question types, the mastery
 * map, teams, the FAQ — on /about, /start and the footer. A landing page is not
 * a feature inventory.
 */

const STEPS = [
  {
    n: "01",
    title: "Pick a topic",
    body: "Anything — React hooks, cell biology, system design. Or paste a job description and we pull the role, stack and seniority out of it.",
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

// The come-back loop. These are real mechanics, not aspirational copy — each
// one is live on the dashboard the moment you sign in.
const LOOP = [
  {
    Icon: FlameIcon,
    title: "A streak worth keeping",
    body: "One graded interview a day keeps it alive. Miss a whole day and it resets — miss the morning and it doesn't.",
    meta: "Resets 00:00 UTC",
  },
  {
    Icon: TrophyIcon,
    title: "XP and levels",
    body: "Every result is worth points, weighted by difficulty and length, so grinding easy sets won't carry you. Points become levels.",
    meta: "Same maths as the board",
  },
  {
    Icon: MedalIcon,
    title: "Badges to chase",
    body: "Twelve of them, from your first run to thirty days straight. The locked ones show you how far off you are.",
    meta: "12 to collect",
  },
  {
    Icon: CalendarBlankIcon,
    title: "One shared daily",
    body: "The same ten questions for everyone, one attempt per account, a public board at the end of it. Today's board is a fair fight.",
    meta: "New set every day",
  },
];

// The first rungs, straight from the real curve — a picture of the ladder that
// cannot drift from the ladder. No tier names here: levels 1–5 are all
// "Newcomer", so printing the title under each one reads like a bug.
const LADDER = [1, 2, 3, 4, 5].map((level) => ({
  level,
  xp: xpForLevel(level),
}));

export default function Home() {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>

      <main className="flex-1">
        {/* 1 — Hero. The claim and the buttons; one column at the shell width,
            left edge aligned with every section below it. */}
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
              — then a streak, XP and a leaderboard to make coming back worth
              it.
            </p>
          </Prose>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="min-w-44">
              <Link href="/start">
                Start an interview
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/daily">Today's challenge</Link>
            </Button>
          </div>

          <p className="mt-5 text-muted-foreground text-sm">
            Free account. No card. Nothing to install.
          </p>
        </section>

        {/* 2 — How it works. */}
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
                <span className="font-mono text-muted-foreground text-xs tabular">
                  {step.n}
                </span>
                <h3 className="mt-3 font-display text-display-md">
                  {step.title}
                </h3>
                {/* flex-1 so the rules below align across the row rather than
                    tracking each column's copy length. */}
                <p className="mt-3 flex-1 text-muted-foreground text-sm leading-relaxed">
                  {step.body}
                </p>
                <p className="mt-6 border-t pt-4 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
                  {step.aside}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 3 — The loop: why you come back tomorrow. */}
        <section aria-labelledby="loop" className="border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="max-w-2xl">
              <DataLabel>The loop</DataLabel>
              <h2 id="loop" className="mt-4 font-display text-display-lg">
                Studying, with a scoreboard
              </h2>
              <Prose className="mt-5 text-muted-foreground">
                <p>
                  Knowing what you got wrong is the useful part. Coming back
                  tomorrow is the hard part — so that half is a game.
                </p>
              </Prose>
            </div>

            <div className="mt-12 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
              {LOOP.map(({ Icon, title, body, meta }) => (
                <div key={title} className="flex flex-col bg-background p-8">
                  <Icon
                    aria-hidden
                    className="size-5 text-muted-foreground"
                    weight="duotone"
                  />
                  <h3 className="mt-4 font-display text-display-md">{title}</h3>
                  <p className="mt-3 flex-1 text-muted-foreground text-sm leading-relaxed">
                    {body}
                  </p>
                  <p className="mt-5 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
                    {meta}
                  </p>
                </div>
              ))}
            </div>

            {/* The real curve, rendered. A ladder you can see the bottom of is
                a ladder you'll step onto. */}
            <div className="mt-10 flex flex-wrap items-end gap-x-10 gap-y-6 border-t pt-8">
              {LADDER.map(({ level, xp }) => (
                <div key={level}>
                  <p className="font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
                    Level {level}
                  </p>
                  <p className="mt-1.5 font-display text-display-md leading-none tabular">
                    {xp.toLocaleString()}
                  </p>
                  <p className="mt-1.5 font-mono text-muted-foreground text-xs">
                    XP
                  </p>
                </div>
              ))}
              <p className="max-w-xs text-muted-foreground text-sm">
                One decent ten-question run is worth about 100 XP — so level two
                is one sitting away.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild variant="outline">
                <Link href="/leaderboard">
                  See the leaderboard
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <p className="text-muted-foreground text-sm">
                On by default, opt out any time in settings.
              </p>
            </div>
          </div>
        </section>

        {/* 4 — Close. */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="max-w-3xl text-balance font-display text-display-xl">
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
              <p className="text-muted-foreground text-sm">
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
