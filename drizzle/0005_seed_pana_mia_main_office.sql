-- Migration: 0005_seed_pana_mia_main_office
-- Purpose: Insert the default "Pana MIA Main Office" venue so new events
--          have at least one active venue to select without waiting for
--          admin approval of a user-submitted venue.
-- Ticket: N/A
-- Reversible: Yes
--
-- Rollback:
--   DELETE FROM "venues" WHERE "slug" = 'pana-mia-main-office';

INSERT INTO "venues" (
  "id",
  "created_at",
  "updated_at",
  "slug",
  "name",
  "address",
  "city",
  "state",
  "country",
  "parking_options",
  "operator_profile_id",
  "status",
  "photos"
) VALUES (
  'cm0panamiamain000000000001',
  NOW(),
  NOW(),
  'pana-mia-main-office',
  'Pana MIA Main Office',
  '100 Biscayne Blvd',
  'Miami',
  'FL',
  'US',
  'street',
  'sfre2h1ds4uobwx57ei04n20',
  'active',
  '[]'::jsonb
)
ON CONFLICT ("slug") DO NOTHING;
