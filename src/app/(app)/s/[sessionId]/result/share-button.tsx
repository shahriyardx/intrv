"use client";

import { CheckIcon, LinkSimpleIcon, PrinterIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createShareLink } from "@/server/actions/interview";

export function ShareButton({
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
    await navigator.clipboard.writeText(`${window.location.origin}/r/${value}`);
    setCopied(true);
    toast.success("Share link copied.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <PrinterIcon className="size-4" />
        PDF
      </Button>

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
          <LinkSimpleIcon className="size-4" />
        )}
        {copied ? "Copied" : "Share"}
      </Button>
    </>
  );
}
