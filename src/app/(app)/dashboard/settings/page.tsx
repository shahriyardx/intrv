import { format } from "date-fns";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataLabel, Prose } from "@/components/ui/prose";
import { Separator } from "@/components/ui/separator";
import { getAccountProfile, getOverviewStats } from "@/server/dal/analytics";
import { getViewer } from "@/server/dal/session";
import { DeleteAccount } from "./delete-account";
import { LeaderboardToggle } from "./leaderboard-toggle";
import { NameForm } from "./name-form";
import { UsernameForm } from "./username-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await getViewer();

  const [profile, stats] = await Promise.all([
    getAccountProfile(viewer),
    getOverviewStats(viewer),
  ]);

  // The layout redirects anonymous viewers, so this is a signed-in user whose
  // row has gone: nothing to render and nothing to fix here.
  if (!profile) notFound();

  return (
    <div className="max-w-xl space-y-12">
      <section className="space-y-4">
        <DataLabel>Profile</DataLabel>
        <NameForm name={profile.name} />
        <UsernameForm
          username={profile.username}
          changed={profile.usernameChanged}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <DataLabel>Email</DataLabel>
        <p className="font-mono text-sm">{profile.email}</p>
        <Prose className="text-xs text-muted-foreground">
          <p>
            Your email can't be changed here. Moving an account to a new address
            needs a verification mail to prove you own it, and we don't send
            mail yet — a field that silently didn't verify would be worse than
            no field.
          </p>
        </Prose>
      </section>

      <Separator />

      <section className="space-y-4">
        <DataLabel>Privacy</DataLabel>
        <LeaderboardToggle optedOut={profile.leaderboardOptOut} />
      </section>

      <Separator />

      <section className="space-y-3">
        <DataLabel>Account</DataLabel>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Joined</dt>
          <dd className="font-mono tabular">
            {format(profile.createdAt, "d MMM yyyy")}
          </dd>
          <dt className="text-muted-foreground">Interviews</dt>
          <dd className="font-mono tabular">{stats.totalSessions}</dd>
        </dl>
      </section>

      <Separator />

      <section className="space-y-4 rounded-md border border-destructive/40 p-5">
        <div className="space-y-1">
          <DataLabel className="text-destructive">Danger zone</DataLabel>
          <Prose className="text-sm text-muted-foreground">
            <p>
              Deleting your account removes your history along with it. Shared
              result links you created will stop working.
            </p>
          </Prose>
        </div>
        <DeleteAccount sessionCount={stats.totalSessions} />
      </section>
    </div>
  );
}
