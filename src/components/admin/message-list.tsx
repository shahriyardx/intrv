"use client";

import { EnvelopeSimpleIcon, XIcon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useActionState } from "react";
import { formatDateTime } from "@/components/admin/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataLabel } from "@/components/ui/prose";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { setMessageHandled } from "@/server/actions/contact";
import type {
  ContactMessageDetail,
  ContactMessageRow,
} from "@/server/dal/contact";

/**
 * Every string on this surface came from an anonymous stranger over a public
 * endpoint. All of it is rendered as text — no dangerouslySetInnerHTML, no
 * markdown, nothing that could turn `<img src=x onerror=…>` into an element.
 * React escapes by default; the rule is simply that nothing here opts out.
 */

function messageHref(id: string, page: number): Route {
  return `/admin/messages?message=${id}${page > 1 ? `&page=${page}` : ""}` as Route;
}

export function MessageList({
  rows,
  selectedId,
  page,
}: {
  rows: ContactMessageRow[];
  selectedId?: string;
  page: number;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subject</TableHead>
          <TableHead>From</TableHead>
          <TableHead>Received</TableHead>
          <TableHead className="text-right">State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            data-state={row.id === selectedId ? "selected" : undefined}
          >
            <TableCell className="max-w-72">
              <Link
                href={messageHref(row.id, page)}
                className="block truncate underline-offset-4 hover:underline"
              >
                {/* Unread weight, not colour: the queue is scanned down this
                    column, and an unhandled row has to be findable at a glance. */}
                <span className={cn(!row.handled && "font-medium")}>
                  {row.subject}
                </span>
              </Link>
            </TableCell>
            <TableCell className="max-w-56">
              <span className="block truncate">{row.name}</span>
              <span className="block truncate font-mono text-[0.6875rem] text-muted-foreground">
                {row.email}
              </span>
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {formatDateTime(row.createdAt)}
            </TableCell>
            <TableCell className="text-right">
              {row.handled ? (
                <Badge variant="outline">handled</Badge>
              ) : (
                <Badge>unhandled</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function MessageDetail({
  message,
  page,
}: {
  message: ContactMessageDetail;
  page: number;
}) {
  // mailto is how a reply actually happens here: there is no outbound mail, so
  // the operator's own client sends it. encodeURIComponent because a subject is
  // attacker-controlled text going into a URL.
  const mailto = `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`;

  return (
    <article className="animate-rise border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <DataLabel>{formatDateTime(message.createdAt)}</DataLabel>
          <h3 className="mt-1 font-display text-display-md break-words">
            {message.subject}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground break-words">
            {message.name}{" "}
            <span className="font-mono text-xs">&lt;{message.email}&gt;</span>
          </p>
        </div>
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          aria-label="Close message"
        >
          <Link
            href={
              page > 1
                ? (`/admin/messages?page=${page}` as Route)
                : "/admin/messages"
            }
          >
            <XIcon />
          </Link>
        </Button>
      </div>

      {/* whitespace-pre-wrap: the paragraphs someone typed are the only
          structure this text has, and it is never parsed for any other. */}
      <p className="mt-6 max-w-[68ch] text-sm leading-relaxed whitespace-pre-wrap break-words">
        {message.body}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6">
        <Button asChild variant="outline" size="sm">
          <a href={mailto}>
            <EnvelopeSimpleIcon />
            Reply by email
          </a>
        </Button>
        <HandledToggle id={message.id} handled={message.handled} />
      </div>
    </article>
  );
}

/**
 * The button is a convenience, not the authorization: the action re-reads the
 * session with the cookie cache disabled before it writes.
 */
function HandledToggle({ id, handled }: { id: string; handled: boolean }) {
  const [state, action, pending] = useActionState(setMessageHandled, null);

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="handled" value={handled ? "false" : "true"} />
      <Button
        type="submit"
        size="sm"
        variant={handled ? "outline" : "default"}
        disabled={pending}
      >
        {handled ? "Mark unhandled" : "Mark handled"}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
