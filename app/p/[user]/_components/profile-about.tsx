'use client';

import { useTranslation } from 'react-i18next';
import type { ProfileView } from '../_lib/profile-view';

interface ProfileAboutProps {
  profile: ProfileView;
  /** From descriptions.tags — free text the business entered, comma separated. */
  tags: string[];
}

/**
 * The bio, with the business's own tags pulled out beside it.
 *
 * The page this replaces ran the bio as one grey block of body copy and put
 * the tags in a separate card much further down. Setting them side by side
 * lets the prose stay prose: a visitor deciding whether to book catering can
 * scan the tags for an answer without reading two paragraphs first.
 *
 * A client component only because translation is client-side in this app. It
 * still server-renders, so it stays in the cached HTML.
 */
export function ProfileAbout({ profile, tags }: ProfileAboutProps) {
  const { t } = useTranslation('profile');

  // Authors type blank lines between paragraphs; rendering the whole string in
  // one <p> collapses that to a wall. Split on blank lines and keep the rest
  // as typed.
  const paragraphs = (profile.bio ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0 && tags.length === 0) return null;

  return (
    <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-20" data-rv>
      <div>
        <span className="section-eyebrow">{t('about.eyebrow')}</span>
        <h2 className="bizprofile-h2 mt-4">{t('about.heading')}</h2>
        <div className="mt-6 space-y-5">
          {paragraphs.map((paragraph, index) => (
            <p
              key={`${index}-${paragraph.slice(0, 24)}`}
              className="bizprofile-bio"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="bizprofile-card self-start p-7">
          <span className="bizprofile-stat-label">
            {t('about.tagsHeading')}
          </span>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="tagpill">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
