"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiFetch, isApiRequestError } from "@/components/quipx/client";
import {
  ActivityGroupBrowser,
  type AuthoringActivityGroup,
  type UncategorizedActivityContent,
} from "@/components/thinkertools-missions-create/activity-group-browser";
import { ActivityGroupsJumpLink } from "@/components/thinkertools-missions-create/activity-groups-jump-link";
import { ActivityEditor } from "@/components/thinkertools-missions-create/activity-editor";
import type { ContentDraft } from "@/lib/authoring/draft-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Training = {
  id: string;
  title: string;
};

type AuthoringGroupWithTraining = AuthoringActivityGroup & {
  training_id: string;
};

function buildTransientDraft(training: Training, group: AuthoringActivityGroup): ContentDraft {
  const now = new Date().toISOString();
  return {
    id: "unsaved-activity-question",
    contentType: "activity",
    status: "draft",
    origin: "manual",
    primaryTrainingId: training.id,
    activityGroupId: group.id,
    title: training.title,
    slug: null,
    body: {},
    validationIssues: [],
    aiSource: null,
    aiModel: null,
    publishedRefId: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    trainingTitle: training.title,
    activityGroupTitle: group.title,
  };
}

function NewActivityQuestionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trainingId = searchParams.get("trainingId");
  const activityGroupId = searchParams.get("activityGroupId");

  const [draft, setDraft] = useState<ContentDraft | null>(null);
  const [groups, setGroups] = useState<AuthoringGroupWithTraining[]>([]);
  const [uncategorized, setUncategorized] = useState<UncategorizedActivityContent>({
    questions: [],
    drafts: [],
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      if (!trainingId || !activityGroupId) {
        setLoadError("Choose an activity group before adding a question.");
        setLoading(false);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      try {
        const [trainingsResult, groupsResult] = await Promise.all([
          apiFetch<{ trainings: Training[] }>("/api/thinkertools-missions-create/trainings"),
          apiFetch<{
            groups: AuthoringGroupWithTraining[];
            uncategorized: UncategorizedActivityContent;
          }>(
            `/api/thinkertools-missions-create/activity-groups?trainingId=${trainingId}`,
          ),
        ]);
        if (!mounted) return;

        const training = trainingsResult.trainings.find((item) => item.id === trainingId);
        const group = groupsResult.groups.find(
          (item) => item.id === activityGroupId && item.training_id === trainingId,
        );
        if (!training || !group) {
          setLoadError("That activity group is not available for this subject.");
          return;
        }

        setGroups(groupsResult.groups);
        setUncategorized(groupsResult.uncategorized);
        setDraft(buildTransientDraft(training, group));
      } catch (error) {
        if (!mounted) return;
        setLoadError(
          isApiRequestError(error) ? error.message : "Failed to open the question editor.",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadContext();
    return () => {
      mounted = false;
    };
  }, [activityGroupId, trainingId]);

  async function handleAddQuestionHere(group: AuthoringActivityGroup) {
    if (!trainingId) throw new Error("Choose a subject before adding a question.");
    if (group.id === activityGroupId) {
      throw new Error("You are already adding a new question to this group.");
    }
    router.push(
      `/thinkertools-missions-create/drafts/new?trainingId=${encodeURIComponent(trainingId)}&activityGroupId=${encodeURIComponent(group.id)}`,
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Link
          href="/thinkertools-missions-create"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← All drafts
        </Link>
      </div>

      {authError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          You need to be signed in to add a question. Use the Account menu to sign in.
        </div>
      ) : loading ? (
        <p className="text-sm text-slate-500">Opening question editor…</p>
      ) : loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {loadError}
        </div>
      ) : draft ? (
        <>
          <header className="mb-6">
            <h1 className="text-xl font-semibold text-slate-900">New activity question</h1>
            <p className="mt-1 text-xs text-slate-500">
              Not saved yet. This question will appear in the activity group after you save the draft.
            </p>
          </header>

          <ActivityEditor
            key={`${draft.primaryTrainingId}:${draft.activityGroupId}`}
            draft={draft}
            onDraftChange={setDraft}
            isTransient
            onDraftCreated={(created) => {
              router.replace(`/thinkertools-missions-create/drafts/${created.id}`);
            }}
            activityGroups={groups}
          />

          <div className="mt-10">
            <ActivityGroupBrowser
              groups={groups}
              loading={false}
              error={null}
              uncategorized={uncategorized}
              onAddQuestion={handleAddQuestionHere}
            />
          </div>
          <ActivityGroupsJumpLink />
        </>
      ) : null}
    </main>
  );
}

export default function NewActivityQuestionPage() {
  return (
    <Suspense fallback={null}>
      <NewActivityQuestionPageContent />
    </Suspense>
  );
}
