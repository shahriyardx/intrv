"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getViewer } from "@/server/dal/session";

/**
 * Follow and unfollow.
 *
 * A Server Function is a POST endpoint reachable directly, so this establishes
 * its own viewer and resolves the target by handle rather than trusting an id
 * from the client: a caller who can name any user id could otherwise write rows
 * pointing at accounts they could never have found.
 */

export type FollowState =
  | { ok: true; following: boolean; followers: number }
  | { ok: false; error: string };

export async function toggleFollow(input: {
  /** The handle from the profile URL, not a user id. */
  username: string;
  /** What the client believes it is doing — makes a double-click idempotent. */
  follow: boolean;
}): Promise<FollowState> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") {
    return { ok: false, error: "Sign in to follow people." };
  }

  const handle = input.username.trim().toLowerCase();
  if (!handle) return { ok: false, error: "No such profile." };

  const target = await prisma.user.findUnique({
    where: { username: handle },
    select: { id: true, banned: true },
  });

  // Missing and banned collapse to the same answer, as everywhere else: a
  // refusal must not confirm that an account exists.
  if (!target || target.banned) return { ok: false, error: "No such profile." };
  if (target.id === viewer.userId) {
    return { ok: false, error: "You can't follow yourself." };
  }

  const key = {
    followerId_followingId: {
      followerId: viewer.userId,
      followingId: target.id,
    },
  };

  if (input.follow) {
    // Upsert rather than create: following twice is the same fact as following
    // once, and two fast clicks must not become a unique-constraint error.
    await prisma.follow.upsert({
      where: key,
      create: { followerId: viewer.userId, followingId: target.id },
      update: {},
    });
  } else {
    // deleteMany, not delete: removing a row that is already gone is success,
    // not a P2025 to translate into an apology.
    await prisma.follow.deleteMany({
      where: { followerId: viewer.userId, followingId: target.id },
    });
  }

  const followers = await prisma.follow.count({
    where: { followingId: target.id },
  });

  revalidatePath(`/u/${handle}`);
  revalidatePath("/dashboard");

  return { ok: true, following: input.follow, followers };
}
