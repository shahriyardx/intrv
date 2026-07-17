import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalHeader,
  LegalList,
  LegalSection,
  ShortVersion,
} from "@/components/marketing/legal";
import { Measure } from "@/components/ui/page";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Intrv stores, what gets sent to DeepSeek, and what a shared result link exposes. In plain language.",
};

// Hardcoded: reading the clock in a Server Component is rejected during a
// prerender under cacheComponents, and a policy date should change when the
// policy does — not on every request.
const UPDATED = "17 July 2026";

const STORED = [
  {
    term: "Your interviews",
    detail:
      "The topic you typed, the difficulty and question count you chose, any time limit, when you started and submitted, the questions that were generated, your answers to them, the grade and feedback for each, and your overall score.",
  },
  {
    term: "Your account, if you make one",
    detail:
      "Your name and email address. If you signed up with a password, a hash of it — never the password itself. If you signed in with Google, the name, email and profile picture Google gives us, plus the access tokens that let us do so.",
  },
  {
    term: "Your sign-in sessions",
    detail:
      "For each active sign-in: a session token, an expiry, and the IP address and browser user-agent it was created from. This is how a signed-in session works and how we can tell one apart from another.",
  },
  {
    term: "Rate-limiting counters",
    detail:
      "A short-lived count of recent requests, keyed by IP address, so that sign-in and sign-up can't be brute-forced. It holds a counter and a timestamp, nothing about you.",
  },
  {
    term: "What our AI calls cost",
    detail:
      "For each call we make to DeepSeek: the model used, whether it was generating or grading, token counts, the cost in dollars, how long it took, and whether it failed. No prompt text and no answer text is stored in this log — it is an accounting record, not a transcript.",
  },
  {
    term: "Anything you send us",
    detail:
      "If you use the contact form, the name, email, subject and message you put in it. It is stored so we can read and reply to it.",
  },
];

const NOT_STORED = [
  {
    term: "No advertising, ever",
    detail:
      "There are no ad networks, no ad pixels, no conversion trackers, and nothing about you is sold, rented or shared with a data broker. There is no business model here that would want it.",
  },
  {
    term: "No third-party analytics",
    detail:
      "No Google Analytics, no Meta pixel, no PostHog, no Mixpanel, no Sentry, no session replay. There is not a single third-party script on this site. The 'analytics' in your dashboard is a database query over your own sessions and goes nowhere else.",
  },
  {
    term: "No cross-site tracking",
    detail:
      "We don't know and don't try to know what you do anywhere other than here. Our fonts are bundled at build time, so even loading a page makes no request to Google.",
  },
];

export default function PrivacyPage() {
  return (
    <Measure>
      <LegalHeader label="Privacy" title="Privacy policy" updated={UPDATED}>
        <p className="mt-6 max-w-[68ch] text-pretty leading-relaxed text-muted-foreground">
          This describes what Intrv actually does with what you type. It was
          written against the code, not from a template.
        </p>
      </LegalHeader>

      <ShortVersion
        points={[
          "Your topic and your short answers are sent to DeepSeek, a third-party AI company, to write and grade your interview. Your name, email and IP are not.",
          "There is no advertising, no third-party analytics and no tracking of any kind on this site.",
          "If you're signed out, anyone who has your session's URL can read that session. The link is the key.",
          "A share link you create is public to anyone holding it. It shows your answers, not your name.",
          "One cookie when you're signed in. Your theme preference lives in your own browser, not on our server.",
          "Deleting your account deletes your interviews with it.",
        ]}
      />

      <LegalSection id="ai" title="What gets sent to DeepSeek">
        <p>
          <strong>
            This is the most important thing on this page, so it goes first.
          </strong>{" "}
          Intrv does not run its own AI. To write your questions and grade your
          written answers, we send text to{" "}
          <a
            href="https://www.deepseek.com"
            rel="noreferrer noopener"
            target="_blank"
          >
            DeepSeek
          </a>
          , a separate company, over their API. Once that text reaches them, it
          is subject to their privacy policy and their retention practices, not
          ours. We do not control how long they keep it or what they do with it.
        </p>
        <p>Specifically, here is what leaves our servers and what does not.</p>
        <LegalList
          items={[
            {
              term: "Sent — the topic you type",
              detail:
                "Verbatim, as part of the request asking for questions. If you type something personal or identifying into the topic box, that text goes to DeepSeek. Don't put anything in there you wouldn't hand to a third party.",
            },
            {
              term: "Sent — your short answers",
              detail:
                "Verbatim, alongside the question and the expected answer, so they can be graded and given feedback. Whatever you write in a short-answer box is read by a model at DeepSeek. Multiple choice and true/false answers are never sent — those are graded on our own server against the answer key.",
            },
            {
              term: "Not sent — who you are",
              detail:
                "No name, no email address, no user ID, no IP address, no sign-in session. Nothing in the request identifies you as a person. The only identifier that crosses the wire is the random ID of the question being graded, so the grade can be matched back to it.",
            },
          ]}
        />
        <p className="mt-5">
          A few honest details. Requests are retried up to four times if they
          fail, so the same text may be transmitted more than once. Our prompts
          are built to be cacheable on DeepSeek's side, which means they sit in
          DeepSeek's cache by design. And we have not configured any
          zero-retention or training opt-out with them — we are telling you that
          rather than implying a protection that isn't there.
        </p>
        <p>
          If you don't want text going to a third-party model, the way to
          achieve that is not to type it here. That's the whole trade: the
          product cannot write or grade an interview without sending the words
          to the thing that writes and grades it.
        </p>
      </LegalSection>

      <LegalSection id="stored" title="What we store">
        <p>
          All of it lives in our own Postgres database. Nothing below is shared
          with anyone, other than the text described above going to DeepSeek.
        </p>
        <LegalList items={STORED} />
      </LegalSection>

      <LegalSection id="not-stored" title="What we don't do">
        <p>
          The absences are as much the policy as the presences, and they're true
          today rather than aspirational.
        </p>
        <LegalList items={NOT_STORED} />
      </LegalSection>

      <LegalSection id="access" title="Who can read your interviews">
        <p>
          This part is unusual, so read it properly. There are two different
          situations and they have genuinely different consequences.
        </p>
        <LegalList
          items={[
            {
              term: "Signed out — the URL is the key",
              detail:
                "A session you start while signed out has no owner. Anybody who has its URL can open it and read the questions and your answers. There is no password on it and we cannot tell a stranger holding the link apart from you. The URL contains a long random ID, so it is not guessable, but it is not secret either: if you paste it into a group chat, everyone in that chat can read your session. That is the deal that lets you use Intrv without an account.",
            },
            {
              term: "Signed in — only you",
              detail:
                "A session you start while signed in belongs to your account. A stranger who somehow learned its URL gets nothing. This is the one real advantage of an account, privacy-wise.",
            },
            {
              term: "Share links are public",
              detail:
                "If you turn a graded result into a share link, that link is readable by anyone who has it, with no account. It shows the questions, your answers, the grades and the feedback — but not your name or email. It also generates a preview card, so pasting it into Slack or a social site will render your result there. There is currently no way to revoke a share link once created, so treat creating one as publishing.",
            },
          ]}
        />
      </LegalSection>

      <LegalSection id="cookies" title="Cookies and local storage">
        <p>
          There is no cookie banner because there is nothing to consent to. We
          set no advertising or analytics cookies, because we have no
          advertising or analytics.
        </p>
        <LegalList
          items={[
            {
              term: "A session cookie — only when signed in",
              detail:
                "Set when you sign in, so that the next page knows it's you. It's HTTP-only, so scripts can't read it, and it expires after seven days. Signed out, we set no cookie at all. Signing out clears it.",
            },
            {
              term: "A short-lived sign-in cache",
              detail:
                "A companion cookie that caches your session for five minutes to avoid hitting the database on every page load. Same lifetime rules, same purpose.",
            },
            {
              term: "Transient cookies during Google sign-in",
              detail:
                "If you sign in with Google, two temporary cookies exist for the seconds of the redirect to guard against request forgery. They're gone once you land back here.",
            },
            {
              term: "Your theme preference — not a cookie",
              detail:
                "Whether you chose light or dark is stored in your browser's own local storage, under the key 'theme'. It never reaches our server, and it isn't sent with any request. Clearing your site data resets it.",
            },
          ]}
        />
      </LegalSection>

      <LegalSection id="retention" title="How long we keep it">
        <p>
          Plainly:{" "}
          <strong>we don't currently delete anything on a schedule.</strong>{" "}
          There is no job quietly ageing out old interviews. A session you took
          today will still be in the database next year unless it's deleted, and
          we'd rather say that than gesture at a retention period we don't
          actually enforce.
        </p>
        <p>
          Sign-in sessions are the exception — they expire after seven days on
          their own, and rate-limit counters roll over within seconds.
        </p>
      </LegalSection>

      <LegalSection id="control" title="Deleting your data">
        <p>
          If you have an account, you can delete it from your account settings.
          It asks you to type a confirmation phrase because it is genuinely
          irreversible. Deleting it removes your user record, your sign-in
          sessions, any linked Google account, and every interview you took
          while signed in — the questions, your answers, the grades, all of it.
          Our cost log keeps its rows, but they're detached from you and contain
          no text.
        </p>
        <p>
          Interviews you took <em>while signed out</em> are a different matter.
          They aren't linked to any account, which means we have no way to look
          at one and tell that it was yours. If you want one deleted, send us
          its URL through the <Link href="/contact">contact form</Link> and
          we'll remove it. Anything you already shared with a share link, assume
          has been seen.
        </p>
        <p>
          We can't send email — there's no mail provider wired up — so there are
          no password-reset or verification emails, and any reply to you happens
          by hand.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes and contact">
        <p>
          If this policy changes in a way that matters, the date at the top
          changes with it. There's no mailing list to notify, because we don't
          have one.
        </p>
        <p>
          Questions about any of the above, or a request to delete something:{" "}
          <Link href="/contact">get in touch</Link>.
        </p>
      </LegalSection>
    </Measure>
  );
}
