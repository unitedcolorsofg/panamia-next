'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Users } from 'lucide-react';
import type { GroupSummary } from './types';

interface BrowseResponse {
  enrolled: boolean;
  groups: GroupSummary[];
}

export function BrowseGroups() {
  const { toast } = useToast();
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [error, setError] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get<BrowseResponse>('/api/relay/groups/browse');
      setData(res.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function join(group: GroupSummary) {
    setJoining(group.groupId);
    try {
      await axios.post(`/api/relay/groups/${group.groupId}/join`);
      toast({
        title: `Joined ${group.name}`,
        description:
          'Open it in your Nostr app — you may need to refresh the group list there.',
      });
      // The joined group drops off this list on reload, which is the feedback.
      await load();
    } catch {
      toast({
        title: 'Could not join that group',
        description: 'Refresh and try again.',
        variant: 'destructive',
      });
    } finally {
      setJoining(null);
    }
  }

  if (error) {
    return (
      <p className="text-muted-foreground text-sm">
        Couldn&rsquo;t load the group list. Refresh and try again.
      </p>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!data.enrolled) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm">
            You need a Nostr keypair before you can join a group. It&rsquo;s
            generated in your browser and takes a moment.
          </p>
          <Button asChild>
            <Link href="/r">Set up your keys</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (data.groups.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No open groups to join right now — either none exist yet, or
        you&rsquo;re already in all of them.{' '}
        <Link href="/r/groups" className="underline">
          Start one
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data.groups.map((group) => (
        <Card key={group.groupId}>
          <CardContent className="flex items-start justify-between gap-4 pt-6">
            <div className="min-w-0">
              <p className="font-medium">{group.name}</p>
              <p className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-sm">
                <Users className="h-3.5 w-3.5" />
                {group.memberCount}
              </p>
              {group.about && <p className="mt-2 text-sm">{group.about}</p>}
            </div>
            <Button
              size="sm"
              disabled={joining === group.groupId}
              onClick={() => join(group)}
            >
              {joining === group.groupId ? 'Joining…' : 'Join'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
