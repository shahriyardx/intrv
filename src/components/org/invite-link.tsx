"use client";

import { CheckIcon, LinkSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The public capability link for an assessment. The full URL is built server-side
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
    <div className="flex items-center gap-2">
      {/* A real Input rather than a styled <code>: it shares the control
          sizing, and it stays selectable when the clipboard API is blocked. */}
      <Input
        readOnly
        value={url}
        aria-label="Invite link"
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 font-mono text-muted-foreground"
      />
      <Button variant="outline" onClick={copy} className="shrink-0">
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
