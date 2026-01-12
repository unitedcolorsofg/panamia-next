/**
 * Cross-Database Reference Types
 *
 * This file provides type-safe references between MongoDB documents and PostgreSQL tables.
 * When Prisma is configured, these types will be derived from the generated Prisma client,
 * ensuring build-time validation that referenced tables/columns exist.
 *
 * Usage in Mongoose schemas:
 *   import { PostgresUserId } from '@/lib/types/cross-db-refs';
 *
 *   interface IProfile {
 *     userId: PostgresUserId;  // Type-checked against Prisma schema
 *   }
 *
 * @see docs/DATABASE-ROADMAP.md for polyglot persistence architecture
 */

// =============================================================================
// PostgreSQL Reference Types
// =============================================================================
// Once Prisma is configured, uncomment the import and update type definitions:
//
// import type { User, Listing, Booking } from '@prisma/client';
// export type PostgresUserId = User['id'];
// export type PostgresListingId = Listing['id'];
// export type PostgresBookingId = Booking['id'];

/**
 * PostgreSQL User ID (cuid format)
 *
 * Used in MongoDB documents that reference the authoritative user record in PostgreSQL.
 * Format: cuid() - e.g., "clx1234567890abcdef"
 *
 * @prisma-table users
 * @prisma-column id
 */
export type PostgresUserId = string;

/**
 * PostgreSQL Listing ID (cuid format)
 *
 * Used for pet-sitting sidecar listings.
 *
 * @prisma-table listings
 * @prisma-column id
 */
export type PostgresListingId = string;

/**
 * PostgreSQL Booking ID (cuid format)
 *
 * Used for pet-sitting sidecar bookings.
 *
 * @prisma-table bookings
 * @prisma-column id
 */
export type PostgresBookingId = string;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Validates that a string looks like a cuid (PostgreSQL ID format)
 * cuids are 25 characters starting with 'c'
 */
export function isValidPostgresId(id: unknown): id is PostgresUserId {
  return typeof id === 'string' && /^c[a-z0-9]{24}$/.test(id);
}

/**
 * Validates that a string looks like a MongoDB ObjectId
 * ObjectIds are 24 hex characters
 */
export function isValidMongoId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-f0-9]{24}$/.test(id);
}

// =============================================================================
// Migration Helpers
// =============================================================================

/**
 * Marker type for fields that will be migrated from MongoDB ObjectId to PostgreSQL cuid.
 * Use this during the migration period to track which fields need updating.
 *
 * @example
 * // Before migration:
 * actor: MigratingToPostgres;  // Currently ObjectId, will become PostgresUserId
 */
export type MigratingToPostgres = string;

// =============================================================================
// Documentation for Schema Authors
// =============================================================================

/**
 * MONGODB SCHEMA GUIDELINES FOR POSTGRESQL REFERENCES
 *
 * When adding a field that references PostgreSQL data:
 *
 * 1. Use the appropriate type from this file:
 *    userId: PostgresUserId  // Not just 'string'
 *
 * 2. Document the reference in the schema:
 *    // @pg-ref: users.id
 *    userId: { type: String, index: true }
 *
 * 3. Add a changelog entry in mongo-migrations/:
 *    - Document the PostgreSQL dependency
 *    - Ensure the referenced PG migration exists
 *
 * 4. The pre-commit hook will validate:
 *    - Changelog entry exists for schema changes
 *    - PostgreSQL dependencies are documented
 */
