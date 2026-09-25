/**
 * Maps RecommendationListError codes to HTTP status codes.
 *
 * Separate from the wrapper so that lib/federation/wrappers/recommendation-list.ts
 * stays transport-agnostic — the db tests drive it directly and should not
 * have to care about HTTP — while every route still answers with the same
 * status for the same failure. One table, six routes.
 */
import { NextResponse } from 'next/server';
import { RecommendationListError } from '@/lib/federation/wrappers/recommendation-list';
import type { ListErrorCode } from '@/lib/federation/wrappers/recommendation-list';

const STATUS_BY_CODE: Record<ListErrorCode, number> = {
  NOT_FOUND: 404,
  // 404, not 403: revealing that a list exists but is not yours is itself a
  // disclosure, and a private list should be indistinguishable from no list.
  FORBIDDEN: 404,
  NOT_A_DIRECTORY_LISTING: 422,
  DUPLICATE_ENTRY: 409,
  LIST_FULL: 409,
  TOO_MANY_LISTS: 409,
  INCOMPLETE_ORDER: 400,
};

/**
 * Turns a thrown error into a response, or rethrows anything that is not ours
 * so genuine bugs still reach the 500 handler instead of being flattened into
 * a tidy 4xx.
 */
export function handleListError(error: unknown): NextResponse {
  if (error instanceof RecommendationListError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: STATUS_BY_CODE[error.code] }
    );
  }
  throw error;
}
