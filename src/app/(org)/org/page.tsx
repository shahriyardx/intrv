import { ArrowRightIcon, BuildingsIcon } from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import { CreateOrgForm } from "@/components/org/create-org-form";
import { Badge } from "@/components/ui/badge";
import { DataLabel } from "@/components/ui/prose";
import { getViewerOrgs } from "@/server/dal/org";
import { getViewer } from "@/server/dal/session";

export default async function OrgIndexPage() {
  const viewer = await getViewer();
  const orgs = await getViewerOrgs(viewer);

  return (
    <div className="grid gap-14 lg:grid-cols-[1fr_22rem] lg:gap-20">
      <section className="space-y-5">
        <DataLabel as="h2">Your organizations</DataLabel>

        {orgs.length === 0 ? (
          <div className="rounded-md border border-dashed px-6 py-12 text-center">
            <span
              aria-hidden
              className="mx-auto mb-5 flex size-10 items-center justify-center rounded-sm bg-muted text-muted-foreground [&_svg]:size-5"
            >
              <BuildingsIcon weight="duotone" />
            </span>
            <p className="font-display text-display-md">No organizations yet</p>
            <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              An organization lets you screen candidates: generate a frozen
              interview once, send everyone the same capability link, and read
              their reports with anti-cheat signals. Create one to start.
            </p>
          </div>
        ) : (
          <ul className="divide-y border-t">
            {orgs.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/org/${org.slug}` as Route}
                  className="group flex items-center gap-4 py-4 transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm">
                      {org.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                      {org.screenCount}{" "}
                      {org.screenCount === 1 ? "screen" : "screens"}
                    </span>
                  </span>
                  <Badge variant="outline" className="text-[0.625rem]">
                    {org.role}
                  </Badge>
                  <ArrowRightIcon
                    className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-5 lg:border-l lg:pl-10">
        <DataLabel as="h2">New organization</DataLabel>
        <CreateOrgForm />
      </section>
    </div>
  );
}
