/**
 * Mentoring Utilities
 *
 * Helper functions and type definitions for the peer mentoring feature.
 */

import type { SessionType } from './validations/session';

/**
 * Session type metadata
 */
export const SESSION_TYPE_INFO: Record<
  SessionType,
  {
    label: string;
    description: string;
    allowsPricing: boolean;
  }
> = {
  artistic: {
    label: 'Artistic Consultation',
    description: 'Creative feedback on poems, art, music, writing, etc.',
    allowsPricing: true,
  },
  knowledge_transfer: {
    label: 'Knowledge Transfer',
    description: 'Business advice, career guidance, technical skills',
    allowsPricing: true,
  },
  panamia_planning: {
    label: 'Pana MIA Planning',
    description: 'Community planning and coordination',
    allowsPricing: false, // Always free
  },
  pana_support: {
    label: 'Pana Support',
    description: 'Peer support, personal guidance, and comradery',
    allowsPricing: true,
  },
};

/**
 * Get the URL for a specific mentoring session
 */
export function getSessionUrl(sessionId: string): string {
  return `/m/session/${sessionId}`;
}

/**
 * Get the URL for the mentoring schedule page
 */
export function getScheduleUrl(): string {
  return '/m/schedule';
}

/**
 * Get the URL for the mentoring discovery page
 */
export function getDiscoverUrl(): string {
  return '/m/discover';
}

/**
 * Get human-readable label for a session type
 */
export function getSessionTypeLabel(sessionType: SessionType): string {
  return SESSION_TYPE_INFO[sessionType]?.label ?? sessionType;
}

/**
 * Check if a session type allows custom pricing
 * (panamia_planning is always free)
 */
export function sessionTypeAllowsPricing(sessionType: SessionType): boolean {
  return SESSION_TYPE_INFO[sessionType]?.allowsPricing ?? true;
}
