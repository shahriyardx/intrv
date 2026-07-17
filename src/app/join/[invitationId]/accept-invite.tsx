"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function AcceptInvite({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);

            const result = await authClient.organization.acceptInvitation({
              invitationId,
            });

            if (result.error) {
              // The plugin refuses an invite addressed to another email, an
              // expired one, or one already used. Its message is safe to show.
              setError(
                result.error.message ??
                  "This invite can't be accepted. Ask for a new one.",
              );
              return;
            }

            toast.success("You're in.");
            // Membership is what makes this an org account, so land them on the
            // org surface. refresh() so the server re-reads the new membership.
            router.replace("/org");
            router.refresh();
          })
        }
      >
        {pending ? "Joining…" : "Accept invite"}
      </Button>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
