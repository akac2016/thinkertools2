import { QuipxDiscussPage } from "@/components/quipx/discuss-page";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { sessionId } = await params;
  return <QuipxDiscussPage sessionId={sessionId} />;
}
