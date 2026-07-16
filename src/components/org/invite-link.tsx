"use client";

import { CheckIcon, LinkSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * The public capability link for a screen. The full URL is built server-side
 * from BETTER_AUTH_URL and passed in, so the link a recruiter copies is the
 * deployment's real origin — not whatever host this admin page happens to be
 * open on.
 */
export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invite link copied.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
        {url}
      </code>
      <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
        {copied ? (
          <CheckIcon className="size-4" />
        ) : (
          <LinkSimpleIcon className="size-4" />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
