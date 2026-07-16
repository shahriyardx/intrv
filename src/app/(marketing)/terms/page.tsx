import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalHeader,
  LegalList,
  LegalSection,
  ShortVersion,
} from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms of using Intrv: it's free, it's provided as-is, and AI-generated questions and grades can be wrong.",
};

// See the note in privacy/page.tsx — the clock is off-limits in a prerender,
// and a terms date should track the terms.
const UPDATED = "17 July 2026";

const ACCEPTABLE = [
  {
    term: "Don't use it to hurt people",
    detail:
      "No generating harassing, hateful or threatening material, no using it to produce content that sexualises children, and nothing intended to harm somebody. This should not need saying, but it is the one rule we will not discuss.",
  },
  {
    term: "Don't cheat with it",
    detail:
      "Using Intrv to answer questions in a live exam, an assessment or an interview you're being scored on is between you and whoever set it, but it defeats the entire point of the thing. It exists so you find your gaps in private.",
  },
  {
    term: "Don't attack the service",
    detail:
      "No scraping, no hammering the API, no getting around rate limits, no probing for holes in other people's sessions, and no automating it into your own product. There is a rate limiter and it will win before we have to.",
  },
  {
    term: "Don't put secrets in it",
    detail:
      "Don't type confidential, proprietary or personal information into a topic or an answer. It goes to a third-party model — see the privacy policy — and you are the only person in a position to stop that.",
  },
];

export default function TermsPage() {
  return (
    <>
      <LegalHeader label="Terms" title="Terms of service" updated={UPDATED}>
        <p className="mt-6 max-w-[68ch] text-pretty leading-relaxed text-muted-foreground">
          Using Intrv means agreeing to what's below. It's free, so this is
          short: mostly it's us being honest about what you're not getting.
        </p>
      </LegalHeader>

      <ShortVersion
        points={[
          "Intrv is free. There's nothing to buy and no subscription to cancel.",
          "The questions and grades are written by an AI and can be flat wrong. Don't rely on them for anything that matters.",
          "It's provided as-is, with no warranty and no guarantee it'll be up, or here at all, tomorrow.",
          "Don't use it to harm people, to cheat a real assessment, or to attack the service.",
          "We can close an account that breaks these terms.",
          "Keep a copy of anything you'd be upset to lose.",
        ]}
      />

      <LegalSection id="what" title="What you're agreeing to">
        <p>
          By using Intrv you accept these terms. If you don't, don't use it —
          that's the whole enforcement mechanism, since there's nothing to
          cancel. If you're under the age at which you can agree to something
          like this where you live, have a parent or guardian read it with you.
        </p>
      </LegalSection>

      <LegalSection id="free" title="It's free">
        <p>
          There is no charge, no card, no trial that lapses, and no tier above
          you holding the good features. We don't sell your data — see the{" "}
          <Link href="/privacy">privacy policy</Link>, which is specific about
          it.
        </p>
        <p>
          What free buys you is honesty about the flip side: no service-level
          promise, no support obligation, and no commitment that any of this
          exists next month. Generating an interview costs us real money per
          request, and if that stops being sustainable, the service can change
          or stop. You'd get no notice, because there's no mailing list to
          notify you with.
        </p>
      </LegalSection>

      <LegalSection id="ai" title="The AI can be wrong">
        <p>
          <strong>Read this one.</strong> Every question you see was written by
          a language model, and every short-answer grade was decided by one.
          That means, routinely and not just theoretically:
        </p>
        <LegalList
          items={[
            {
              term: "A question can be wrong",
              detail:
                "Ambiguous, badly worded, built on a false premise, or stating something untrue as fact. The model is confident either way — confidence here is a writing style, not a signal.",
            },
            {
              term: "An answer key can be wrong",
              detail:
                "The 'correct' answer we show you can itself be incorrect or out of date. If you're sure you're right and the page says otherwise, you may well be right.",
            },
            {
              term: "A grade can be wrong",
              detail:
                "A good short answer can be marked down and a poor one marked up. That's why we show you the expected answer and the reasoning next to your own words: so you can judge the grade instead of taking it. It is not an authority.",
            },
          ]}
        />
        <p className="mt-5">
          So: <strong>this is practice, not assessment.</strong> Nothing here is
          a qualification, a certification, professional advice, or evidence of
          competence. Do not rely on a score or an explanation from Intrv for
          any consequential decision — an exam answer, a medical or legal or
          financial question, a hiring call, or anything where being wrong costs
          something. Verify anything that matters against a real source. If a
          grade here contradicts your textbook, believe the textbook.
        </p>
      </LegalSection>

      <LegalSection id="use" title="Acceptable use">
        <p>Short list, and none of it is surprising.</p>
        <LegalList items={ACCEPTABLE} />
      </LegalSection>

      <LegalSection id="content" title="Your answers and our questions">
        <p>
          What you write stays yours. We don't claim ownership of your answers,
          and we don't use them to train anything — we couldn't, we don't train
          models. We do store them so we can show you your result, and we send
          short answers to DeepSeek so they can be graded. The{" "}
          <Link href="/privacy">privacy policy</Link> spells that out.
        </p>
        <p>
          The generated questions come from a model and we make no claim to own
          them. Use what you like from your own results. If a generated question
          happens to reproduce someone else's material, tell us and we'll remove
          it.
        </p>
        <p>
          If you create a share link, you are publishing that result to anyone
          who has the link. That's your call to make, and it currently can't be
          undone.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="Accounts and termination">
        <p>
          An account is optional. Keep your password to yourself; anything done
          through your account is treated as done by you. You can delete your
          account at any time from your settings, which removes your interviews
          along with it, permanently.
        </p>
        <p>
          We can suspend or delete an account that breaks these terms —
          particularly the harm and attack rules — and we can do it without
          warning where the alternative is letting it continue. We'll usually
          explain if you ask. There's no appeals process, because there's no
          department to run one.
        </p>
      </LegalSection>

      <LegalSection id="warranty" title="No warranty, and limits">
        <p>
          Intrv is provided <strong>as-is and as-available</strong>, with no
          warranties of any kind, express or implied, including fitness for a
          particular purpose and accuracy of content. We don't promise it will
          be available, that it will work, that a session will still be there
          tomorrow, or that anything it tells you is true.
        </p>
        <p>
          To the fullest extent the law allows, we're not liable for any damages
          arising out of your use of it — including lost data, a lost session, a
          lost mark, or a decision you made on the strength of something a model
          said here. Some places don't allow that exclusion, in which case it
          applies as far as it can and no further.
        </p>
        <p>
          <strong>Keep your own copy of anything you'd hate to lose.</strong> We
          take no backup promise on your behalf.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes and contact">
        <p>
          These terms can change; the date at the top moves when they do, and
          continuing to use Intrv after that means you accept the new version.
          Material changes are the only kind worth making, so we won't churn
          this page for fun.
        </p>
        <p>
          Anything unclear, or something to report:{" "}
          <Link href="/contact">get in touch</Link>.
        </p>
      </LegalSection>
    </>
  );
}
