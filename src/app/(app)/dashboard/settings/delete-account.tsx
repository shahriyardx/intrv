"use client";

import { WarningIcon } from "@phosphor-icons/react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AccountState, deleteAccount } from "@/server/actions/account";
import { DELETE_CONFIRMATION } from "./confirmation";

const INITIAL: AccountState = { status: "idle" };

/**
 * Typing the phrase is the confirmation. A second "are you sure?" button is
 * something people click through; spelling out the sentence is not.
 */
export function DeleteAccount({ sessionCount }: { sessionCount: number }) {
  const [state, formAction, pending] = useActionState(deleteAccount, INITIAL);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WarningIcon className="size-5 text-destructive" weight="fill" />
            Delete your account
          </DialogTitle>
          <DialogDescription>
            This deletes your account and every interview you've taken
            {sessionCount > 0 ? ` — ${sessionCount} of them` : ""}, along with
            their questions, answers and scores. It happens immediately and it
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-3">
          <Label htmlFor="confirm">
            Type <span className="font-mono">{DELETE_CONFIRMATION}</span> to
            confirm
          </Label>
          <Input
            id="confirm"
            name="confirm"
            autoComplete="off"
            required
            aria-describedby="confirm-status"
          />
          <p id="confirm-status" aria-live="polite" className="min-h-4 text-xs">
            {state.status === "error" ? (
              <span className="text-incorrect">{state.error}</span>
            ) : null}
          </p>

          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting…" : "Delete my account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
