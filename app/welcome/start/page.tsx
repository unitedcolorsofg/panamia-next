import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { resolveSurface } from '@/lib/panaverse/surfaces';
import { StartView } from './_components/start-view';

/**
 * The fork: what a member does first, asked once, right after they claim a
 * screenname.
 *
 * Phase 1 got them a profile. This is the other half of the problem — a member
 * with a working account and no idea that the directory, the timeline, and a
 * business listing are three different things. Until now the only self-serve
 * route that looked like "finish setting up my account" was `become-a-pana`,
 * which lists you as a vendor: a person who came to read a feed was being
 * offered the job of registering a company.
 *
 * Three doors, one click each, no form. The person-versus-business split that
 * ACCOUNTS-ROADMAP.md specifies gets made here, by which door gets clicked.
 * See docs/ONBOARDING-ROADMAP.md, Phase 2.
 */

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('host') ?? '';
  const surface = resolveSurface(host);
  return {
    title: `Where to start | ${surface.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function WelcomeStartPage() {
  const host = (await headers()).get('host') ?? '';
  const surface = resolveSurface(host);
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent('/welcome/start')}`);
  }

  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { screenname: true, accountType: true },
  });

  // "You're all set" is a lie if they are not. Someone who skipped the
  // screenname, or who arrived by typing the URL, goes back to the question
  // that actually gates posting and following.
  if (!currentUser?.screenname) {
    redirect('/welcome');
  }

  // Offering a listing to an account that already has one is noise. The other
  // two doors are places to go, so they are always worth showing.
  const alreadyListed =
    currentUser.accountType === 'small_business' ||
    currentUser.accountType === 'hybrid';

  return (
    <StartView
      rootPath={surface.rootPath}
      screenname={currentUser.screenname}
      showBusinessDoor={!alreadyListed}
    />
  );
}
