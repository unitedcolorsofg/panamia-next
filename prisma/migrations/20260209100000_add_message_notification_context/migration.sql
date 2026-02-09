-- Migration: add_message_notification_context
-- Purpose: Add 'message' value to NotificationContext enum for DM notifications
-- Ticket: N/A
-- Reversible: Yes (ALTER TYPE ... DROP VALUE is not supported, would need recreation)

ALTER TYPE "NotificationContext" ADD VALUE 'message';
