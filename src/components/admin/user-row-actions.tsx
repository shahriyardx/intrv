"use client";

import { DotsThreeIcon } from "@phosphor-icons/react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  banUserAction,
  setUserRoleAction,
  unbanUserAction,
} from "@/server/actions/admin";

type Props = {
  userId: string;
  email: string;
  role: string | null;
  banned: boolean;
  /** The signed-in admin's own row: an admin who bans or demotes themselves has locked us all out. */
  isSelf: boolean;
};

/**
 * The buttons are a convenience, not the authorization. Every action re-reads
 * the session with the cookie cache disabled before it touches a row, so
 * hiding an item here is only about not offering a move that will be refused.
 */
export function UserRowActions({ userId, email, role, banned, isSelf }: Props) {
  const [banOpen, setBanOpen] = useState(false);
  const [roleState, roleAction, rolePending] = useActionState(
    setUserRoleAction,
    null,
  );
  const [unbanState, unbanAction, unbanPending] = useActionState(
    unbanUserAction,
    null,
  );

  useReport(roleState);
  useReport(unbanState);

  const nextRole = role === "admin" ? "user" : "admin";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${email}`}
            disabled={rolePending || unbanPending}
          >
            <DotsThreeIcon weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <form action={roleAction}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="role" value={nextRole} />
            <DropdownMenuItem asChild disabled={isSelf}>
              <button type="submit" className="w-full" disabled={isSelf}>
                {nextRole === "admin" ? "Promote to admin" : "Demote to user"}
              </button>
            </DropdownMenuItem>
          </form>

          <DropdownMenuSeparator />

          {banned ? (
            <form action={unbanAction}>
              <input type="hidden" name="userId" value={userId} />
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  Lift ban
                </button>
              </DropdownMenuItem>
            </form>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              disabled={isSelf}
              onSelect={(event) => {
                event.preventDefault();
                setBanOpen(true);
              }}
            >
              Ban user…
            </DropdownMenuItem>
          )}

          {isSelf ? (
            <p className="px-2 py-1.5 text-[0.6875rem] text-muted-foreground">
              That's you — no self-ban, no self-demote.
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <BanDialog
        open={banOpen}
        onOpenChange={setBanOpen}
        userId={userId}
        email={email}
      />
    </>
  );
}

function BanDialog({
  open,
  onOpenChange,
  userId,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(banUserAction, null);

  useEffect(() => {
    if (state?.ok) onOpenChange(false);
  }, [state, onOpenChange]);
  useReport(state);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <DialogHeader>
            <DialogTitle>Ban {email}</DialogTitle>
            <DialogDescription>
              Signs them out everywhere and blocks sign-in. Their interviews
              stay where they are.
            </DialogDescription>
          </DialogHeader>

          <div className="my-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banReason">Reason</Label>
              <Input
                id="banReason"
                name="banReason"
                required
                minLength={3}
                maxLength={200}
                placeholder="Abusive prompts"
              />
              <p className="text-xs text-muted-foreground">
                Stored on the user row. The person you hand this app to in six
                months reads it, not you.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="banDays">Days (optional)</Label>
              <Input
                id="banDays"
                name="banDays"
                type="number"
                min={1}
                max={3650}
                inputMode="numeric"
                placeholder="Leave blank for indefinite"
              />
            </div>
          </div>

          {state && !state.ok ? (
            <p className="mb-4 text-xs text-incorrect">{state.error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Banning…" : "Ban user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function useReport(
  state: { ok: boolean; message?: string; error?: string } | null,
) {
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);
}
