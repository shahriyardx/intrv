import { ChartLineUpIcon } from "@phosphor-icons/react/dist/ssr";
import { format } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { ChartPanel } from "@/components/analytics/chart-panel";
import {
  formatPercent,
  formatScore,
  questionTypeLabel,
  truncate,
} from "@/components/analytics/format";
import {
  type BarDatum,
  ScoreBarChart,
} from "@/components/analytics/score-bar-chart";
import {
  ScoreTrendChart,
  type TrendDatum,
} from "@/components/analytics/score-trend-chart";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getConceptAccuracy,
  getScoreTrend,
  getTopicPerformance,
  getTypeAccuracy,
} from "@/server/dal/analytics";
import { getViewer } from "@/server/dal/session";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const viewer = await getViewer();

  const [trend, topics, concepts, types] = await Promise.all([
    getScoreTrend(viewer, { limit: 30 }),
    getTopicPerformance(viewer, { limit: 10 }),
    getConceptAccuracy(viewer, { limit: 12 }),
    getTypeAccuracy(viewer),
  ]);

  if (trend.length === 0) {
    return (
      <EmptyState
        icon={<ChartLineUpIcon />}
        title="No graded interviews yet"
        description="Analytics needs something to measure. Take an interview and your score trend, your strongest topics and the concepts you keep missing all show up here."
        action={
          <Button asChild>
            <Link href="/start">Start an interview</Link>
          </Button>
        }
      />
    );
  }

  const trendData: TrendDatum[] = trend.map((point) => ({
    sessionId: point.sessionId,
    topic: point.topic,
    difficulty: point.difficulty,
    score: point.score,
    label: format(point.gradedAt, "d MMM"),
    fullDate: format(point.gradedAt, "d MMM yyyy"),
  }));

  const topicData: BarDatum[] = topics.map((topic) => ({
    id: topic.topic,
    label: truncate(topic.topic, 20),
    value: topic.averageScore,
    title: topic.topic,
    rows: [
      { label: "Average", value: `${formatScore(topic.averageScore)}%` },
      { label: "Attempts", value: String(topic.attempts) },
    ],
  }));

  const conceptData: BarDatum[] = concepts.map((concept) => ({
    id: concept.concept,
    label: truncate(concept.concept, 22),
    value: concept.accuracy,
    title: concept.concept,
    rows: [
      { label: "Accuracy", value: formatPercent(concept.accuracy) },
      { label: "Right", value: `${concept.correct} of ${concept.total}` },
      { label: "Avg score", value: `${formatScore(concept.averageScore)}%` },
    ],
  }));

  const typeData: BarDatum[] = types.map((type) => ({
    id: type.type,
    label: questionTypeLabel(type.type),
    value: type.accuracy,
    title: questionTypeLabel(type.type),
    rows: [
      { label: "Accuracy", value: formatPercent(type.accuracy) },
      { label: "Right", value: `${type.correct} of ${type.total}` },
      { label: "Avg score", value: `${formatScore(type.averageScore)}%` },
    ],
  }));

  return (
    <div className="space-y-16">
      <ChartPanel
        title="Score over time"
        description={
          trendData.length === 1
            ? "One graded interview so far. A second one gives this a direction."
            : `Your last ${trendData.length} graded interviews, oldest first. Each point is one session.`
        }
      >
        {trendData.length === 1 ? (
          <p className="font-display text-display-lg tabular">
            {formatScore(trendData[0].score)}%
          </p>
        ) : (
          <ScoreTrendChart data={trendData} />
        )}
      </ChartPanel>

      <ChartPanel
        title="By topic"
        description="Average score per topic, most-practised first. Topics group exactly as you typed them."
        table={
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead className="text-right">Average</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics.map((topic) => (
                <TableRow key={topic.topic}>
                  <TableCell className="max-w-[28ch] truncate">
                    {topic.topic}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {topic.attempts}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatScore(topic.averageScore)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      >
        <ScoreBarChart data={topicData} />
      </ChartPanel>

      <ChartPanel
        title="By concept"
        description="How often you get a question right, per concept tag. Ordered by how much you've seen each one."
        table={
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concept</TableHead>
                <TableHead className="text-right">Right</TableHead>
                <TableHead className="text-right">Seen</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {concepts.map((concept) => (
                <TableRow key={concept.concept}>
                  <TableCell className="max-w-[28ch] truncate">
                    {concept.concept}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {concept.correct}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {concept.total}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatPercent(concept.accuracy)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      >
        {conceptData.length > 0 ? (
          <ScoreBarChart data={conceptData} labelWidth={148} />
        ) : (
          <p className="text-sm text-muted-foreground">
            None of your graded questions carry concept tags yet.
          </p>
        )}
      </ChartPanel>

      <ChartPanel
        title="By question type"
        description="Accuracy per format. A gap here is usually about how you answer, not what you know."
        table={
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Right</TableHead>
                <TableHead className="text-right">Answered</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.type}>
                  <TableCell>{questionTypeLabel(type.type)}</TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {type.correct}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {type.total}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {formatPercent(type.accuracy)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      >
        <ScoreBarChart data={typeData} labelWidth={112} />
      </ChartPanel>
    </div>
  );
}
