import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatCount } from "./format";

/**
 * Offset pagination on purpose: an operator wants "page 3 of the user list",
 * and the cursor pagination used for a user's own history would make that a
 * fiction. These tables are small and admin-only.
 */
export function Pagination({
  basePath,
  page,
  total,
  pageSize,
  params = {},
  unit,
}: {
  basePath: string;
  page: number;
  total: number;
  pageSize: number;
  params?: Record<string, string | undefined>;
  unit: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  // typedRoutes can't check a href assembled at runtime; the cast is the escape
  // hatch the feature ships with.
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return `${basePath}${query ? `?${query}` : ""}` as Route;
  };

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
      <p className="font-mono text-[0.6875rem] tabular text-muted-foreground">
        {formatCount(first)}–{formatCount(last)} of {formatCount(total)} {unit}
      </p>
      <div className="flex gap-2">
        <Button
          asChild={page > 1}
          variant="outline"
          size="sm"
          disabled={page <= 1}
        >
          {page > 1 ? (
            <Link href={href(page - 1)}>Previous</Link>
          ) : (
            <span>Previous</span>
          )}
        </Button>
        <Button
          asChild={page < pages}
          variant="outline"
          size="sm"
          disabled={page >= pages}
        >
          {page < pages ? (
            <Link href={href(page + 1)}>Next</Link>
          ) : (
            <span>Next</span>
          )}
        </Button>
      </div>
    </div>
  );
}
