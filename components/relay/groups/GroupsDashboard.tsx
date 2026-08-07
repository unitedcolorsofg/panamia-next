'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Compass, Lock, Plus, Users } from 'lucide-react';
import type { GroupSummary, PendingInvite } from './types';
import { CreateGroupDialog } from './CreateGroupDialog';

interface GroupsResponse {
  enrolled: boolean;
  groups: GroupSummary[];
  invites: PendingInvite[];
}

export function GroupsDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<GroupsResponse | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [answering, setAnswering] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get<GroupsResponse>('/api/relay/groups');
      setData(res.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(groupId: string, action: 'accept' | 'decline') {
    setAnswering(groupId);
    try {
      const res = await axios.post<{ joined: boolean }>(
        `/api/relay/groups/${groupId}/invite/respond`,
        { action }
      );
      toast({
        title: res.data.joined ? 'Joined' : 'Invitation declined',
        description: res.data.joined
          ? 'You can find the group in any Nostr client signed in with your key.'
          : undefined,
      });
      await load();
    } catch (err: unknown) {
      // 412 is the one failure with a next step attached: the invitation is
      // still live, they just need a key first.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      toast({
        title:
          status === 412
            ? 'Generate your keys first'
            : 'Could not answer that invitation',
        description:
          status === 412
            ? 'Your invitation stays open — set up a key on the Resilience page, then come back.'
            : 'Refresh and try again.',
        variant: 'destructive',
      });
    } finally {
      setAnswering(null);
    }
  }

  if (error) {
    return (
      <p className="text-muted-foreground text-sm">
        Couldn&rsquo;t load your groups. Refresh and try again.
      </p>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      {data.invites.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            Invitations ({data.invites.length})
          </h2>
          {data.invites.map((invite) => (
            <Card key={invite.id}>
              <CardContent className="space-y-3 pt-6">
                <div>
                  <p className="font-medium">{invite.groupName}</p>
                  <p className="text-muted-foreground text-sm">
                    {invite.invitedByScreenname
                      ? `@${invite.invitedByScreenname} invited you`
                      : 'You were invited'}
                    {' · expires '}
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                {invite.groupAbout && (
                  <p className="text-sm">{invite.groupAbout}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={answering === invite.groupId}
                    onClick={() => respond(invite.groupId, 'accept')}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={answering === invite.groupId}
                    onClick={() => respond(invite.groupId, 'decline')}
                  >
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {!data.enrolled ? (
        <Card>
          <CardHeader>
            <CardTitle>Set up your keys first</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Groups live on the community relay, so you need a Nostr keypair
              before you can create or join one. It takes a moment and happens
              entirely in your browser.
            </p>
            <Button asChild>
              <Link href="/r">Go to the Resilience page</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">
                Groups you&rsquo;re in ({data.groups.length})
              </h2>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New group
              </Button>
            </div>

            {data.groups.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                You&rsquo;re not in any groups yet. Create one, or browse the
                groups open to all panas.
              </p>
            ) : (
              data.groups.map((group) => (
                <Card key={group.groupId}>
                  <CardContent className="pt-6">
                    <Link
                      href={`/r/groups/${group.groupId}`}
                      className="font-medium underline"
                    >
                      {group.name}
                    </Link>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {group.memberCount}
                      </span>
                      {group.joinPolicy === 'invite_only' && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Invite only
                        </Badge>
                      )}
                      {group.systemProvisioned && (
                        <Badge variant="outline">Pana MIA</Badge>
                      )}
                    </div>
                    {group.about && (
                      <p className="mt-2 text-sm">{group.about}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          <section>
            <Button asChild variant="outline">
              <Link href="/r/groups/browse">
                <Compass className="mr-2 h-4 w-4" />
                Browse groups open to all panas
              </Link>
            </Button>
          </section>

          <CreateGroupDialog
            open={creating}
            onOpenChange={setCreating}
            onCreated={load}
          />
        </>
      )}
    </div>
  );
}
