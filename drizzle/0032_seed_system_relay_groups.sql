-- Migration: 0032_seed_system_relay_groups
-- Purpose: Create the two auto-enrollment groups as actual rows.
--
--          relay_group_members.group_id is a foreign key to relay_groups
--          (0023_nostr_schema), but 'panamia-test' and 'panamia-public' only
--          ever existed as hardcoded string constants — in
--          app/api/relay/enroll, app/api/relay/rotate, and
--          lib/nostr/relay-identity-events. No migration or script inserted
--          them, so every enrollment INSERT hits a foreign-key violation
--          (SQLSTATE 23503) inside the enroll transaction, surfacing as a 500
--          with a minified stack. Observed in production on CF ray
--          a2777d115fa20a86.
--
--          created_by is left NULL on purpose: that is what marks a group as
--          panamia-provisioned, which exempts it from the delete-when-empty
--          rule in lib/relay/group-lifecycle.ts and blocks member edits. An
--          empty system group is one nobody has joined yet, not garbage.
--
--          discoverable follows join_policy the way member-created groups do:
--          panamia-public is the ActivityPub-bridged public group, so it is
--          open and advertised; panamia-test is the private chat group.
-- Ticket: N/A
-- Reversible: Yes, but destructive -- dropping these rows cascades to every
--             membership, pending join/leave, and invitation attached to them.
--
-- Dependencies: 0023_nostr_schema (relay_groups), 0031_relay_group_self_service
--               (join_policy, created_by)
-- Data Migration: Inline seed. ON CONFLICT DO NOTHING, so this is a no-op on
--                 any environment where the rows were created by hand.
--
-- Rollback:
--   DELETE FROM "relay_groups" WHERE "group_id" IN ('panamia-test', 'panamia-public');
-- =============================================================================

INSERT INTO "relay_groups" ("group_id", "name", "about", "join_policy", "discoverable")
VALUES
  (
    'panamia-test',
    'Pana MIA Community',
    'The community group chat for Pana MIA members. Read-gated at the relay, not end-to-end encrypted.',
    'invite_only',
    false
  ),
  (
    'panamia-public',
    'Pana MIA Public',
    'The public Pana MIA group, bridged to the fediverse.',
    'open',
    true
  )
ON CONFLICT ("group_id") DO NOTHING;
