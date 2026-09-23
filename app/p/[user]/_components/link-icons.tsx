import {
  Camera,
  Globe,
  MessageCircle,
  Music2,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { LinkKind } from '../_lib/profile-view';

/**
 * Icons for the external-links row.
 *
 * Deliberately generic glyphs rather than brand marks: lucide dropped its
 * brand icons in v1, and the chips carry the account handle as their label
 * ("@bohemiankitchenmia"), which identifies the destination more precisely
 * than a logo would anyway. The icon is there to make the row scannable, not
 * to name the platform.
 */
export const LINK_ICON: Record<LinkKind, LucideIcon> = {
  website: Globe,
  instagram: Camera,
  facebook: Users,
  tiktok: Video,
  twitter: MessageCircle,
  spotify: Music2,
};

export const LINK_TITLE: Record<LinkKind, string> = {
  website: 'Website',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  twitter: 'X',
  spotify: 'Spotify',
};
