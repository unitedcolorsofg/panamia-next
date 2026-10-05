-- Migration: 0052_group_membership_notifications
-- Purpose: Let people find out what happened to their group membership. Phase
--          9 built approve/reject/role/remove/ban but all of them were silent,
--          so you learned you had been approved or removed by revisiting a page
--          that had quietly changed.
-- Ticket: N/A
-- Reversible: No
--
-- Dependencies: notification_context and notification_activity_type enums
--               (0000_initial_schema.sql); social group tables (0044).
-- Data Migration: None
--
-- Rollback:
--   None available. Postgres has no ALTER TYPE ... DROP VALUE, so an added
--   enum label cannot be removed in place. Reversing this would mean creating
--   a replacement type without these labels, rewriting every column that uses
--   it, and dropping the old one -- only worth doing if a label were actively
--   harmful. Adding is idempotent and leaving them unused is harmless.
--
-- =============================================================================

-- Notifications for social group membership.
--
-- A new context rather than reusing 'group'. That value belongs to the relay
-- groups at /r/groups, where Accept already means "someone accepted your
-- invitation and joined" and is addressed to the inviter. Social groups need
-- Accept to mean "your request to join was approved", addressed to the person
-- who asked. Same context plus same type yields the same sentence, so the two
-- features cannot share one context without one of them reading wrong.
--
-- Three activity types come with it. All three are standard ActivityPub verbs,
-- which is what the rest of this schema is shaped around:
--
--   Join    someone asked to join -- distinct from Invite, which travels the
--           other way, from a group toward a person.
--   Remove  removed from a group. Delete would say the group itself was
--           deleted; the group is fine, the membership is not.
--   Block   banned. Kept apart from Remove because being shown the door once
--           and being barred are different outcomes, and a reader of the
--           notification list should be able to tell them apart.
--
-- ALTER TYPE ADD VALUE IF NOT EXISTS is idempotent and cannot run inside a
-- transaction block on PG < 12 -- Supabase is well past that. Postgres has no
-- DROP VALUE, so every line here is permanent.

ALTER TYPE "notification_context" ADD VALUE IF NOT EXISTS 'group_membership';

ALTER TYPE "notification_activity_type" ADD VALUE IF NOT EXISTS 'Join';
ALTER TYPE "notification_activity_type" ADD VALUE IF NOT EXISTS 'Remove';
ALTER TYPE "notification_activity_type" ADD VALUE IF NOT EXISTS 'Block';
