"use client";

import { CheckIcon, PlusIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/server/actions/follow";

/**
 * Follow / unfollow, optimistic.
 *
 * The state flips before the round-trip because the action is idempotent — it
 * upserts and deleteMany's rather than create/delete — so a double click or a
 * click during a pending request cannot produce a constraint error to roll
 * back from. On failure the optimistic value is discarded and the server's
 * answer is what remains.
 *
 * Not rendered for signed-out visitors or on your own profile: the action
 * refuses both, and offering a button that will be refused is worse than not
 * offering one.
 */
export function FollowButton({
  username,
  initialFollowing,
  initialFollowers,
}: {
  username: string;
  initialFollowing: boolean;
  initialFollowers: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState({
    following: initialFollowing,
    followers: initialFollowers,
  });
  const [optimistic, setOptimistic] = useOptimistic(state);

  const onClick = () => {
    const next = !optimistic.following;
    startTransition(async () => {
      setOptimistic({
        following: next,
        // Move the count with it, so the number under the button does not
        // disagree with the button for the length of a round-trip.
        followers: Math.max(0, optimistic.followers + (next ? 1 : -1)),
      });

      const result = await toggleFollow({ username, follow: next });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setState({ following: result.following, followers: result.followers });
      // The profile's own counts are server-rendered; refresh so the follower
      // and following figures beside the button agree with it.
      router.refresh();
    });
  };

  const following = optimistic.following;

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={pending}
      variant={following ? "outline" : "default"}
      // The label says what it is, not what clicking does — a button reading
      // "Unfollow" is a button that looks like it already unfollowed you.
      aria-pressed={following}
    >
      {following ? (
        <>
          <CheckIcon data-icon="inline-start" aria-hidden />
          Following
        </>
      ) : (
        <>
          <PlusIcon data-icon="inline-start" aria-hidden />
          Follow
        </>
      )}
    </Button>
  );
}
