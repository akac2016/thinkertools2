import { redirect } from "next/navigation";

type WoiPlayPageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function WoiPlayPage({ params }: WoiPlayPageProps) {
  const { gameId } = await params;
  redirect(`/woi/games/${gameId}`);
}
