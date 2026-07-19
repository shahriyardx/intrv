"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { SLUG_MAX, SLUG_PATTERN } from "@/lib/slug";
import { generateBlogPost } from "@/server/ai/blog";
import { AiError } from "@/server/ai/client";
import { requireFreshAdmin } from "@/server/dal/admin";

export type PostActionState =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Every action here re-establishes its own admin with the session cookie cache
 * disabled, exactly as src/server/actions/admin.ts does. Server Functions are
 * POST endpoints reachable directly — the editor page that rendered the button
 * proves nothing about who is calling — and the cookie cache would otherwise
 * let an admin revoked seconds ago keep publishing to a public page.
 *
 * A non-admin gets the same flat "Not found." as everywhere else on this
 * surface, so a refusal never confirms that /admin/posts exists.
 */
const NOT_FOUND: PostActionState = { ok: false, error: "Not found." };

/**
 * Postgres would reject anything longer anyway (VarChar on slug/title/excerpt);
 * validating here turns a 500 into a sentence the author can act on. The body
 * cap is ours: `body` is unbounded Text, and an unbounded POST into a public
 * page's render path is not something to leave open.
 */
const BODY_MAX = 100_000;

const postSchema = z.object({
  title: z.string().trim().min(1, "Give it a title.").max(160),
  slug: z
    .string()
    .trim()
    .min(1, "Give it a slug.")
    .max(SLUG_MAX)
    .regex(
      SLUG_PATTERN,
      "Slug must be lowercase words joined by single hyphens.",
    ),
  excerpt: z
    .string()
    .trim()
    .min(
      1,
      "Write an excerpt — it is the listing text and the meta description.",
    )
    .max(320),
  body: z.string().trim().min(1, "The post is empty.").max(BODY_MAX),
  id: z.string().min(1).optional(),
  intent: z.enum(["draft", "publish", "unpublish"]),
});

function fieldError(error: z.ZodError): PostActionState {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input." };
}

/**
 * The slug column is unique, so a collision is a real error rather than a
 * crash. Racing authors make the pre-check insufficient on its own, which is
 * why this catches the constraint too.
 */
function isSlugCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * The public pages read the database on every request, so they never serve a
 * stale post. This clears the *client-side* router cache, which would otherwise
 * hand a visitor who was on /blog a few seconds ago the index without the post
 * that was just published.
 */
function revalidateBlog(slug: string, previousSlug?: string) {
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  if (previousSlug && previousSlug !== slug)
    revalidatePath(`/blog/${previousSlug}`);
  revalidatePath("/admin/posts");
}

export async function savePostAction(
  _prev: unknown,
  formData: FormData,
): Promise<PostActionState | never> {
  const admin = await requireFreshAdmin();
  if (!admin) return NOT_FOUND;

  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt"),
    body: formData.get("body"),
    id: formData.get("id") || undefined,
    intent: formData.get("intent"),
  });
  if (!parsed.success) return fieldError(parsed.error);

  const { id, intent, ...fields } = parsed.data;
  const status = intent === "publish" ? "PUBLISHED" : "DRAFT";

  const existing = id
    ? await prisma.post.findUnique({
        where: { id },
        select: { id: true, slug: true, publishedAt: true },
      })
    : null;

  if (id && !existing)
    return { ok: false, error: "That post no longer exists." };

  // Set on the first publish only. Re-publishing after an unpublish keeps the
  // original date — the post is not new again, and a save must never bump it.
  const publishedAt =
    status === "PUBLISHED" && !existing?.publishedAt
      ? new Date()
      : (existing?.publishedAt ?? null);

  if (existing) {
    try {
      await prisma.post.update({
        where: { id: existing.id },
        data: { ...fields, status, publishedAt },
      });
    } catch (error) {
      if (isSlugCollision(error)) {
        return {
          ok: false,
          error: `The slug "${fields.slug}" is already taken.`,
        };
      }
      throw error;
    }

    revalidateBlog(fields.slug, existing.slug);
    return { ok: true, message: messageFor(intent) };
  }

  let created: { id: string };
  try {
    created = await prisma.post.create({
      data: { ...fields, status, publishedAt, authorId: admin.userId },
      select: { id: true },
    });
  } catch (error) {
    if (isSlugCollision(error)) {
      return {
        ok: false,
        error: `The slug "${fields.slug}" is already taken.`,
      };
    }
    throw error;
  }

  revalidateBlog(fields.slug);
  // redirect() throws, so it must sit outside the try above or the catch would
  // swallow it. A new post moves to its own edit URL: the next save has to be
  // an update, not a second create.
  redirect(`/admin/posts/${created.id}`);
}

function messageFor(intent: "draft" | "publish" | "unpublish"): string {
  if (intent === "publish") return "Published. It is live on /blog.";
  if (intent === "unpublish") return "Unpublished. It is no longer public.";
  return "Draft saved.";
}

export async function deletePostAction(
  _prev: unknown,
  formData: FormData,
): Promise<PostActionState | never> {
  const admin = await requireFreshAdmin();
  if (!admin) return NOT_FOUND;

  const parsed = z
    .object({ id: z.string().min(1) })
    .safeParse({ id: formData.get("id") });
  if (!parsed.success) return fieldError(parsed.error);

  const post = await prisma.post.findUnique({
    where: { id: parsed.data.id },
    select: { slug: true },
  });
  if (!post) return { ok: false, error: "That post no longer exists." };

  await prisma.post.delete({ where: { id: parsed.data.id } });

  revalidateBlog(post.slug);
  redirect("/admin/posts");
}

export type GeneratePostState =
  | {
      ok: true;
      post: {
        title: string;
        slug: string;
        excerpt: string;
        body: string;
      };
      /** Shown to the operator so they know what the research pass did. */
      note: string;
    }
  | { ok: false; error: string };

/**
 * Draft a post with the model.
 *
 * Returns the draft rather than saving it: the operator reads it, edits it, and
 * publishes deliberately. Nothing generated reaches a public page without a
 * person pressing publish, which is the only real defence against shipping a
 * piece that is wrong or reads like a machine wrote it.
 *
 * Titles already published are passed in so the generator can avoid re-covering
 * ground — see server/ai/blog.ts for how uniqueness and link verification work.
 */
export async function generatePostAction(
  _prev: unknown,
  formData: FormData,
): Promise<GeneratePostState> {
  const admin = await requireFreshAdmin();
  // Same flat refusal as the rest of this surface — NOT_FOUND is typed for the
  // save/delete actions, so it is restated here rather than widened.
  if (!admin) return { ok: false, error: "Not found." };

  const topicRaw = String(formData.get("topic") ?? "").trim();
  if (topicRaw.length > 120) {
    return { ok: false, error: "That topic is too long." };
  }

  const existing = await prisma.post.findMany({
    select: { title: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  try {
    const draft = await generateBlogPost({
      topic: topicRaw || null,
      existingTitles: existing.map((post) => post.title),
    });

    const parts = [
      draft.linksKept > 0
        ? `${draft.linksKept} link${draft.linksKept === 1 ? "" : "s"} verified.`
        : "No links survived verification.",
      draft.linksDropped > 0
        ? `${draft.linksDropped} dead link${draft.linksDropped === 1 ? "" : "s"} removed.`
        : null,
    ].filter(Boolean);

    return {
      ok: true,
      post: {
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        body: draft.body,
      },
      note: parts.join(" "),
    };
  } catch (error) {
    const message =
      error instanceof AiError
        ? error.message
        : "The model didn't return a usable draft.";
    return { ok: false, error: message };
  }
}
