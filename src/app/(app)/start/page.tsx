import type { Metadata } from "next";
import { OrgAccountGate } from "@/components/org/org-account-gate";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { DataLabel } from "@/components/ui/prose";
import { Configurator } from "./configurator";

export const metadata: Metadata = {
  title: "Start an interview",
  description:
    "Pick a topic or paste a job description. We generate the interview and grade it.",
};

export default function StartPage() {
  return (
    <>
      <OrgAccountGate />
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <DataLabel>New session</DataLabel>
        <h1 className="mt-3 font-display text-display-lg">
          What should we test you on?
        </h1>
        <div className="mt-10">
          <Configurator />
        </div>
      </main>
    </>
  );
}
