-- Migration: 0018_add_cc0_to_cc_license
-- Purpose: Add CC0 1.0 (public domain dedication) as a choice on the cc_license
--          enum so authors can release Articles and Social posts as Free Cultural
--          Works under CC0 in addition to CC BY 4.0 and CC BY-SA 4.0.
-- Ticket: N/A
-- Reversible: No (Postgres does not support removing enum values without recreating the type)
--
-- Dependencies: 0010_add_cc_license

ALTER TYPE "public"."cc_license" ADD VALUE IF NOT EXISTS 'cc-0';
