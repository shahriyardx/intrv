"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getViewer } from "@/server/dal/session";

/**
 * Leave or rejoin the public leaderboard.
 *
 * Takes no user id: Server Functions are POST endpoints reachable directly, so
 * the only account this can touch is the one the caller is signed in as.
 */
export async function setLeaderboardVisibility(
  visible: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") {
    return { ok: false, error: "You're signed out." };
  }

  await prisma.user.update({
    where: { id: viewer.userId },
    data: { leaderboardOptOut: !visible },
  });

  // The board is a public page and the settings toggle has to agree with it.
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard/settings");

  return { ok: true };
}
