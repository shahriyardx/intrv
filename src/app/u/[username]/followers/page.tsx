import type { Metadata } from "next";
import { FollowList } from "@/components/game/follow-list";

export const metadata: Metadata = { title: "Followers" };

type Props = { params: Promise<{ username: string }> };

export default function FollowersPage({ params }: Props) {
  return <FollowList params={params} direction="followers" />;
}
