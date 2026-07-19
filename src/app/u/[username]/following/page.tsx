import type { Metadata } from "next";
import { FollowList } from "@/components/game/follow-list";

export const metadata: Metadata = { title: "Following" };

type Props = { params: Promise<{ username: string }> };

export default function FollowingPage({ params }: Props) {
  return <FollowList params={params} direction="following" />;
}
