import {
  CheckCircleIcon,
  MinusCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DataLabel, Prose } from "@/components/ui/prose";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = { title: "Design system" };

const CHARTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const GRADES = [
  {
    label: "Correct",
    Icon: CheckCircleIcon,
    cls: "text-correct",
    bg: "bg-correct-muted",
  },
  {
    label: "Partial",
    Icon: MinusCircleIcon,
    cls: "text-partial",
    bg: "bg-partial-muted",
  },
  {
    label: "Incorrect",
    Icon: XCircleIcon,
    cls: "text-incorrect",
    bg: "bg-incorrect-muted",
  },
] as const;

/** Internal reference for the design system. Not reachable in production. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-start justify-between gap-8">
        <div>
          <DataLabel>Design system</DataLabel>
          <h1 className="mt-3 font-display text-display-xl">
            Editorial <span className="italic">technical</span>
          </h1>
          <Prose className="mt-4 text-muted-foreground">
            <p>
              Warm paper, near-black ink, one acid accent used scarcely. A serif
              for display, a sans for reading, mono for anything that is data.
            </p>
          </Prose>
        </div>
      </header>

      <Separator className="my-12" />

      <section className="space-y-6">
        <DataLabel>Type scale</DataLabel>
        <div className="space-y-3">
          <p className="font-display text-display-2xl">Display 2XL</p>
          <p className="font-display text-display-lg">Display LG serif</p>
          <p className="text-lg">
            Body sans — the quick brown fox jumps over the lazy dog.
          </p>
          <p className="font-mono text-sm tabular">MONO 0123456789 · 98.50%</p>
        </div>
      </section>

      <Separator className="my-12" />

      <section className="space-y-6">
        <DataLabel>Buttons</DataLabel>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Start interview</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            Accent
          </Button>
        </div>
      </section>

      <Separator className="my-12" />

      <section className="space-y-6">
        <DataLabel>Grading states — colour is never the only signal</DataLabel>
        <div className="grid gap-3 sm:grid-cols-3">
          {GRADES.map(({ label, Icon, cls, bg }) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-md ${bg} p-4`}
            >
              <Icon className={`size-5 ${cls}`} weight="fill" />
              <span className="font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <Separator className="my-12" />

      <section className="space-y-6">
        <DataLabel>Chart palette — validated, do not hand-tune</DataLabel>
        <div className="flex flex-wrap gap-2">
          {CHARTS.map((n) => (
            <div key={n} className="space-y-1">
              <div
                className="size-16 rounded-md"
                style={{ background: `var(--chart-${n})` }}
              />
              <span className="font-mono text-[0.625rem] text-muted-foreground">
                chart-{n}
              </span>
            </div>
          ))}
        </div>
      </section>

      <Separator className="my-12" />

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-display-md">
              Question card
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Prose>
              <p>
                What is the time complexity of a balanced binary search tree
                lookup, and why does balance matter?
              </p>
            </Prose>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Short answer</Badge>
              <Badge variant="outline">Medium</Badge>
            </div>
            <Textarea placeholder="Type your answer…" rows={3} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-display-md">
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <DataLabel>Question 4 / 10</DataLabel>
                <span className="font-mono text-sm tabular">02:14</span>
              </div>
              <Progress value={40} />
            </div>
            <div>
              <DataLabel>Score</DataLabel>
              <p className="font-display text-display-xl tabular">86.5%</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" placeholder="e.g. React hooks" />
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
