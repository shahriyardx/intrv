"use client";

import { CheckIcon, MarkdownLogoIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Copies a Markdown badge for a result — the thing you paste into a README or a
 * LinkedIn post to say "graded here, not typed into a screenshot". Mirrors
 * ShareButton's clipboard-plus-toast pattern; the URL is built from the current
 * origin so it works on any deploy.
 */
export function CopyBadgeButton({
  shareId,
  topic,
  difficulty,
  score,
}: {
  shareId: string | null;
  topic: string;
  difficulty: string;
  score: string | null;
}) {
  const [copied, setCopied] = useState(false);

  // No share id means the link isn't public yet; nothing honest to copy.
  if (!shareId || score === null) return null;

  const copy = async () => {
    const url = `${window.location.origin}/r/${shareId}`;
    const markdown = `[Scored ${score}% in ${topic} (${difficulty.toUpperCase()}) on Intrv](${url})`;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    toast.success("Badge Markdown copied.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="no-print h-7 gap-1.5 px-2 text-muted-foreground text-xs"
      onClick={() => void copy()}
    >
      {copied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <MarkdownLogoIcon className="size-3.5" />
      )}
      {copied ? "Copied" : "Copy badge"}
    </Button>
  );
}
