"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { WarningIcon } from "@phosphor-icons/react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { RichEditor } from "@/components/admin/rich-editor";
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
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
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

// Client-side mirror of the fields' rules — UX only; savePostAction re-validates
// and stays the security boundary. The `intent` (draft/publish/unpublish) rides
// on the clicked submit button, captured from the submit event.
const schema = z.object({
  title: z.string().trim().min(1, "Give the post a title.").max(160),
  slug: z.string().trim().min(1, "The post needs a slug.").max(SLUG_MAX),
  excerpt: z.string().trim().min(1, "Write a short excerpt.").max(320),
  body: z.string().trim().min(1, "The body can't be empty."),
});

type Values = z.infer<typeof schema>;

/**
 * The editor. Every button here is a convenience: savePostAction and
 * deletePostAction each re-check admin themselves, so what this component
 * offers or hides is only about not proposing a move that will be refused.
 */
export function PostEditor({ post }: { post?: Post }) {
  // reactCompiler breaks RHF v7's formState Proxy subscription — opt out.
  "use no memo";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: post?.title ?? "",
      slug: post?.slug ?? "",
      excerpt: post?.excerpt ?? "",
      body: post?.body ?? "",
    },
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState(false);
  // A stable ref, not the submit event's currentTarget: RHF awaits async
  // validation first, by which point React has nulled currentTarget. The clicked
  // submit button's intent is captured on its onClick, since a ref-built
  // FormData carries no submitter.
  const formRef = useRef<HTMLFormElement>(null);
  const intentRef = useRef<string>("publish");

  /**
   * The slug tracks the title only until the author takes it over — and never
   * for a post that already exists, whose slug is a URL someone may already
   * hold. Retyping a title must not silently move a live page.
   */
  const [slugTouched, setSlugTouched] = useState(Boolean(post));

  const { errors } = form.formState;
  const slug = form.watch("slug");
  const excerptLength = form.watch("excerpt")?.length ?? 0;
  const body = form.watch("body") ?? "";

  const published = post?.status === "PUBLISHED";
  const slugMoved = published && slug !== post.slug;

  const onSubmit = form.handleSubmit(() => {
    if (!formRef.current) return;
    // The hidden id rides along in the form; the intent comes from whichever
    // button was clicked (captured in intentRef on its onClick).
    const data = new FormData(formRef.current);
    data.set("intent", intentRef.current);
    setServerError(null);
    startTransition(async () => {
      const result = await savePostAction(null, data);
      if (result?.ok) {
        toast.success(result.message);
      } else if (result) {
        toast.error(result.error);
        setServerError(result.error);
      }
    });
  });

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
        {post ? <input type="hidden" name="id" value={post.id} /> : null}

        <div className="grid gap-6 md:grid-cols-2">
          <Field>
            <Label htmlFor="title">
              <DataLabel as="span">Title</DataLabel>
            </Label>
            <Input
              id="title"
              maxLength={160}
              placeholder="What makes a good interview question"
              aria-invalid={errors.title ? true : undefined}
              {...form.register("title", {
                onChange: (event) => {
                  if (!slugTouched) {
                    form.setValue("slug", slugify(event.target.value));
                  }
                },
              })}
            />
            <FieldError errors={[errors.title]} />
            <FieldDescription>
              Shown on the post page and in the listing.
            </FieldDescription>
          </Field>

          <Field>
            <Label htmlFor="slug">
              <DataLabel as="span">Slug</DataLabel>
            </Label>
            <Input
              id="slug"
              maxLength={SLUG_MAX}
              className="font-mono"
              placeholder="a-good-interview-question"
              aria-invalid={errors.slug ? true : undefined}
              {...form.register("slug", {
                onChange: () => setSlugTouched(true),
                onBlur: (event) =>
                  form.setValue("slug", slugify(event.target.value)),
              })}
            />
            <FieldError errors={[errors.slug]} />
            <FieldDescription className="truncate">
              intrv.app/blog/{slug || "…"}
            </FieldDescription>
          </Field>
        </div>

        {slugMoved ? (
          // A published slug is a live URL. Changing it is allowed — but it is
          // a move, not an edit, and the author should be told before saving
          // rather than discovering it from a broken link later.
          <p className="flex items-start gap-2 border-partial border-l-2 bg-partial-muted px-4 py-3 text-sm">
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

        <Field>
          <Label htmlFor="excerpt">
            <DataLabel as="span">Excerpt</DataLabel>
          </Label>
          <Textarea
            id="excerpt"
            maxLength={320}
            rows={2}
            aria-invalid={errors.excerpt ? true : undefined}
            {...form.register("excerpt")}
          />
          <FieldError errors={[errors.excerpt]} />
          <div className="flex items-baseline justify-between gap-3">
            <FieldDescription>
              The listing text and the meta description. One or two sentences.
            </FieldDescription>
            <Counter value={excerptLength} max={320} />
          </div>
        </Field>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <DataLabel as="span">Body</DataLabel>
              <p className="mt-1 text-muted-foreground text-xs">
                Formatting applies as you type. Stored as markdown; raw HTML is
                not rendered.
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

          {/* The editor is a controlled island, so the value has to reach the
              form some other way — a hidden input keeps FormData working and
              keeps the textarea's old submit path intact. */}
          <input type="hidden" {...form.register("body")} />

          <div className={cn(preview && "hidden")}>
            <RichEditor
              value={body}
              onChange={(markdown) =>
                form.setValue("body", markdown, { shouldValidate: true })
              }
              placeholder="Write the post…"
            />
          </div>

          {preview ? (
            <div className="min-h-[20rem] rounded-md border px-6 py-4">
              {body.trim() ? (
                // The same component the public page uses — a preview through a
                // different renderer would be a different page.
                <Markdown>{body}</Markdown>
              ) : (
                <p className="py-12 text-center text-muted-foreground text-sm">
                  Nothing to preview yet.
                </p>
              )}
            </div>
          ) : null}
          <FieldError errors={[errors.body]} />
        </div>

        {serverError ? (
          <p className="text-incorrect text-sm">{serverError}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t pt-5">
          <Button
            type="submit"
            variant="outline"
            disabled={pending}
            onClick={() => {
              intentRef.current = "draft";
            }}
          >
            Save draft
          </Button>

          {/* Same intent either way — "publish" means "this should be live",
              and for an already-live post that reads as saving changes. */}
          <Button
            type="submit"
            disabled={pending}
            onClick={() => {
              intentRef.current = "publish";
            }}
          >
            {published ? "Save changes" : "Publish"}
          </Button>

          {published ? (
            <Button
              type="submit"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                intentRef.current = "unpublish";
              }}
            >
              Unpublish
            </Button>
          ) : null}

          <span className="ml-auto text-muted-foreground text-xs">
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

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <p
      className={cn(
        "shrink-0 text-right font-mono text-[0.6875rem] tabular",
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

/**
 * A single-button destructive action behind a confirm dialog — deliberately
 * left as a native action form, not react-hook-form: there are no fields to
 * validate, only a confirmation.
 */
function DeletePost({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deletePostAction, null);

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-dashed px-5 py-4">
      <div>
        <p className="font-medium text-sm">Delete this post</p>
        <p className="mt-1 text-muted-foreground text-xs">
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
