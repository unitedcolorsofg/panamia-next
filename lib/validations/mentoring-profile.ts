import { z } from 'zod';

export const mentoringProfileSchema = z.object({
  enabled: z.boolean(),
  expertise: z
    .array(z.string())
    .min(1, 'At least one expertise required')
    .max(10),
  languages: z.array(z.string()).min(1, 'At least one language required'),
  bio: z.string().min(10, 'Bio must be at least 10 characters').max(500),
  videoIntroUrl: z.string().url().optional().or(z.literal('')),
  goals: z.string().max(500).optional().or(z.literal('')),
  hourlyRate: z.number().min(0).optional(),
});

export const availabilitySchema = z.object({
  timezone: z.string(),
  schedule: z.array(
    z.object({
      day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })
  ),
});

export type MentoringProfileData = z.infer<typeof mentoringProfileSchema>;
export type AvailabilityData = z.infer<typeof availabilitySchema>;
