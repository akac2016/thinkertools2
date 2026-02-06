import { WoiGameWorkspaceScreen } from "@/components/woi/game-workspace-screen";

type WoiGameWorkspacePageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function WoiGameWorkspacePage({ params }: WoiGameWorkspacePageProps) {
  const { gameId } = await params;
  return <WoiGameWorkspaceScreen gameId={gameId} />;
}
