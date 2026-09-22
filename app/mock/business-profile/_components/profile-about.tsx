import type { BusinessProfile } from '../_data';

interface ProfileAboutProps {
  profile: BusinessProfile;
}

/**
 * The bio, with the short factual details pulled out beside it.
 *
 * The live profile runs bio and background together as one grey block of body
 * copy. Splitting the scannable facts (founded, owners, languages, what they
 * are good for) into their own column lets the prose stay prose — a visitor
 * deciding whether to book catering gets an answer without reading two
 * paragraphs first.
 */
export function ProfileAbout({ profile }: ProfileAboutProps) {
  return (
    <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-20" data-rv>
      <div>
        <span className="section-eyebrow">About</span>
        <h2 className="bizprofile-h2 mt-4">Who they are</h2>
        <div className="mt-6 space-y-5">
          {profile.bio.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="bizprofile-bio">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      <dl className="bizprofile-card divide-y-2 divide-[rgb(17_13_13_/_0.07)] self-start p-2 dark:divide-[hsl(var(--border))]">
        {profile.facts.map((fact) => (
          <div
            key={fact.label}
            className="flex items-baseline justify-between gap-6 px-5 py-4"
          >
            <dt className="bizprofile-stat-label">{fact.label}</dt>
            <dd className="text-right font-extrabold">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
