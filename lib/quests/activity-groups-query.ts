/**
 * Pure helper for filtering and ordering activity-group rows.
 * Extracted so it can be property-tested without a live DB.
 */

export type RawActivityGroupRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  training_id: string;
  display_order: number;
  is_active: boolean;
};

export type ActivityGroupSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  trainingId: string;
  displayOrder: number;
};

/**
 * Filters to active groups for the given training, orders by `display_order`
 * ascending with ties broken by `slug` ascending, and maps to the API shape.
 */
export function filterOrderActivityGroups(
  rows: RawActivityGroupRow[],
  trainingId: string,
): ActivityGroupSummary[] {
  return rows
    .filter(
      (row) => row.is_active === true && row.training_id === trainingId,
    )
    .sort((a, b) => {
      const orderDiff = a.display_order - b.display_order;
      if (orderDiff !== 0) return orderDiff;
      return a.slug.localeCompare(b.slug);
    })
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      trainingId: row.training_id,
      displayOrder: row.display_order,
    }));
}
