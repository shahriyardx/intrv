"use client";

import {
  BuildingsIcon,
  ShieldCheckIcon,
  SignOutIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

/**
 * The identity arrives as a prop from whichever RSC renders the header: this is
 * on every page, and a client-side session fetch here would mean a request and
 * a signed-out flash on all of them.
 *
 * Deliberately narrowed to the fields rendered rather than taking the
 * better-auth Session. Props to a client component are serialized into the
 * flight payload embedded in the HTML, so accepting the session here would
 * publish the session token, IP and full user row — all of which better-auth
 * keeps in HttpOnly cookies precisely so scripts cannot read them — as
 * JS-readable markup on every page.
 *
 * The trigger is the avatar alone: the name and every account destination live
 * inside the menu, so nothing is stated twice across the header.
 */
export function UserMenu({
  user,
  isAdmin = false,
  isOrgAccount = false,
}: {
  user: { name: string; email: string; image?: string | null } | null;
  isAdmin?: boolean;
  /** Org accounts see only the org surface; personal accounts never see it. */
  isOrgAccount?: boolean;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return (
      <>
        <Button asChild variant="ghost" size="sm">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/sign-up">Sign up</Link>
        </Button>
      </>
    );
  }

  const { name, email, image } = user;

  async function onSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/");
    // The header, and every RSC holding a session, has to re-read it.
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // The avatar is initials, not text: without this the control has no
          // accessible name at all.
          aria-label={`Account — ${name || email}`}
          className="ml-1"
        >
          {image ? (
            // A plain img, not next/image: this is an arbitrary provider URL
            // (Google today, whoever tomorrow), and putting it through the
            // optimizer would mean allow-listing every provider's CDN in
            // next.config and proxying a 32px avatar through our own server for
            // nothing. referrerPolicy is required — Google serves a 403 to a
            // hotlink that sends a referrer.
            // biome-ignore lint/performance/noImgElement: remote avatar from an arbitrary OAuth provider
            <img
              src={image}
              alt=""
              aria-hidden
              width={28}
              height={28}
              referrerPolicy="no-referrer"
              className="size-7 rounded-full border object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-7 items-center justify-center border bg-secondary font-mono text-[0.5625rem] text-secondary-foreground uppercase"
            >
              {initials(name, email)}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          {name ? <p className="truncate font-medium text-xs">{name}</p> : null}
          <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">
            {email}
          </p>
        </div>

        <DropdownMenuSeparator />

        {/* One surface per account type: an org account only ever sees the org
            dashboard, a personal account only the personal one. */}
        {isOrgAccount ? (
          <DropdownMenuItem asChild>
            <Link href={"/org" as Route}>
              <BuildingsIcon className="size-4" />
              Organization
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/dashboard">
              <SquaresFourIcon className="size-4" />
              Dashboard
            </Link>
          </DropdownMenuItem>
        )}

        {/* Gated on the role rather than on /admin 404ing: a link rendered to
            everyone would announce the surface exists. */}
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheckIcon className="size-4" />
              Admin
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={signingOut}
          // Radix closes the menu on select and unmounts the item mid-request,
          // so the sign-out has to outlive it.
          onSelect={(event) => {
            event.preventDefault();
            void onSignOut();
          }}
        >
          <SignOutIcon className="size-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name: string | null | undefined, email: string) {
  const source = name?.trim() || email;

  return (
    source
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "?"
  );
}
