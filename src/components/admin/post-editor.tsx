"use client";

import { WarningIcon } from "@phosphor-icons/react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataLabel } from "@/components/ui/prose";
import { Textarea } from "@/components/ui/textarea";
import { SLUG_MAX, slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { deletePostAction, savePostAction } from "@/server/actions/post";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  status: "DRAFT" | "PUBLISHED";
};

/**
 * The editor. Every button here is a convenience: savePostAction and
 * deletePostAction each re-check admin themselves, so what this component
 * offers or hides is only about not proposing a move that will be refused.
 */
export function PostEditor({ post }: { post?: Post }) {
  const [state, action, pending] = useActionState(savePostAction, null);

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [preview, setPreview] = useState(false);

  /**
   * The slug tracks the title only until the author takes it over — and never
   * for a post that already exists, whose slug is a URL someone may already
   * hold. Retyping a title must not silently move a live page.
   */
  const [slugTouched, setSlugTouched] = useState(Boolean(post));

  const published = post?.status === "PUBLISHED";
  const slugMoved = published && slug !== post.slug;

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        {post ? <input type="hidden" name="id" value={post.id} /> : null}

        <div className="grid gap-6 md:grid-cols-2">
          <Field
            label="Title"
            hint="Shown on the post page and in the listing."
            htmlFor="title"
          >
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              required
              maxLength={160}
              placeholder="What makes a good interview question"
            />
          </Field>

          <Field
            label="Slug"
            hint={`intrv.app/blog/${slug || "…"}`}
            htmlFor="slug"
          >
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              onBlur={(event) => setSlug(slugify(event.target.value))}
              required
              maxLength={SLUG_MAX}
              className="font-mono"
              placeholder="a-good-interview-question"
            />
          </Field>
        </div>

        {slugMoved ? (
          // A published slug is a live URL. Changing it is allowed — but it is
          // a move, not an edit, and the author should be told before saving
          // rather than discovering it from a broken link later.
          <p className="flex items-start gap-2 border-l-2 border-partial bg-partial-muted px-4 py-3 text-sm">
            <WarningIcon
              weight="fill"
              aria-hidden
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              This post is live at{" "}
              <code className="font-mono">/blog/{post.slug}</code>. Saving moves
              it to <code className="font-mono">/blog/{slug || "…"}</code> and
              the old link starts 404ing — nothing redirects.
            </span>
          </p>
        ) : null}

        <Field
          label="Excerpt"
          hint="The listing text and the meta description. One or two sentences."
          htmlFor="excerpt"
        >
          <Textarea
            id="excerpt"
            name="excerpt"
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            required
            maxLength={320}
            rows={2}
          />
          <Counter value={excerpt.length} max={320} />
        </Field>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <DataLabel as="span">Body</DataLabel>
              <p className="mt-1 text-xs text-muted-foreground">
                Markdown, GitHub flavour. Raw HTML is not rendered.
              </p>
            </div>
            <div className="flex gap-1">
              <ToggleButton
                active={!preview}
                onClick={() => setPreview(false)}
                label="Write"
              />
              <ToggleButton
                active={preview}
                onClick={() => setPreview(true)}
                label="Preview"
              />
            </div>
          </div>

          {/* The textarea stays mounted while previewing: unmounting it would
              drop it from the submitted FormData, and publishing an empty body
              is not a preview's business. */}
          <div className={cn(preview && "hidden")}>
            <Textarea
              id="body"
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
              rows={22}
              className="font-mono text-sm leading-relaxed"
              placeholder={"## A heading\n\nA paragraph."}
            />
          </div>

          {preview ? (
            <div className="min-h-[20rem] rounded-md border px-6 py-4">
              {body.trim() ? (
                // The same component the public page uses — a preview through a
                // different renderer would be a different page.
                <Markdown>{body}</Markdown>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nothing to preview yet.
                </p>
              )}
            </div>
          ) : null}
        </div>

        {state && !state.ok ? (
          <p className="text-sm text-incorrect">{state.error}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t pt-5">
          <Button
            type="submit"
            name="intent"
            value="draft"
            variant="outline"
            disabled={pending}
          >
            Save draft
          </Button>

          {/* Same intent either way — "publish" means "this should be live",
              and for an already-live post that reads as saving changes. */}
          <Button
            type="submit"
            name="intent"
            value="publish"
            disabled={pending}
          >
            {published ? "Save changes" : "Publish"}
          </Button>

          {published ? (
            <Button
              type="submit"
              name="intent"
              value="unpublish"
              variant="ghost"
              disabled={pending}
            >
              Unpublish
            </Button>
          ) : null}

          <span className="ml-auto text-xs text-muted-foreground">
            {pending ? "Saving…" : null}
          </span>
        </div>
      </form>

      {/* Outside the form above: a nested form is invalid HTML, and delete must
          not ride along with a save. */}
      {post ? <DeletePost id={post.id} title={post.title} /> : null}
    </div>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        <DataLabel as="span">{label}</DataLabel>
      </Label>
      {children}
      {hint ? (
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <p
      className={cn(
        "text-right font-mono text-[0.6875rem] tabular",
        value > max * 0.9 ? "text-partial" : "text-muted-foreground",
      )}
    >
      {value}/{max}
    </p>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "border px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em] transition-colors",
        active
          ? "border-foreground bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function DeletePost({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deletePostAction, null);

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-dashed px-5 py-4">
      <div>
        <p className="text-sm font-medium">Delete this post</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Gone for good, along with its URL. There is no undo.
        </p>
      </div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Delete…
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <DialogHeader>
              <DialogTitle>Delete "{title}"?</DialogTitle>
              <DialogDescription>
                This removes the post and its URL for good. Anyone holding a
                link to it gets a 404. If you only want it off the site,
                unpublish it instead.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Deleting…" : "Delete post"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
