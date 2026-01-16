import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getPrisma } from '@/lib/prisma';
import { ProfileMentoring } from '@/lib/interfaces';
import { ProfileForm } from './_components/profile-form';

export default async function EditProfilePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/api/auth/signin');
  }

  const prisma = await getPrisma();
  const profile = await prisma.profile.findUnique({
    where: { email: session.user.email },
  });

  const mentoring = profile?.mentoring as ProfileMentoring | null;
  const initialData = mentoring
    ? {
        enabled: mentoring.enabled,
        expertise: mentoring.expertise || [],
        languages: mentoring.languages || [],
        bio: mentoring.bio || '',
        videoIntroUrl: mentoring.videoIntroUrl || '',
        goals: mentoring.goals || '',
        hourlyRate: mentoring.hourlyRate || 0,
      }
    : undefined;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Edit Mentoring Profile</h1>
      <div className="max-w-2xl">
        <ProfileForm initialData={initialData} />
      </div>
    </main>
  );
}
