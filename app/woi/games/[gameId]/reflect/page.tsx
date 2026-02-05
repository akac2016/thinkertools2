import { WoiReflectScreen } from "@/components/woi/reflect-screen";

type WoiReflectPageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function WoiReflectPage({ params }: WoiReflectPageProps) {
  const { gameId } = await params;
  return <WoiReflectScreen gameId={gameId} />;
}
