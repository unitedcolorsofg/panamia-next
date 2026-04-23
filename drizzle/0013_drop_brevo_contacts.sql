-- Migration: 0013_drop_brevo_contacts
-- Purpose: Remove brevo_contacts table — Brevo has been replaced by
--          Cloudflare Email Sending (transactional email) and HighLevel
--          (contact/CRM management).
-- Ticket: N/A
-- Reversible: No (table and data are permanently removed)

DROP TABLE IF EXISTS "brevo_contacts";
