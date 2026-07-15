"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";
import {
  ActivityGroupBrowser,
  type AuthoringActivityGroup,
  type UncategorizedActivityContent,
} from "@/components/thinkertools-missions-create/activity-group-browser";
import { ActivityGroupsJumpLink } from "@/components/thinkertools-missions-create/activity-groups-jump-link";
import { ActivityEditor } from "@/components/thinkertools-missions-create/activity-editor";
import { MissionEditor } from "@/components/thinkertools-missions-create/mission-editor";
import type { ContentDraft } from "@/lib/authoring/draft-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  params: Promise<{ draftId: string }>;
};

type GetDraftResponse = {
  draft: ContentDraft;
};

type ListGroupsResponse = {
  groups: AuthoringActivityGroup[];
  uncategorized: UncategorizedActivityContent;
};

function DraftEditorPageContent({ params }: Props) {
  const { draftId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromMessage = searchParams.get("from") ?? undefined;

  const [draft, setDraft] = useState<ContentDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [groups, setGroups] = useState<AuthoringActivityGroup[]>([]);
  const [uncategorized, setUncategorized] = useState<UncategorizedActivityContent>({
    questions: [],
    drafts: [],
  });
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const activityTrainingId = draft?.contentType === "activity"
    ? draft.primaryTrainingId
    : null;

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!data.session) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      try {
        const result = await apiFetch<GetDraftResponse>(
          `/api/thinkertools-missions-create/drafts/${draftId}`,
        );
        if (!mounted) return;
        setDraft(result.draft);
      } catch (err) {
        if (!mounted) return;
        setFetchError(
          isApiRequestError(err) ? err.message : "Failed to load draft.",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [draftId]);

  useEffect(() => {
    if (!activityTrainingId) {
      setGroups([]);
      setUncategorized({ questions: [], drafts: [] });
      setGroupsError(null);
      setLoadingGroups(false);
      return;
    }

    let mounted = true;
    setLoadingGroups(true);
    setGroupsError(null);

    const loadGroups = async () => {
      try {
        const result = await apiFetch<ListGroupsResponse>(
          `/api/thinkertools-missions-create/activity-groups?trainingId=${activityTrainingId}`,
        );
        if (mounted) {
          setGroups(result.groups);
          setUncategorized(result.uncategorized);
        }
      } catch (err) {
        if (!mounted) return;
        setGroups([]);
        setUncategorized({ questions: [], drafts: [] });
        setGroupsError(
          isApiRequestError(err) ? err.message : "Failed to load activity groups.",
        );
      } finally {
        if (mounted) setLoadingGroups(false);
      }
    };

    void loadGroups();
    return () => {
      mounted = false;
    };
  }, [activityTrainingId, draft?.activityGroupId]);

  async function handleAddQuestionHere(group: AuthoringActivityGroup) {
    if (!activityTrainingId) {
      throw new Error("This draft does not have an activity subject.");
    }
    router.push(
      `/thinkertools-missions-create/drafts/new?trainingId=${encodeURIComponent(activityTrainingId)}&activityGroupId=${encodeURIComponent(group.id)}`,
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/thinkertools-missions-create"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← All drafts
        </Link>
      </div>

      {/* Auth error */}
      {authError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          You need to be signed in to edit drafts. Use the Account menu in the
          top-right corner to sign in.
        </div>
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading draft…</p>
      ) : fetchError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {fetchError}
        </div>
      ) : !draft ? (
        <p className="text-sm text-slate-500">Draft not found.</p>
      ) : (
        <>
          <header className="mb-6">
            <h1 className="text-xl font-semibold text-slate-900">
              {draft.title || draft.trainingTitle || (
                <span className="italic text-slate-400">Untitled</span>
              )}
            </h1>
            <p className="mt-1 text-xs text-slate-400 capitalize">
              {draft.contentType} · created{" "}
              {new Date(draft.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </header>

          {draft.contentType === "activity" ? (
            <>
              <ActivityEditor
                draft={draft}
                onDraftChange={setDraft}
                fromMessage={fromMessage}
                activityGroups={groups}
                loadingActivityGroups={loadingGroups}
                activityGroupsError={groupsError}
                onActivityGroupCreated={(createdGroup) => {
                  setGroups((currentGroups) =>
                    currentGroups.some((group) => group.id === createdGroup.id)
                      ? currentGroups
                      : [...currentGroups, createdGroup],
                  );
                }}
              />
              <div className="mt-10">
                <ActivityGroupBrowser
                  groups={groups}
                  loading={loadingGroups}
                  error={groupsError}
                  uncategorized={uncategorized}
                  onAddQuestion={handleAddQuestionHere}
                />
              </div>
              <ActivityGroupsJumpLink />
            </>
          ) : (
            <MissionEditor draft={draft} onDraftChange={setDraft} fromMessage={fromMessage} />
          )}
        </>
      )}
    </main>
  );
}

export default function DraftEditorPage(props: Props) {
  return (
    <Suspense fallback={null}>
      <DraftEditorPageContent {...props} />
    </Suspense>
  );
}
