/**
 * Pure helper for filtering, capping, and ordering trainings rows.
 * Extracted so it can be property-tested without a live DB.
 */

export type RawTrainingRow = {
  id: string | null | undefined;
  slug: string | null | undefined;
  title: string | null | undefined;
  max_level: number;
  publication_status: 'pending' | 'live' | 'archived';
  created_at: string;
};

export type ValidTraining = {
  id: string;
  slug: string;
  title: string;
  maxLevel: number;
};

const TRAININGS_CAP = 200;

/**
 * Filters active trainings, removes rows missing a non-empty id/slug/title,
 * orders by `created_at` ascending, and caps at 200.
 */
export function filterCapOrderTrainings(rows: RawTrainingRow[]): ValidTraining[] {
  return rows
    .filter((row): row is RawTrainingRow & { id: string; slug: string; title: string; publication_status: 'live' } =>
      row.publication_status === 'live' &&
      typeof row.id === "string" && row.id.trim().length > 0 &&
      typeof row.slug === "string" && row.slug.trim().length > 0 &&
      typeof row.title === "string" && row.title.trim().length > 0
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, TRAININGS_CAP)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      maxLevel: row.max_level,
    }));
}
