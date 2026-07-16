"use client";

import { ArrowsClockwiseIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { rotateInviteToken, toggleScreenActive } from "@/server/actions/org";

/**
 * owner/admin controls for a screen: the active switch and the token rotation.
 * Both re-fetch the page on success so the invite link and the badge reflect
 * the new state — the server DAL is the source of truth, not this local view.
 */
export function ScreenControls({
  screenId,
  active,
}: {
  screenId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [toggling, startToggle] = useTransition();
  const [rotating, startRotate] = useTransition();
  const [open, setOpen] = useState(false);

  const onToggle = () => {
    startToggle(async () => {
      const result = await toggleScreenActive(screenId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.active
          ? "Screen is accepting candidates."
          : "Screen closed — no new candidates.",
      );
      router.refresh();
    });
  };

  const onRotate = () => {
    startRotate(async () => {
      const result = await rotateInviteToken(screenId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success("New invite link generated. Old links no longer work.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 text-sm">
        <Switch
          checked={active}
          disabled={toggling}
          onCheckedChange={onToggle}
          aria-label="Accept new candidates"
        />
        <span aria-hidden className="text-muted-foreground">
          {active ? "Accepting candidates" : "Closed"}
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <ArrowsClockwiseIcon className="size-4" />
            Rotate link
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate the invite link?</DialogTitle>
            <DialogDescription>
              This mints a new link and immediately revokes every link you've
              already shared. Anyone mid-interview keeps going, but no one can
              start from an old link. There's no undo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" disabled={rotating}>
                Cancel
              </Button>
            </DialogClose>
            <Button size="sm" onClick={onRotate} disabled={rotating}>
              {rotating ? (
                <>
                  <SpinnerGapIcon className="size-4 animate-spin" />
                  Rotating…
                </>
              ) : (
                "Rotate link"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
