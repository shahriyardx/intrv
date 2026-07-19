import "server-only";
import { prisma } from "@/lib/db";
import type { Viewer } from "@/server/dal/owner";

/**
 * Follows: who follows whom, and the counts a profile shows.
 *
 * A follow grants nothing. Profiles are already readable by anyone holding the
 * link, so this is a bookmark with a public count rather than a permission —
 * which is why there is no request/approve state and no block. If private
 * accounts ever land, that is when this stops being a one-bit fact.
 *
 * Counts are read live rather than denormalised onto User. A cached counter
 * needs a transaction on every follow and drifts the first time one is missed;
 * these are two indexed counts on a table with a unique key, and the profile
 * already runs heavier queries than this.
 */

export type FollowCounts = {
  followers: number;
  following: number;
};

export type FollowState = FollowCounts & {
  /** Whether the viewer follows this profile. False when signed out. */
  isFollowing: boolean;
  /** Whether this profile is the viewer's own. */
  isSelf: boolean;
  /** Whether they follow the viewer back — "Follows you" on the profile. */
  followsViewer: boolean;
};

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [followers, following] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
  ]);
  return { followers, following };
}

/**
 * Everything the profile header needs in one pass.
 *
 * The two relationship checks are `findUnique` on the composite key, so each is
 * an index hit rather than a scan.
 */
export async function getFollowState(
  viewer: Viewer,
  profileUserId: string,
): Promise<FollowState> {
  const viewerId = viewer.kind === "user" ? viewer.userId : null;
  const isSelf = viewerId === profileUserId;

  const [counts, mine, theirs] = await Promise.all([
    getFollowCounts(profileUserId),
    viewerId && !isSelf
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: profileUserId,
            },
          },
          select: { id: true },
        })
      : null,
    viewerId && !isSelf
      ? prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: profileUserId,
              followingId: viewerId,
            },
          },
          select: { id: true },
        })
      : null,
  ]);

  return {
    ...counts,
    isSelf,
    isFollowing: Boolean(mine),
    followsViewer: Boolean(theirs),
  };
}

export type FollowRow = {
  userId: string;
  name: string;
  /** Null for accounts predating the username plugin — those are unlinkable. */
  username: string | null;
  image: string | null;
  followedAt: Date;
};

const PAGE_SIZE = 50;

/**
 * A page of followers, or of who someone follows.
 *
 * Banned accounts are dropped from both lists for the same reason they are
 * dropped from the leaderboard: a banned account should not keep a presence on
 * a page anyone can read. Opted-out accounts stay — their profile still exists
 * and still says who it belongs to; only their stats are private.
 */
export async function listFollows(
  userId: string,
  direction: "followers" | "following",
  opts: { limit?: number; cursor?: string } = {},
): Promise<{ items: FollowRow[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? PAGE_SIZE, PAGE_SIZE);

  const rows = await prisma.follow.findMany({
    where:
      direction === "followers"
        ? { followingId: userId, follower: { banned: { not: true } } }
        : { followerId: userId, following: { banned: { not: true } } },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      follower:
        direction === "followers"
          ? {
              select: {
                id: true,
                name: true,
                username: true,
                displayUsername: true,
                image: true,
              },
            }
          : undefined,
      following:
        direction === "following"
          ? {
              select: {
                id: true,
                name: true,
                username: true,
                displayUsername: true,
                image: true,
              },
            }
          : undefined,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const items = page.flatMap((row) => {
    const user = direction === "followers" ? row.follower : row.following;
    if (!user) return [];
    return [
      {
        userId: user.id,
        name: user.name,
        username: user.displayUsername ?? user.username,
        image: user.image,
        followedAt: row.createdAt,
      },
    ];
  });

  return {
    items,
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}
