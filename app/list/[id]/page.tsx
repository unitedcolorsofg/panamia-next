import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import dbConnect from '@/lib/connectdb';
import userlist from '@/lib/model/userlist';
import { getPrisma } from '@/lib/prisma';
import { unguardProfile } from '@/lib/profile';
import { ProfileInterface } from '@/lib/interfaces';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getUserlistData(id: string) {
  await dbConnect();

  const existingUserlist = await userlist.findOne({ _id: id });

  if (!existingUserlist) {
    return null;
  }

  let profiles: ProfileInterface[] = [];

  if (existingUserlist?.profiles?.length > 0) {
    const prisma = await getPrisma();
    const listProfiles = await prisma.profile.findMany({
      where: {
        id: { in: existingUserlist.profiles },
      },
    });

    profiles = listProfiles.map((guardedProfile) => {
      return unguardProfile(guardedProfile);
    });
  }

  return {
    list: existingUserlist,
    profiles,
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  const data = await getUserlistData(id);

  if (!data) {
    return {
      title: 'List Not Found',
    };
  }

  return {
    title: `List: ${data.list?.name || 'Pana MIA'}`,
    description: data.list?.desc || 'View this curated list of Panas',
  };
}

export default async function ListPublicPage({ params }: PageProps) {
  const { id } = await params;

  const data = await getUserlistData(id);

  if (!data) {
    notFound();
  }

  const { list, profiles } = data;

  return (
    <main className="min-h-screen py-8">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-8">
          <h1 className="mb-4 text-3xl font-bold">List: {list?.name}</h1>
          {list?.desc && (
            <p className="text-muted-foreground text-lg">{list.desc}</p>
          )}
        </div>

        <div className="space-y-4">
          {profiles.length > 0 ? (
            profiles.map((item: ProfileInterface, index: number) => (
              <Card key={index}>
                <CardContent className="grid grid-cols-[4rem_1fr_auto] items-center gap-4 p-4">
                  <div className="h-16 w-16 overflow-hidden rounded-lg">
                    {item?.images?.primaryCDN ? (
                      <img
                        src={item.images.primaryCDN}
                        alt={item.name || ''}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src="/img/bg_coconut_blue.jpg"
                        alt="Default"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="font-semibold">{item.name}</div>
                  <Button asChild>
                    <Link href={`/profile/${item.slug}`}>View</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-muted-foreground p-8 text-center">
                There's no profiles on this list yet.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
