"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AccountState, updateDisplayName } from "@/server/actions/account";

const INITIAL: AccountState = { status: "idle" };

export function NameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-3">
      <Label htmlFor="name">Display name</Label>
      <div className="flex flex-wrap items-start gap-2">
        <Input
          id="name"
          name="name"
          // Uncontrolled: the server owns the stored value, and a successful
          // save re-renders this component with the new default anyway.
          defaultValue={name}
          maxLength={80}
          required
          aria-describedby="name-status"
          className="max-w-xs"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      <p id="name-status" aria-live="polite" className="min-h-4 text-xs">
        {state.status === "error" ? (
          <span className="text-incorrect">{state.error}</span>
        ) : state.status === "saved" ? (
          <span className="text-muted-foreground">
            Saved. You're {state.name}.
          </span>
        ) : null}
      </p>
    </form>
  );
}
