import type { ContentDraft } from "@/lib/authoring/draft-types";

type Props = {
  aiSource: ContentDraft["aiSource"];
};

/**
 * Small inline badge showing whether a draft came from a live AI model or a
 * deterministic fallback. Renders nothing when aiSource is null (manual draft).
 */
export function DraftSourceBadge({ aiSource }: Props) {
  if (!aiSource) {
    return null;
  }

  if (aiSource === "openai") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
        <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden="true" />
        Live AI
      </span>
    );
  }

  // mock / fallback
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
      Fallback
    </span>
  );
}
