-- Migration: 0005_seed_pana_mia_main_office
-- Status:    NO-OP (intentionally empty)
--
-- Originally this migration seeded a "Pana MIA Main Office" venue with
-- operator_profile_id = 'sfre2h1ds4uobwx57ei04n20'. That referenced a
-- profile that was created out-of-band in prod but did not exist in a
-- fresh database, so applying migrations from scratch (CI test DB) failed
-- when 0017 added the FK on venues.operator_profile_id -> profiles.id.
--
-- The seed venue is no longer required (production was wiped while still
-- greenfield, and 0012's UPDATE on the venue silently no-ops if it doesn't
-- exist). The file is retained as a no-op to preserve migration ordering.
--
-- Reversible: N/A (no-op)

SELECT 1;
