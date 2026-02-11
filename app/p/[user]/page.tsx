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
      images: profile.images?.primaryCDN ? [profile.images.primaryCDN] : [],
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

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="space-y-4">
        {/* Profile Header */}
        <ProfileHeader profile={profile} />

        {/* Mentoring Section - Show before other content for mentors */}
        {isMentor && profile.mentoring && (
          <MentoringSection mentoring={profile.mentoring} handle={user} />
        )}

        {/* Socials and Links */}
        {hasSocials && <ProfileSocials socials={profile.socials} />}

        {/* Location */}
        {hasAddress && (
          <ProfileLocation
            address={profile.primary_address}
            geo={profile.geo}
          />
        )}

        {/* Gallery */}
        {hasGallery && <ProfileGallery images={profile.images!} />}

        {/* Tags */}
        {profile.tags && <ProfileTags tags={profile.tags} />}

        {/* Social Activity */}
        <SocialSection handle={user} />
      </div>
    </main>
  );
}
