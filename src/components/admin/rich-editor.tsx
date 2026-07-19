"use client";

import {
  CodeBlockIcon,
  CodeIcon,
  LinkBreakIcon,
  LinkIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  QuotesIcon,
  TextBIcon,
  TextHOneIcon,
  TextHThreeIcon,
  TextHTwoIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
} from "@phosphor-icons/react";
import Link from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { Markdown } from "tiptap-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * WYSIWYG body editor for posts.
 *
 * **Markdown stays the source of truth.** Post.body is markdown, the public
 * page renders it with react-markdown, and this editor parses markdown in and
 * serialises markdown out (tiptap-markdown). TipTap's document is an
 * intermediate representation, never the stored one — so a post written here
 * and a post pasted in as markdown are the same artifact, and the editor can be
 * swapped again later without a data migration.
 *
 * The trade that buys: anything markdown can express but this schema cannot is
 * lost on round-trip. StarterKit covers what the public renderer actually
 * supports (headings, lists, quotes, code, emphasis) plus links; raw HTML is
 * already not rendered on the public page, so dropping it here loses nothing
 * that would have shipped.
 *
 * Value flows one way, deliberately: the editor is uncontrolled after mount and
 * pushes markdown up via onChange. Feeding `value` back in on every keystroke
 * would fight the cursor.
 */
export function RichEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
}) {
  // Kept in a ref so the editor's onUpdate closure never goes stale without
  // re-creating the editor (which would blow away the document and the cursor).
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    // The editor renders identically on the server and then hydrates; without
    // this, TipTap warns and can mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Public posts are prose; a horizontal rule and hard breaks survive
        // markdown round-trip fine, so the defaults stay.
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer nofollow" },
      }),
      // Emits data-placeholder / .is-editor-empty, which globals.css styles.
      Placeholder.configure({ placeholder: placeholder ?? "Write the post…" }),
      Markdown.configure({
        html: false,
        linkify: true,
        breaks: false,
        transformPastedText: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        // .prose-editor is defined in globals.css and mirrors the public
        // markdown renderer — see the note there.
        class: "prose-editor min-h-[26rem] w-full px-4 py-3 outline-none",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(toMarkdown(instance));
    },
  });

  // Adopt an externally-replaced body (the AI generator writing a whole post),
  // but never on ordinary typing: comparing against the serialised document
  // means this only fires when the incoming value is genuinely different.
  useEffect(() => {
    if (!editor) return;
    const current = toMarkdown(editor);
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className={cn(
          "min-h-[26rem] animate-pulse rounded-md border bg-muted/30",
          className,
        )}
      />
    );
  }

  return (
    <div className={cn("rounded-md border", className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

type Editor = NonNullable<ReturnType<typeof useEditor>>;

/**
 * tiptap-markdown registers `editor.storage.markdown` at runtime but ships no
 * module augmentation for it, so TipTap's Storage type doesn't know it exists.
 * One narrow accessor rather than a cast at every call site.
 */
function toMarkdown(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown(): string } };
  return storage.markdown?.getMarkdown() ?? "";
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b p-1.5">
      <Tool
        editor={editor}
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <TextHOneIcon />
      </Tool>
      <Tool
        editor={editor}
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <TextHTwoIcon />
      </Tool>
      <Tool
        editor={editor}
        label="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <TextHThreeIcon />
      </Tool>

      <Divider />

      <Tool
        editor={editor}
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <TextBIcon />
      </Tool>
      <Tool
        editor={editor}
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <TextItalicIcon />
      </Tool>
      <Tool
        editor={editor}
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <TextStrikethroughIcon />
      </Tool>
      <Tool
        editor={editor}
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <CodeIcon />
      </Tool>

      <Divider />

      <Tool
        editor={editor}
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListBulletsIcon />
      </Tool>
      <Tool
        editor={editor}
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListNumbersIcon />
      </Tool>
      <Tool
        editor={editor}
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <QuotesIcon />
      </Tool>
      <Tool
        editor={editor}
        label="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <CodeBlockIcon />
      </Tool>

      <Divider />

      <Tool
        editor={editor}
        label="Add link"
        active={editor.isActive("link")}
        onClick={() => {
          const previous = editor.getAttributes("link").href as
            | string
            | undefined;
          const href = window.prompt("Link URL", previous ?? "https://");
          // Cancelled: leave the document alone. Emptied: unset the link.
          if (href === null) return;
          if (href.trim() === "") {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().setLink({ href: href.trim() }).run();
        }}
      >
        <LinkIcon />
      </Tool>
      <Tool
        editor={editor}
        label="Remove link"
        disabled={!editor.isActive("link")}
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <LinkBreakIcon />
      </Tool>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  editor: Editor;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(active && "bg-secondary text-secondary-foreground")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
