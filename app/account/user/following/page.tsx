'use client';

import { FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfileInterface } from '@/lib/interfaces';
import {
  useMutateUserFollowing,
  useUser,
  useUserFollowing,
} from '@/lib/query/user';

export default function UserFollowingPage() {
  const { data: session } = useSession();
  const { data: userData } = useUser();
  const { data: followingData } = useUserFollowing();
  const userMutation = useMutateUserFollowing();

  const unfollowProfile = (e: FormEvent, id: string) => {
    e.preventDefault();
    const updates = {
      action: 'unfollow',
      id: id,
    };
    userMutation.mutate(updates);
  };

  if (!session) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Unauthorized</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                You must be logged in to view this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profiles You Follow</CardTitle>
          </CardHeader>
          <CardContent>
            {followingData && followingData.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {followingData.map((item: ProfileInterface, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Profile Image */}
                        <div className="aspect-square overflow-hidden rounded-lg">
                          <img
                            src={
                              item?.images?.primaryCDN ||
                              '/img/bg_coconut_blue.jpg'
                            }
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        {/* Profile Name */}
                        <Link
                          href={`/profile/${item.slug}`}
                          className="block font-semibold hover:text-blue-600"
                        >
                          {item.name}
                        </Link>

                        {/* Unfollow Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e: any) => {
                            unfollowProfile(e, item._id);
                          }}
                          className="w-full"
                        >
                          Unfollow
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <p>You're not following any profiles yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
