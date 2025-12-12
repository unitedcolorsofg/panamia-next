'use client';

import { FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserlistInterface } from '@/lib/interfaces';
import { useMutateUserLists, useUser, useUserLists } from '@/lib/query/user';
import { ExternalLink, Trash2 } from 'lucide-react';

export default function UserListsPage() {
  const { data: session } = useSession();
  const { data: userData } = useUser();
  const { data: userlistsData } = useUserLists();
  const userMutation = useMutateUserLists();

  const deleteList = (e: FormEvent, id: string) => {
    e.preventDefault();
    if (confirm('Are you sure you want to delete this list?')) {
      const updates = {
        action: 'delete',
        id: id,
      };
      userMutation.mutate(updates);
    }
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
            <CardTitle>My Lists</CardTitle>
          </CardHeader>
          <CardContent>
            {userlistsData && userlistsData.length > 0 ? (
              <div className="space-y-4">
                {userlistsData.map((item: UserlistInterface, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">{item.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {item.profiles.length} profile
                            {item.profiles.length !== 1 ? 's' : ''}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/list/${item._id}`} target="_blank">
                              <ExternalLink className="h-4 w-4" />
                              View
                            </Link>
                          </Button>

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e: any) => {
                              deleteList(e, item._id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <p>You haven't created any lists yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
