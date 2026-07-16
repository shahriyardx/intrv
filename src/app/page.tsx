import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  BrainIcon,
  BriefcaseIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  ChartBarIcon,
  ChatCircleIcon,
  CompassIcon,
  FlameIcon,
  GaugeIcon,
  GraduationCapIcon,
  ListChecksIcon,
  ShieldCheckIcon,
  TargetIcon,
  TextAlignLeftIcon,
  ToggleLeftIcon,
  TrophyIcon,
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
    title: "Pick a topic — or paste a job",
    body: "Anything — React hooks, cell biology, system design. Or drop in a job description and we pull the role, stack and seniority out of it. Set the difficulty and length, add a timer for pressure, or let the difficulty adapt to how you answer.",
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
    body: "Every question comes back graded with a reason, not just a tick. Short answers get partial credit and a note on what was missing — and you can open any miss to talk it through.",
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

// The signed-in loop: a miss doesn't just get logged, it gets scheduled,
// mapped, and turned into the next thing to do.
const LOOP = [
  {
    Icon: ChatCircleIcon,
    title: "Discuss a miss",
    body: "Open any question you got wrong and talk it through with a patient explainer. Your score is already locked — this is for understanding, not points.",
  },
  {
    Icon: ArrowsClockwiseIcon,
    title: "Spaced review",
    body: "A missed concept comes back a day later, then three, then a week — as a fresh question, not the same one. Get it right and it graduates; miss it and it resets.",
  },
  {
    Icon: ChartBarIcon,
    title: "Mastery map",
    body: "Every concept you've been graded on, ranked by how often you get it right, weakest first — across everything you've taken, not one session.",
  },
  {
    Icon: CompassIcon,
    title: "A plan for next time",
    body: "The map turned into a short list: which topics to practise, at what difficulty, one click to start. Plus a streak and XP for showing up.",
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
    body: "Rehearse the questions you'd be asked about a stack — or paste the exact job description and get an interview written for that role — before someone asks them for real.",
  },
];

// Static illustration for the adaptive section. Not live data — a picture of
// what a calibrated result reads like.
const CALIBRATION = [
  { level: "Easy", read: "Solid", width: "92%" },
  { level: "Medium", read: "Strong", width: "78%" },
  { level: "Hard", read: "Shaky", width: "41%" },
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
              Pick any topic — or paste a job description. We write the
              questions, you answer them, and you get a graded breakdown of
              exactly which ideas you haven't got yet, not just a number.
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

        {/* Job-description mode: the "practising for a specific job" entry. */}
        <section aria-labelledby="jd" className="border-t">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
            <div>
              <DataLabel>Job-description mode</DataLabel>
              <h2
                id="jd"
                className="mt-4 font-display text-display-lg text-balance"
              >
                Interviewing for a specific job? Paste the description.
              </h2>
              <Prose className="mt-6 text-muted-foreground">
                <p>
                  Give it the actual posting and we read the role, the stack and
                  the seniority out of it, then write an interview aimed at that
                  job — not a generic quiz that happens to share a keyword.
                </p>
                <p>
                  The extraction is ours, so nothing you paste is handed to the
                  model as instructions. It's treated as subject matter, the
                  same as a topic you typed.
                </p>
              </Prose>
              <Button asChild variant="outline" className="mt-8">
                <Link href="/start">
                  Paste a job description
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="lg:pt-2">
              <div className="rounded-md border bg-muted/40 p-6">
                <p className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                  <BriefcaseIcon className="size-3.5" aria-hidden />
                  Pulled from the posting
                </p>
                <dl className="mt-5 space-y-4">
                  <div>
                    <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                      Role
                    </dt>
                    <dd className="mt-1 text-sm">Backend engineer</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                      Stack
                    </dt>
                    <dd className="mt-1 text-sm">Go · Postgres · gRPC · AWS</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                      Seniority
                    </dt>
                    <dd className="mt-1 text-sm">Senior (5+ years)</dd>
                  </div>
                </dl>
                <p className="mt-6 border-t pt-4 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Example — not a real posting
                </p>
              </div>
            </div>
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

        {/* Adaptive difficulty: the level readout, not just a percentage. */}
        <section aria-labelledby="adaptive" className="border-t">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <DataLabel>Adaptive difficulty</DataLabel>
              <h2
                id="adaptive"
                className="mt-4 font-display text-display-lg text-balance"
              >
                It meets you where you are, then finds your edge
              </h2>
              <Prose className="mt-6 text-muted-foreground">
                <p>
                  Turn adaptive on and the difficulty moves with you. Every few
                  questions it reads how you're doing and steps up or down, so a
                  session spends its time near the boundary of what you know
                  rather than wasting questions you'd always get right or always
                  get wrong.
                </p>
                <p>
                  The result isn't just a percentage. It's a calibrated level —
                  where you're solid, and where it starts to wobble. "Strong at
                  medium, shaky at hard" is a sentence you can act on. "72%"
                  isn't.
                </p>
              </Prose>
            </div>

            <div className="lg:pt-2">
              <div className="rounded-md border p-6">
                <p className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                  <GaugeIcon className="size-3.5" aria-hidden />
                  Calibrated level
                </p>
                <dl className="mt-5 space-y-4">
                  {CALIBRATION.map((rung) => (
                    <div key={rung.level}>
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
                          {rung.level}
                        </dt>
                        <dd className="font-mono text-xs tabular">
                          {rung.read}
                        </dd>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-muted">
                        <div
                          className="h-full rounded-sm bg-foreground/70"
                          style={{ width: rung.width }}
                        />
                      </div>
                    </div>
                  ))}
                </dl>
                <p className="mt-6 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                  Reads as: strong at medium, shaky at hard.
                </p>
              </div>
            </div>
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
              <DataLabel as="h3">Signed in, a miss becomes a loop</DataLabel>
              <dl className="mt-5 divide-y border-y">
                {LOOP.map((item) => (
                  <div key={item.title} className="flex gap-3 py-4">
                    <item.Icon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div>
                      <dt className="text-sm font-medium">{item.title}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.body}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-sm text-muted-foreground">
                Optional. Everything above works signed out.
              </p>
            </div>
          </div>
        </section>

        {/* The playful hook: a shared daily and a public board. */}
        <section aria-labelledby="daily" className="border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="max-w-2xl">
              <DataLabel>Daily challenge &amp; leaderboard</DataLabel>
              <h2 id="daily" className="mt-4 font-display text-display-lg">
                One challenge a day, and a board to climb
              </h2>
            </div>

            <div className="mt-12 grid gap-px bg-border sm:grid-cols-3">
              <div className="flex flex-col bg-background p-8">
                <CalendarBlankIcon className="size-5 text-muted-foreground" />
                <h3 className="mt-4 font-display text-display-md">
                  The same ten, for everyone
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  One shared ten-question set per day, identical for every
                  player, one attempt per account. It resets at midnight UTC —
                  so today's board is a fair fight.
                </p>
                <p className="mt-5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Resets 00:00 UTC
                </p>
              </div>
              <div className="flex flex-col bg-background p-8">
                <TrophyIcon className="size-5 text-muted-foreground" />
                <h3 className="mt-4 font-display text-display-md">
                  A public leaderboard
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  Points weight your scores by difficulty and length, so
                  grinding easy sets won't carry you. On by default, opt out any
                  time in settings.
                </p>
                <p className="mt-5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Opt-out in settings
                </p>
              </div>
              <div className="flex flex-col bg-background p-8">
                <FlameIcon className="size-5 text-muted-foreground" />
                <h3 className="mt-4 font-display text-display-md">
                  Streaks and XP
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  A streak for every day you show up and XP that stacks with the
                  leaderboard formula — a reason to come back that isn't just
                  guilt.
                </p>
                <p className="mt-5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                  On the dashboard
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild variant="outline">
                <Link href="/daily">
                  Today's challenge
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/leaderboard">See the leaderboard</Link>
              </Button>
            </div>

            <Prose className="mt-8 border-l-2 pl-5 text-sm text-muted-foreground">
              <p>
                Beat a friend directly: share any graded result as a challenge
                and they take the identical question set, then the result shows
                you head to head.
              </p>
            </Prose>
          </div>
        </section>

        {/* Compact "for teams" band pointing at the org screening flow. */}
        <section aria-labelledby="teams" className="border-t">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <DataLabel>For teams</DataLabel>
              <h2
                id="teams"
                className="mt-4 font-display text-display-lg text-balance"
              >
                Screen candidates without the setup tax
              </h2>
              <Prose className="mt-6 text-muted-foreground">
                <p>
                  Create an organization, generate one frozen screening
                  interview, and send every candidate the same link. No account
                  for them, no scheduling, no seat licences.
                </p>
              </Prose>
              <Button asChild variant="outline" className="mt-8">
                <Link href="/org">
                  Set up screening
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
            </div>

            <dl className="grid gap-px self-start bg-border sm:grid-cols-2">
              <div className="bg-background p-6">
                <BuildingsIcon className="size-5 text-muted-foreground" />
                <dt className="mt-4 text-sm font-medium">
                  One link per screen
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Everyone gets the identical question set. The candidate needs
                  no account — the link is the whole invitation.
                </dd>
              </div>
              <div className="bg-background p-6">
                <ShieldCheckIcon className="size-5 text-muted-foreground" />
                <dt className="mt-4 text-sm font-medium">
                  Reports you can read
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Score, time taken, and integrity signals — tab switches and
                  pastes. Candidates never see their score; you do.
                </dd>
              </div>
            </dl>
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
