import { QuipxPhasePage } from "@/components/quipx/phase-page";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;
  return <QuipxPhasePage phase="review" sessionId={sessionId} />;
}
