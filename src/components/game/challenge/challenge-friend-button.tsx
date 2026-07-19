"use client";

import { CheckIcon, SwordIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createShareLink } from "@/server/actions/interview";

/**
 * Turns a graded result into a head-to-head invite. Reuses the same share link
 * as ShareButton — a challenge is just that link pointed at /challenge — so it
 * ensures a shareId exists (once), then copies the invite URL to the clipboard.
 * Same clipboard + toast + transient-checkmark pattern as ShareButton.
 */
export function ChallengeFriendButton({
  sessionId,
  shareId,
}: {
  sessionId: string;
  shareId: string | null;
}) {
  const [id, setId] = useState(shareId);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/challenge/${value}`,
    );
    setCopied(true);
    toast.success("Challenge link copied — send it to a friend.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (id) {
          void copy(id);
          return;
        }
        start(async () => {
          const result = await createShareLink(sessionId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setId(result.shareId);
          await copy(result.shareId);
        });
      }}
    >
      {copied ? (
        <CheckIcon className="size-4" />
      ) : (
        <SwordIcon className="size-4" />
      )}
      {copied ? "Copied" : "Challenge a friend"}
    </Button>
  );
}
