import { redirect } from "next/navigation";

type WoiReflectPageProps = {
  params: Promise<{ gameId: string }>;
};

export default async function WoiReflectPage({ params }: WoiReflectPageProps) {
  const { gameId } = await params;
  redirect(`/woi/games/${gameId}?tab=reflect`);
}
