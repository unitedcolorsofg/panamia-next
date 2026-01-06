import { z } from 'zod';

export const sessionTypeSchema = z.enum([
  'artistic',
  'knowledge_transfer',
  'panamia_planning',
  'pana_support',
]);

export const createSessionSchema = z.object({
  mentorEmail: z.string().email(),
  scheduledAt: z.string().datetime(), // ISO 8601
  duration: z.number().min(15).max(120),
  topic: z.string().min(5, 'Topic must be at least 5 characters').max(200),
  sessionType: sessionTypeSchema,
});

export const respondSessionSchema = z.object({
  action: z.enum(['accept', 'decline']),
  reason: z.string().max(500).optional(), // Required for decline
});

export const updateSessionNotesSchema = z.object({
  sessionId: z.string(),
  notes: z.string().max(5000),
});

export const cancelSessionSchema = z.object({
  sessionId: z.string(),
  reason: z.string().min(1).max(500),
});

export type SessionType = z.infer<typeof sessionTypeSchema>;
export type CreateSessionData = z.infer<typeof createSessionSchema>;
export type RespondSessionData = z.infer<typeof respondSessionSchema>;
export type UpdateSessionNotesData = z.infer<typeof updateSessionNotesSchema>;
export type CancelSessionData = z.infer<typeof cancelSessionSchema>;
