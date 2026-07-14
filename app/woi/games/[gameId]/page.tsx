import { Suspense } from "react";

import { WoiGameWorkspaceScreen } from "@/components/woi/game-workspace-screen";

type WoiGameWorkspacePageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function WoiGameWorkspacePage({ params }: WoiGameWorkspacePageProps) {
  const { gameId } = await params;
  return (
    <Suspense fallback={null}>
      <WoiGameWorkspaceScreen gameId={gameId} />
    </Suspense>
  );
}
