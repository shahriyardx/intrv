"use client";

import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataLabel } from "@/components/ui/prose";
import { createOrganization } from "@/server/actions/org";

/**
 * Creating an org redirects to it on success, so the action only ever returns
 * here to report an error.
 */
export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState(createOrganization, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label asChild>
          <DataLabel>Organization name</DataLabel>
        </Label>
        <Input
          name="name"
          required
          maxLength={80}
          placeholder="e.g. Acme Engineering"
          className="h-11"
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="min-w-40">
        {pending ? (
          <>
            <SpinnerGapIcon className="size-4 animate-spin" />
            Creating…
          </>
        ) : (
          "Create organization"
        )}
      </Button>
    </form>
  );
}
