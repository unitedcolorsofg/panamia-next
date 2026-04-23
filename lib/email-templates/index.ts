import { profileSubmitted } from './profile-submitted';
import { profilePublished } from './profile-published';
import { profileNotPublished } from './profile-not-published';
import { adminNewsletter } from './admin-newsletter';
import { adminProfile } from './admin-profile';
import { adminAffiliate } from './admin-affiliate';

export type TemplateId =
  | 'profile.submitted'
  | 'profile.published'
  | 'profile.not_published'
  | 'admin.newsletter_submission'
  | 'admin.profile_submission'
  | 'admin.affiliate_submission';

type TemplateRenderer = (params: Record<string, unknown>) => {
  subject: string;
  html: string;
  text: string;
};

const templates: Record<TemplateId, TemplateRenderer> = {
  'profile.submitted': profileSubmitted,
  'profile.published': profilePublished,
  'profile.not_published': profileNotPublished,
  'admin.newsletter_submission': adminNewsletter,
  'admin.profile_submission': adminProfile,
  'admin.affiliate_submission': adminAffiliate,
};

export function renderTemplate(
  id: TemplateId,
  params: Record<string, unknown>
): { subject: string; html: string; text: string } {
  const renderer = templates[id];
  if (!renderer) {
    throw new Error(`Unknown email template: ${id}`);
  }
  return renderer(params);
}
