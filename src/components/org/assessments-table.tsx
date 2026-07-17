import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AssessmentRow } from "@/server/dal/org";

export function AssessmentsTable({
  assessments,
}: {
  assessments: AssessmentRow[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Topic</TableHead>
          <TableHead>Difficulty</TableHead>
          <TableHead className="text-right">Candidates</TableHead>
          <TableHead className="text-right">Avg score</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assessments.map((assessment) => (
          <TableRow key={assessment.id}>
            <TableCell className="max-w-56 truncate">
              <Link
                href={`/org/assessments/${assessment.id}` as Route}
                className="underline-offset-4 hover:underline"
              >
                {assessment.title}
              </Link>
            </TableCell>
            <TableCell className="max-w-40 truncate text-muted-foreground">
              {assessment.topic}
            </TableCell>
            <TableCell className="text-muted-foreground capitalize">
              {assessment.difficulty.toLowerCase()}
            </TableCell>
            <TableCell className="text-right font-mono tabular">
              {assessment.candidateCount}
            </TableCell>
            <TableCell className="text-right font-mono tabular">
              {assessment.avgScore === null
                ? "—"
                : `${Math.round(assessment.avgScore)}%`}
            </TableCell>
            <TableCell>
              <Badge
                variant={assessment.active ? "secondary" : "outline"}
                className="text-[0.625rem]"
              >
                {assessment.active ? "active" : "closed"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
