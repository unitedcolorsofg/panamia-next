import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';

export default async function MentoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center space-x-8">
            <Link href="/" className="text-xl font-bold">
              Pana Mia
            </Link>
            <Link
              href="/m/discover"
              className="text-muted-foreground hover:text-foreground"
            >
              Discover
            </Link>
            <Link
              href="/m/schedule"
              className="text-muted-foreground hover:text-foreground"
            >
              My Sessions
            </Link>
            <Link
              href="/m/profile"
              className="text-muted-foreground hover:text-foreground"
            >
              Mentoring Profile
            </Link>
          </div>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
