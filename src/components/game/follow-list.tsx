import { UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { shell } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type FollowRow, listFollows } from "@/server/dal/follows";
import { getPublicProfile } from "@/server/dal/profile";

/**
 * Shared body for /u/[username]/followers and /following.
 *
 * The two pages differ by one word and one query direction, so they share a
 * component rather than a copy. Both are public for the same reason the profile
 * is: the counts are already on it, and a list of handles discloses nothing the
 * profiles themselves do not.
 *
 * A private profile still has these pages. Opting out hides your stats, not
 * your existence — the handle is public and so is who follows it.
 */
export function FollowList({
  params,
  direction,
}: {
  params: Promise<{ username: string }>;
  direction: "followers" | "following";
}) {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className={cn(shell, "flex-1 py-14")}>
        <Suspense fallback={<ListSkeleton />}>
          <Body params={params} direction={direction} />
        </Suspense>
      </main>
    </>
  );
}

async function Body({
  params,
  direction,
}: {
  params: Promise<{ username: string }>;
  direction: "followers" | "following";
}) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const { items } = await listFollows(profile.userId, direction);

  return (
    <div className="space-y-8">
      <div>
        <DataLabel>
          <Link
            href={`/u/${profile.username}` as Route}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {profile.displayName}
          </Link>
        </DataLabel>
        <h1 className="mt-2 font-display text-display-lg">
          {direction === "followers" ? "Followers" : "Following"}
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-16 text-center">
          <UsersThreeIcon
            aria-hidden
            weight="duotone"
            className="size-7 text-muted-foreground"
          />
          <p className="text-muted-foreground text-sm">
            {direction === "followers"
              ? "Nobody yet."
              : "Not following anyone yet."}
          </p>
        </div>
      ) : (
        <ul className="divide-y border-t">
          {items.map((row) => (
            <Row key={row.userId} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ row }: { row: FollowRow }) {
  const body = (
    <>
      {row.image ? (
        // biome-ignore lint/performance/noImgElement: remote avatar from an arbitrary OAuth provider
        <img
          src={row.image}
          alt=""
          aria-hidden
          width={36}
          height={36}
          referrerPolicy="no-referrer"
          className="size-9 shrink-0 rounded-full border object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center border bg-secondary font-mono text-secondary-foreground text-xs uppercase"
        >
          {initials(row.name)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{row.name}</span>
        {row.username ? (
          <span className="block truncate font-mono text-muted-foreground text-xs">
            @{row.username}
          </span>
        ) : null}
      </span>
    </>
  );

  // Accounts predating the username plugin have no handle and so no profile to
  // reach — they still appear, they just are not links to nowhere.
  return (
    <li>
      {row.username ? (
        <Link
          href={`/u/${row.username}` as Route}
          className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/50"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 py-3">{body}</div>
      )}
    </li>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="space-y-3">
        {["a", "b", "c", "d"].map((key) => (
          <Skeleton key={key} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
