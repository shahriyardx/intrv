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
import type { ScreenRow } from "@/server/dal/org";

export function ScreensTable({ screens }: { screens: ScreenRow[] }) {
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
        {screens.map((screen) => (
          <TableRow key={screen.id}>
            <TableCell className="max-w-56 truncate">
              <Link
                href={`/org/screens/${screen.id}` as Route}
                className="underline-offset-4 hover:underline"
              >
                {screen.title}
              </Link>
            </TableCell>
            <TableCell className="max-w-40 truncate text-muted-foreground">
              {screen.topic}
            </TableCell>
            <TableCell className="text-muted-foreground capitalize">
              {screen.difficulty.toLowerCase()}
            </TableCell>
            <TableCell className="text-right font-mono tabular">
              {screen.candidateCount}
            </TableCell>
            <TableCell className="text-right font-mono tabular">
              {screen.avgScore === null
                ? "—"
                : `${Math.round(screen.avgScore)}%`}
            </TableCell>
            <TableCell>
              <Badge
                variant={screen.active ? "secondary" : "outline"}
                className="text-[0.625rem]"
              >
                {screen.active ? "active" : "closed"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
