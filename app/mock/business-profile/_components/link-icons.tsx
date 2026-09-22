import {
  BookOpen,
  Camera,
  Globe,
  Mail,
  Music2,
  Phone,
  ShoppingBag,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { LinkKind } from '../_data';

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
  menu: BookOpen,
  instagram: Camera,
  facebook: Users,
  tiktok: Music2,
  youtube: Video,
  shop: ShoppingBag,
  phone: Phone,
  email: Mail,
};

export const LINK_TITLE: Record<LinkKind, string> = {
  website: 'Website',
  menu: 'Menu',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  shop: 'Shop',
  phone: 'Phone',
  email: 'Email',
};
