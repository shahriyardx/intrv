import { TrayIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatCount } from "@/components/admin/format";
import { MessageDetail, MessageList } from "@/components/admin/message-list";
import { Pagination } from "@/components/admin/pagination";
import { SectionHeading } from "@/components/admin/section-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { getAdminViewer } from "@/server/dal/admin";
import {
  getContactMessage,
  listContactMessages,
  MESSAGES_PAGE_SIZE,
} from "@/server/dal/contact";

/** Neutral for non-admins — see the note in (admin)/admin/page.tsx. */
export async function generateMetadata(): Promise<Metadata> {
  const admin = await getAdminViewer();
  if (!admin) return {};
  return { title: "Messages · Admin", robots: { index: false, follow: false } };
}

export default async function AdminMessagesPage(props: {
  searchParams: Promise<{ page?: string; message?: string }>;
}) {
  // The layout checks too, and that is not redundant: a layout doesn't re-run on
  // every client navigation and never runs for the actions this page calls.
  const admin = await getAdminViewer();
  if (!admin) notFound();

  const { page: rawPage, message: selectedId } = await props.searchParams;

  // `?page=-5` parses to a truthy -5, which would render a nonsense row range.
  const requested = Number.parseInt(rawPage ?? "1", 10);

  // Use the page the DAL served, not the one asked for — it clamps.
  const [{ rows, total, unhandled, page }, detail] = await Promise.all([
    listContactMessages({
      page: Number.isFinite(requested) && requested > 0 ? requested : 1,
    }),
    selectedId ? getContactMessage(selectedId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeading
        label={
          total === 0
            ? "nothing yet"
            : `${formatCount(unhandled)} unhandled · ${formatCount(total)} total`
        }
        title="Messages"
      />

      {detail ? <MessageDetail message={detail} page={page} /> : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={<TrayIcon weight="duotone" />}
          title="No messages"
          description="Everything sent through /contact lands here. There is no mail provider — this list is the inbox."
        />
      ) : (
        <>
          <MessageList rows={rows} selectedId={selectedId} page={page} />
          <Pagination
            basePath="/admin/messages"
            page={page}
            total={total}
            pageSize={MESSAGES_PAGE_SIZE}
            unit="messages"
          />
        </>
      )}
    </div>
  );
}
