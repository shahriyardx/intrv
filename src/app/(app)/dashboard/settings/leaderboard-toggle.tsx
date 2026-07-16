"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setLeaderboardVisibility } from "@/server/actions/leaderboard";

/**
 * The leaderboard is public and on by default, so this control is the whole of
 * a user's consent. It has to be honest about what it does and take effect
 * immediately — optimistic state is rolled back if the write fails, because
 * telling someone they are hidden when they are not would be the worst possible
 * bug on this page.
 */
export function LeaderboardToggle({ optedOut }: { optedOut: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(!optedOut);
  const [pending, start] = useTransition();

  function onChange(next: boolean) {
    const previous = visible;
    setVisible(next);

    start(async () => {
      const result = await setLeaderboardVisibility(next);
      if (!result.ok) {
        setVisible(previous);
        toast.error(result.error);
        return;
      }
      toast.success(next ? "You're on the leaderboard." : "You're hidden.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="space-y-1">
        <Label htmlFor="leaderboard" className="text-sm">
          Show me on the leaderboard
        </Label>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Your display name, points and interview count appear on the{" "}
          <Link
            href="/leaderboard"
            className="text-foreground underline underline-offset-4"
          >
            public leaderboard
          </Link>
          , which anyone can read — including people who aren't signed in. Turn
          this off and you're left out of it entirely. Interviews you took while
          signed out are never on it.
        </p>
      </div>
      <Switch
        id="leaderboard"
        checked={visible}
        disabled={pending}
        onCheckedChange={onChange}
      />
    </div>
  );
}
