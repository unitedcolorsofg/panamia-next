'use client';

/**
 * The blocked and muted account lists, for settings.
 *
 * This is the only place a block becomes visible again after it is made, which
 * makes it more load-bearing than it looks: somebody who blocked a person
 * during a bad week and wants to reconsider has nowhere else to go.
 *
 * Only outgoing rows are ever shown. The API does not return who blocked you
 * and this screen could not display it if it wanted to — a list of people who
 * have blocked you is a notification, and notifying someone that they were
 * blocked is how a block turns into an escalation.
 *
 * See docs/SOCIAL-GRAPH.md section B.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useBlockList,
  useUnblockActor,
  type SocialBlockKind,
  type BlockedActorEntry,
} from '@/lib/query/social';
import { toast } from '@/hooks/use-toast';
import { Ban, VolumeX, Loader2 } from 'lucide-react';

function initials(entry: BlockedActorEntry) {
  const source = entry.actor.name || entry.actor.username;
  return source.slice(0, 2).toUpperCase();
}

function BlockRow({
  entry,
  kind,
}: {
  entry: BlockedActorEntry;
  kind: SocialBlockKind;
}) {
  const unblock = useUnblockActor();
  const [done, setDone] = useState(false);
  const who = entry.actor.name || `@${entry.actor.username}`;

  const handleUndo = async () => {
    try {
      await unblock.mutateAsync({ username: entry.actor.username, kind });
      setDone(true);
      toast({
        title: kind === 'block' ? `Unblocked ${who}` : `Unmuted ${who}`,
        description:
          kind === 'block'
            ? 'Following is not restored. You can follow each other again if you want to.'
            : 'Their posts will show up again.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Something went wrong',
        description:
          error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <li className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-9 w-9">
          {entry.actor.iconUrl ? (
            <AvatarImage src={entry.actor.iconUrl} alt="" />
          ) : null}
          <AvatarFallback>{initials(entry)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {/*
            Still a link. Blocking someone does not mean you should be unable
            to look at what you blocked, and the profile itself is gated
            server-side anyway.
          */}
          <Link
            href={`/@${entry.actor.username}`}
            className="block truncate font-medium hover:underline"
          >
            {entry.actor.name || entry.actor.username}
          </Link>
          <p className="text-muted-foreground truncate text-sm">
            @{entry.actor.username}
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleUndo}
        disabled={unblock.isPending || done}
      >
        {unblock.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : done ? (
          'Done'
        ) : kind === 'block' ? (
          'Unblock'
        ) : (
          'Unmute'
        )}
      </Button>
    </li>
  );
}

function BlockPanel({ kind }: { kind: SocialBlockKind }) {
  const { data, isLoading } = useBlockList(kind);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  const entries = data ?? [];

  if (entries.length === 0) {
    return (
      <div className="py-10 text-center">
        {kind === 'block' ? (
          <Ban className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
        ) : (
          <VolumeX className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
        )}
        <p className="text-muted-foreground text-sm">
          {kind === 'block'
            ? 'You have not blocked anyone.'
            : 'You have not muted anyone.'}
        </p>
      </div>
    );
  }

  return (
    <ul>
      {entries.map((entry) => (
        <BlockRow key={entry.block.id} entry={entry} kind={kind} />
      ))}
    </ul>
  );
}

export function BlockedAccountsSettings() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Blocked and muted</h2>
        <p className="text-muted-foreground text-sm">
          Blocking stops you following each other and hides you both ways.
          Muting only hides their posts from you — they are never told, and
          nothing changes on their side.
        </p>
      </div>

      <Tabs defaultValue="block">
        <TabsList>
          <TabsTrigger value="block">Blocked</TabsTrigger>
          <TabsTrigger value="mute">Muted</TabsTrigger>
        </TabsList>
        <TabsContent value="block">
          <BlockPanel kind="block" />
        </TabsContent>
        <TabsContent value="mute">
          <BlockPanel kind="mute" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
