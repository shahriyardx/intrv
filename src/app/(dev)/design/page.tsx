import {
  CheckCircleIcon,
  MinusCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeArt } from "@/components/game/badge-art";
import { BadgeGrid } from "@/components/game/badge-grid";
import { DailyGoal } from "@/components/game/daily-goal";
import { LevelBar } from "@/components/game/level-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shell } from "@/components/ui/page";
import { Progress } from "@/components/ui/progress";
import { DataLabel, Prose } from "@/components/ui/prose";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { evaluateBadges } from "@/server/learning/badges";
import { levelProgress } from "@/server/learning/levels";

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
    <main className={cn(shell, "py-16")}>
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

      <Separator className="my-12" />

      {/* The game surfaces, on sample data. These only ever render behind a
          session otherwise, so this is the one place they can be eyeballed in
          both themes without taking an interview first. */}
      <section className="space-y-10">
        <DataLabel>Progression</DataLabel>

        <DailyGoal met={false} currentStreak={0} longestStreak={4} />
        <DailyGoal met currentStreak={5} longestStreak={12} />

        <div className="grid gap-10 lg:grid-cols-2">
          <LevelBar level={levelProgress(136)} />
          <LevelBar level={levelProgress(4_480)} />
        </div>

        <BadgeGrid badges={SAMPLE_BADGES} />

        {/* Every medallion at both states, side by side — the only way to check
            twelve engravings read as twelve distinct things. */}
        <div className="grid grid-cols-6 gap-6 border-t pt-8 sm:grid-cols-12">
          {ALL_BADGES.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-2">
              <BadgeArt id={b.id} tier={b.tier} earned className="size-12" />
              <BadgeArt id={b.id} tier={b.tier} earned={false} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

// Mid-progress stats: some earned, some close, some untouched — the grid's
// three states in one screenshot.
const ALL_BADGES = evaluateBadges({
  gradedCount: 999,
  currentStreak: 99,
  longestStreak: 99,
  xp: 99_999,
  level: 30,
  perfectCount: 99,
  topicCount: 99,
  hardCount: 99,
  retiredReviews: 99,
  dailyCount: 99,
});

const SAMPLE_BADGES = evaluateBadges({
  gradedCount: 12,
  currentStreak: 5,
  longestStreak: 8,
  xp: 1_400,
  level: 5,
  perfectCount: 1,
  topicCount: 4,
  hardCount: 2,
  retiredReviews: 3,
  dailyCount: 6,
});
