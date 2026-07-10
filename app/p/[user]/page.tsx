import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicProfile } from '@/lib/server/profile';
import { ProfileHeader } from './_components/profile-header';
import { ProfileSocials } from './_components/profile-socials';
import { ProfileLocation } from './_components/profile-location';
import { ProfileGallery } from './_components/profile-gallery';
import { ProfileTags } from './_components/profile-tags';
import { MentoringSection } from './_components/mentoring-section';
import { SocialSection } from './_components/social-section';
import { NpubQr } from '@/components/relay/NpubQr';
import { npubFromHex } from '@/lib/nostr/keys';

// Encode a hex pubkey to npub, returning null on malformed input so a bad row
// can't 500 the profile page.
function safeNpubFromHex(hex: string): string | null {
  try {
    return npubFromHex(hex);
  } catch {
    return null;
  }
}

// Cache public profile renders at the edge (Workers Cache).
// Safe: this page reads no cookies/headers/session server-side — session,
// theme, and language are all hydrated client-side, so the SSR output is
// identical for every visitor. vinext emits `s-maxage=300, stale-while-revalidate`.
export const revalidate = 300;

interface PageProps {
  params: Promise<{ user: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { user } = await params;
  const profile = await getPublicProfile(user);

  if (!profile) {
    return { title: 'Profile Not Found' };
  }

  return {
    title: `${profile.name} | Pana Mia Club`,
    description: profile.details || profile.five_words,
    openGraph: {
      title: profile.name,
      description: profile.details || profile.five_words,
      images: profile.images?.primaryCDN
        ? [profile.images.primaryCDN]
        : undefined,
    },
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const { user } = await params;
  const profile = await getPublicProfile(user);

  if (!profile) {
    notFound();
  }

  const hasSocials = Boolean(
    profile.socials?.website ||
    profile.socials?.facebook ||
    profile.socials?.instagram ||
    profile.socials?.tiktok ||
    profile.socials?.twitter ||
    profile.socials?.spotify
  );

  const hasAddress = Boolean(
    profile.primary_address?.street1 ||
    profile.primary_address?.street2 ||
    profile.primary_address?.city ||
    profile.primary_address?.state ||
    profile.primary_address?.zipcode
  );

  const hasGallery = Boolean(
    profile.images?.gallery1CDN ||
    profile.images?.gallery2CDN ||
    profile.images?.gallery3CDN
  );

  const isMentor = profile.mentoring?.enabled === true;

  // Relay-enrolled profiles carry a hex nostr_pubkey; encode it to an npub
  // here so only the npub (never raw hex) reaches the client.
  const npub =
    typeof profile.nostrPubkey === 'string'
      ? safeNpubFromHex(profile.nostrPubkey)
      : null;

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="space-y-4">
        {/* Profile Header */}
        <ProfileHeader
          profile={{
            ...profile,
            name: profile.name ?? '',
            five_words: profile.five_words ?? '',
            details: profile.details ?? '',
          }}
        />

        {/* Mentoring Section - Show before other content for mentors */}
        {isMentor && profile.mentoring && (
          <MentoringSection mentoring={profile.mentoring} handle={user} />
        )}

        {/* Socials and Links */}
        {hasSocials && <ProfileSocials socials={profile.socials!} />}

        {/* Location */}
        {hasAddress && (
          <ProfileLocation
            address={profile.primary_address}
            geo={
              profile.geo
                ? { coordinates: profile.geo.coordinates as [number, number] }
                : undefined
            }
          />
        )}

        {/* Gallery */}
        {hasGallery && <ProfileGallery images={profile.images!} />}

        {/* Tags */}
        {profile.tags && <ProfileTags tags={profile.tags!} />}

        {/* Social Activity */}
        <SocialSection handle={user} />

        {/* Nostr identity (relay-enrolled profiles only) */}
        {npub && <NpubQr npub={npub} />}
      </div>
    </main>
  );
}
