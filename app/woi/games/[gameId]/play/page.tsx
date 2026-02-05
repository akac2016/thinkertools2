import { WoiPlayScreen } from "@/components/woi/play-screen";

type WoiPlayPageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function WoiPlayPage({ params }: WoiPlayPageProps) {
  const { gameId } = await params;
  return <WoiPlayScreen gameId={gameId} />;
}
