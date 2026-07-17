import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Measure } from "@/components/ui/page";
import { DataLabel, Prose } from "@/components/ui/prose";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Intrv is for, how it works under the hood, and what it deliberately isn't.",
};

const NOT = [
  {
    title: "Not a coding platform",
    body: "No code execution, no test harness, no coding challenges. Nothing you type is run. You can be asked to explain what a snippet does or why it breaks — you cannot be asked to make it compile.",
  },
  {
    title: "Not a mock video interview",
    body: "There is no camera, no microphone, no simulated interviewer reading your body language. It's questions and written answers.",
  },
  {
    title: "Not a job board",
    body: "No resume review, no job matching, no application tracking. Your own practice is between you and the page. Teams can assessment candidates through organizations, but that's a separate surface — it never touches your personal history.",
  },
  {
    title: "Not a product with a pricing page",
    body: "It's free. There's no card, no trial, no tier above you with the good features in it.",
  },
];

export default function AboutPage() {
  return (
    <Measure>
      <DataLabel>About</DataLabel>
      <h1 className="mt-3 font-display text-display-lg text-balance">
        A score is not feedback
      </h1>

      <Prose className="mt-8 text-lg text-muted-foreground">
        <p>
          Intrv generates an interview on any topic you name, grades what you
          write, and hands back a breakdown of which ideas you haven't got yet.
        </p>
      </Prose>

      <section aria-labelledby="belief" className="mt-14 border-t pt-10">
        <h2 id="belief" className="font-display text-display-md">
          The belief behind it
        </h2>
        <Prose className="mt-4 text-muted-foreground">
          <p>
            Almost every quiz app ends the same way: a percentage, a progress
            ring, maybe a streak. You scored 60%. Now what? The number is a fact
            about the past. It describes the test, not you, and it gives you
            nothing to do next.
          </p>
          <p>
            The useful thing was never the score — it was the wrong answers, and
            almost every tool throws them away. Two people who both score 60%
            can need completely different afternoons. One has four unrelated
            gaps. The other has a single misunderstanding showing up four times
            in four disguises. A percentage cannot tell those two apart. It's
            the same number.
          </p>
          <p>
            So the whole product is pointed at one idea:{" "}
            <em>a wrong answer should turn into something you can study.</em>{" "}
            Every question is tagged with the concepts it was testing. Miss it,
            and the concept is what gets written down. The result page ranks
            those by how often they cost you, so what you leave with is a name
            for the thing you don't understand — not a bruise.
          </p>
        </Prose>
      </section>

      <section aria-labelledby="how" className="mt-12 border-t pt-10">
        <h2 id="how" className="font-display text-display-md">
          How it works under the hood
        </h2>
        <Prose className="mt-4 text-muted-foreground">
          <p>
            You give it a topic, a difficulty, a question count, and optionally
            a timer. A model — DeepSeek — writes the questions. They stream back
            as they're generated rather than landing all at once, so you're
            answering the first one while the last one is still being written.
            That's the difference between starting in seconds and staring at a
            spinner.
          </p>
          <p>
            Grading splits in two, deliberately. Multiple choice and true/false
            are checked against the answer key on our own server, instantly — no
            model, no network, no waiting, and no opportunity for it to get an
            unambiguous question wrong. Short answers are the ones that need
            judgement, so those go to the model: it reads your answer against
            the expected one, awards partial credit for the parts you got, and
            writes a line on what was missing.
          </p>
          <p>
            Because a model wrote the questions and graded the prose, a question
            can be badly worded and a grade can be wrong. We show you the
            expected answer and the reasoning next to your own answer precisely
            so that you can catch it when it is. Don't take a grade here as a
            verdict on anything that matters.
          </p>
        </Prose>
      </section>

      <section aria-labelledby="account" className="mt-12 border-t pt-10">
        <h2 id="account" className="font-display text-display-md">
          You don't need an account
        </h2>
        <Prose className="mt-4 text-muted-foreground">
          <p>
            Take an interview, read the result, close the tab — signed out, the
            whole way. The URL is your link back to it. That's not an oversight;
            an account gate in front of a five-minute quiz is a toll booth, and
            we'd rather you just used the thing.
          </p>
          <p>
            Signing in earns its keep only when repetition does: it keeps a
            history, brings every question you've got wrong into one review,
            reschedules the concepts you miss so they come back as fresh
            questions before you forget them, and maps which ones keep costing
            you marks over months rather than on one bad afternoon. Optional,
            and everything else works without it.
          </p>
        </Prose>
      </section>

      <section aria-labelledby="not" className="mt-12 border-t pt-10">
        <h2 id="not" className="font-display text-display-md">
          What it deliberately isn't
        </h2>
        <Prose className="mt-4 text-muted-foreground">
          <p>
            A tool that says yes to everything is a tool with no opinion. The
            things below are absent on purpose, and knowing them now beats
            finding out in ten minutes.
          </p>
        </Prose>
        <dl className="mt-6 divide-y border-y">
          {NOT.map((item) => (
            <div key={item.title} className="py-4">
              <dt className="text-sm font-medium">{item.title}</dt>
              <dd className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="cta" className="mt-12 border-t pt-10">
        <h2 id="cta" className="font-display text-display-md">
          Try it and see
        </h2>
        <Prose className="mt-4 text-muted-foreground">
          <p>
            The argument above is easier to check than to read. Pick something
            you think you know well and find out.
          </p>
        </Prose>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button asChild>
            <Link href="/start">
              Start an interview
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Or read the{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-4 hover:text-foreground"
            >
              privacy policy
            </Link>{" "}
            first — it's short, and it says where your words go.
          </p>
        </div>
      </section>
    </Measure>
  );
}
