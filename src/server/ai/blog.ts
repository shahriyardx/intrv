import "server-only";
import { z } from "zod";
import { callStructured } from "@/server/ai/client";
import { MODELS } from "@/server/ai/models";
import {
  applyLinkVerification,
  extractLinks,
  verifyUrls,
} from "@/server/research/links";

/**
 * Generates a blog post about interview preparation.
 *
 * The brief is "not AI slop", which is a real engineering constraint rather
 * than a vibe, so three things are done about it:
 *
 * 1. **A stated angle.** Slop is generic because nothing forced it to commit.
 *    Every generation draws an ANGLE and a SHAPE at random, and the prompt
 *    requires the piece to argue that specific line. Two posts on the same
 *    topic come out differently because they were asked different questions.
 * 2. **A banned-phrase list.** The tells are learnable — "in today's
 *    fast-paced", "delve", "it's worth noting", "unlock", the three-item rule
 *    of three, the summarising final paragraph that repeats the intro. They are
 *    named in the prompt and checked again after.
 * 3. **Verified links only.** See research/sources.ts: the model cannot browse,
 *    so every URL it writes is checked over the network and unwrapped to plain
 *    text if it does not resolve. A fabricated citation is the loudest tell of
 *    all, and it is the one thing a reader can catch us on.
 *
 * Uniqueness is enforced against the titles already published: they go into the
 * prompt as ground already covered.
 */

/** Angles a post can take. Drawn at random, then argued. */
const ANGLES = [
  "argue against a piece of common interview advice that is actually wrong",
  "explain why a concept people 'know' still trips them up under pressure",
  "compare how a topic is asked at junior versus senior level",
  "take a question that looks simple and show what a strong answer actually contains",
  "describe a specific failure mode candidates hit, and the fix",
  "explain what an interviewer is really testing when they ask a particular thing",
  "take a widely-repeated rule of thumb and give the conditions where it breaks",
  "walk through the reasoning a strong candidate does out loud",
];

/** Structures, so the shape varies as much as the argument. */
const SHAPES = [
  "open on a concrete wrong answer, diagnose it, then generalise",
  "start from the interviewer's side of the table, then turn to the candidate's",
  "one question examined in increasing depth, three passes",
  "a claim in the first line, then the evidence for it, then the caveat",
  "a short narrative of a real-feeling interview moment, then the lesson",
];

/** Topics the generator can pick from when the operator has no preference. */
const TOPICS = [
  "JavaScript closures and scope",
  "React rendering and state",
  "SQL query performance",
  "system design fundamentals",
  "HTTP and web fundamentals",
  "data structures under interview pressure",
  "debugging and diagnosis questions",
  "Git and version control workflow",
  "concurrency and async models",
  "API design and REST semantics",
  "testing strategy",
  "Docker and containers",
  "algorithmic complexity",
  "behavioural questions for engineers",
];

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export type GeneratedPost = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  /** How many cited links survived verification, and how many did not. */
  linksKept: number;
  linksDropped: number;
};

const schema = z.object({
  title: z.string().min(8).max(160),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  excerpt: z.string().min(40).max(320),
  body: z.string().min(600),
});

const parameters = {
  type: "object",
  additionalProperties: false,
  required: ["title", "slug", "excerpt", "body"],
  properties: {
    title: {
      type: "string",
      description:
        "A specific title that states the piece's claim. Not a listicle, not a question, no colon-subtitle pattern.",
    },
    slug: {
      type: "string",
      description: "Lowercase kebab-case URL segment derived from the title.",
    },
    excerpt: {
      type: "string",
      description:
        "One or two sentences that say what the piece argues. Not a teaser, not 'in this post we will'.",
    },
    body: {
      type: "string",
      description:
        "The post in GitHub-flavoured markdown. Starts with a paragraph, never a heading or the title.",
    },
  },
} as const;

/**
 * The static half of the prompt. Kept byte-identical across generations so
 * DeepSeek's automatic prefix cache hits — the variable half (topic, angle,
 * sources, titles already used) travels in the user message.
 */
const SYSTEM = `You write for the engineering blog of Intrv, a tool that generates and grades practice interviews.

Your readers are working engineers and students preparing for technical interviews. They are not beginners and they can tell when they are being padded.

WHAT YOU ARE WRITING
A short, opinionated piece — 600 to 1000 words — that makes one argument and supports it. Not an overview. Not a listicle. Not a summary of a topic. One claim, argued.

VOICE
- Write like a competent engineer explaining something to a colleague, in plain prose.
- Prefer the concrete to the abstract. A real question, a real wrong answer, a real reason it is wrong.
- Have an opinion and defend it. If the topic has a common belief that is wrong, say so plainly.
- Vary sentence length. Some short. Some that carry a longer thought through a couple of clauses before landing.
- Contractions are fine. First person is fine when it earns its place.

NEVER WRITE THESE — they are the tells that mark text as machine-written:
- "In today's fast-paced world", "In the ever-evolving landscape", "In the world of"
- "delve", "dive deep", "unlock", "unleash", "harness", "leverage" (as a verb), "robust", "seamless", "game-changer", "supercharge", "elevate"
- "It's worth noting that", "It's important to remember", "That said,", "Moreover,", "Furthermore,", "Additionally," as paragraph openers
- "Whether you're a beginner or an experienced developer"
- "Let's dive in", "Let's explore", "In this post, we'll"
- A closing paragraph that restates the introduction. End on the last real point, or on a specific thing to go do.
- Rhetorical questions used as section headings.
- Bold text scattered through paragraphs for emphasis.
- Everything arriving in threes. Real arguments have uneven numbers of parts.
- Em-dashes in more than about two places.

STRUCTURE
- Start with a sentence that says something. Not context-setting, not throat-clearing.
- Use ## and ### headings, but only where the piece genuinely turns. Two or three, not one per paragraph.
- Lists only where the content is genuinely a list. Prose is the default.
- Code blocks with a language tag where a concrete example helps. Keep them short and real.
- No title heading at the top — the title is stored separately and rendered above the body.

LINKS
- Link only to pages you are confident exist at the exact URL given. Official documentation and specifications are safest.
- Every link must be a real, complete https URL. Never invent a plausible-looking path.
- Two to five links across the piece. Zero is better than one you are unsure of.
- Link inline on meaningful words, never "click here" and never a bare URL.
- Do not add a "References" or "Further reading" section.

Return the post through the tool.`;

export async function generateBlogPost(opts: {
  /** Operator's topic, or null to let the generator choose. */
  topic?: string | null;
  /** Titles already published — ground not to cover again. */
  existingTitles: string[];
  signal?: AbortSignal;
}): Promise<GeneratedPost> {
  const topic = opts.topic?.trim() || pick(TOPICS);
  const angle = pick(ANGLES);
  const shape = pick(SHAPES);

  const user = [
    `TOPIC: ${topic}`,
    `ANGLE: ${angle}`,
    `SHAPE: ${shape}`,
    "",
    opts.existingTitles.length > 0
      ? [
          "ALREADY PUBLISHED — do not repeat these arguments or titles. Find a different line on the topic:",
          ...opts.existingTitles.slice(0, 40).map((t) => `- ${t}`),
        ].join("\n")
      : "Nothing published yet.",
  ].join("\n");

  const draft = await callStructured({
    model: MODELS.pro,
    purpose: "blog",
    system: SYSTEM,
    user,
    toolName: "emit_post",
    toolDescription: "Return the finished blog post.",
    parameters,
    schema,
    // Long-form generation on the reasoning model; well under the 10 min cutoff.
    timeoutMs: 300_000,
    signal: opts.signal,
  });

  // Every link the model wrote, checked over the network. Survivors are
  // rewritten to their resolved URL; the rest become plain text.
  const resolved = await verifyUrls(extractLinks(draft.body));
  const { body, kept, dropped } = applyLinkVerification(draft.body, resolved);

  return {
    title: draft.title.trim(),
    slug: draft.slug.trim(),
    excerpt: draft.excerpt.trim(),
    body: stripLeadingTitle(body, draft.title).trim(),
    linksKept: kept,
    linksDropped: dropped,
  };
}

/**
 * Models restate the title as an H1 despite being told not to, and the post
 * page already renders the title above the body. Removed here rather than
 * relied on in the prompt.
 */
function stripLeadingTitle(body: string, title: string): string {
  const lines = body.split("\n");
  const first = lines.findIndex((line) => line.trim() !== "");
  if (first === -1) return body;

  const line = lines[first].trim();
  const heading = line.match(/^#{1,2}\s+(.*)$/);
  if (!heading) return body;

  const normalise = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  if (normalise(heading[1]) !== normalise(title)) return body;

  lines.splice(first, 1);
  return lines.join("\n");
}
