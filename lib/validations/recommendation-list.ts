/**
 * Input validation for Recommendation Lists.
 *
 * Length caps are deliberate rather than defensive. A list is a personal
 * vouch, not a review site: the note should read like something a pana said
 * across a table, so the ceiling is high enough for a real thought and low
 * enough that nobody mistakes this for a blog post. The same logic sets the
 * item cap — a "Cafecito crawl" with eighty stops is not a recommendation.
 */
import { z } from 'zod';

export const recommendationListVisibilitySchema = z.enum([
  'private',
  'unlisted',
  'public',
]);

export const MAX_ITEMS_PER_LIST = 50;
export const MAX_LISTS_PER_OWNER = 25;

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Give the list a title')
  .max(80, 'Title must be 80 characters or fewer');

const blurbSchema = z
  .string()
  .trim()
  .max(280, 'Blurb must be 280 characters or fewer');

const noteSchema = z
  .string()
  .trim()
  .min(1, 'Say why this one belongs on the list')
  .max(500, 'Note must be 500 characters or fewer');

export const createRecommendationListSchema = z.object({
  title: titleSchema,
  blurb: blurbSchema.optional(),
  visibility: recommendationListVisibilitySchema.optional(),
});

// Every field optional, but at least one required — a PATCH that changes
// nothing is a bug in the caller, not a no-op worth pretending succeeded.
// Note the absence of `slug`: it is minted once and frozen, because it is
// carried in the federated `id` URI. See lib/schema/index.ts.
export const updateRecommendationListSchema = z
  .object({
    title: titleSchema.optional(),
    blurb: blurbSchema.nullable().optional(),
    visibility: recommendationListVisibilitySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const createRecommendationListItemSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
  note: noteSchema,
});

export const updateRecommendationListItemSchema = z.object({
  note: noteSchema,
});

// The whole running order in one request. Sending the complete set of item ids
// rather than {id, position} pairs makes an incomplete or duplicated order
// impossible to express — the server rewrites positions from the array index,
// so the payload cannot describe a list with two things in third place.
export const reorderRecommendationListSchema = z.object({
  itemIds: z
    .array(z.string().min(1))
    .min(1, 'itemIds must not be empty')
    .max(MAX_ITEMS_PER_LIST)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'itemIds must not contain duplicates',
    }),
});

export type RecommendationListVisibilityInput = z.infer<
  typeof recommendationListVisibilitySchema
>;
export type CreateRecommendationListData = z.infer<
  typeof createRecommendationListSchema
>;
export type UpdateRecommendationListData = z.infer<
  typeof updateRecommendationListSchema
>;
export type CreateRecommendationListItemData = z.infer<
  typeof createRecommendationListItemSchema
>;
export type UpdateRecommendationListItemData = z.infer<
  typeof updateRecommendationListItemSchema
>;
export type ReorderRecommendationListData = z.infer<
  typeof reorderRecommendationListSchema
>;
