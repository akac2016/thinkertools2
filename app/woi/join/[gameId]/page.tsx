import { WoiJoinLinkScreen } from "@/components/woi/join-link-screen";

type WoiJoinByLinkPageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function WoiJoinByLinkPage({ params }: WoiJoinByLinkPageProps) {
  const { gameId } = await params;
  return <WoiJoinLinkScreen gameId={gameId} />;
}
