'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Lock, UserPlus, Users } from 'lucide-react';
import {
  memberLabel,
  type GroupMemberSummary,
  type GroupSummary,
} from './types';

interface GroupResponse {
  group: GroupSummary & { isMember: boolean };
  members: GroupMemberSummary[];
}

export function GroupDetail({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<GroupResponse | null>(null);
  const [missing, setMissing] = useState(false);

  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);

  const [editName, setEditName] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get<GroupResponse>(
        `/api/relay/groups/${groupId}`
      );
      setData(res.data);
      setEditName(res.data.group.name);
      setEditAbout(res.data.group.about ?? '');
      setMissing(false);
    } catch {
      setMissing(true);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  async function invite() {
    const screenname = inviteName.trim();
    if (!screenname || inviting) return;
    setInviting(true);
    try {
      const res = await axios.post<{ screenname: string }>(
        `/api/relay/groups/${groupId}/invite`,
        { screenname }
      );
      toast({ title: `Invited @${res.data.screenname}` });
      setInviteName('');
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : 'Refresh and try again.';
      toast({
        title: 'Could not send that invitation',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await axios.patch(`/api/relay/groups/${groupId}`, {
        name: editName.trim(),
        about: editAbout.trim(),
      });
      toast({ title: 'Group updated' });
      await load();
    } catch {
      toast({
        title: 'Could not save those changes',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function leave() {
    setLeaving(true);
    try {
      await axios.post(`/api/relay/groups/${groupId}/leave`);
      toast({
        title: 'You have asked to leave',
        description:
          'It takes effect in about a day. Rejoining before then cancels it.',
      });
      router.push('/r/groups');
    } catch {
      toast({ title: 'Could not leave that group', variant: 'destructive' });
      setLeaving(false);
    }
  }

  if (missing) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Group not found</h1>
        <p className="text-muted-foreground text-sm">
          It may have been deleted after its last member left, or it&rsquo;s an
          invite-only group you aren&rsquo;t part of.
        </p>
        <Button asChild variant="outline">
          <Link href="/r/groups">Back to your groups</Link>
        </Button>
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  const { group, members } = data;
  // Open groups accept invitations from any member; invite-only groups only
  // from whoever holds creator rights. Mirrors the check in the API route.
  const canInvite =
    group.isMember && (group.joinPolicy === 'open' || group.canManage);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{group.name}</h1>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
          </span>
          {group.joinPolicy === 'invite_only' ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Invite only
            </Badge>
          ) : (
            <Badge variant="secondary">Open to all panas</Badge>
          )}
          {group.systemProvisioned && <Badge variant="outline">Pana MIA</Badge>}
        </div>
        {group.about && <p className="pt-2">{group.about}</p>}
      </header>

      {!group.isMember && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              You&rsquo;re not in this group yet.{' '}
              <Link href="/r/groups/browse" className="underline">
                Join it from the browse page
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}

      {group.isMember && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Members</h2>
          <ul className="divide-y rounded-lg border">
            {members.map((member) => (
              <li
                key={member.pubkey}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span className={member.isSelf ? 'font-medium' : undefined}>
                  {memberLabel(member)}
                  {member.isSelf && (
                    <span className="text-muted-foreground"> (you)</span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  joined {new Date(member.joinedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canInvite && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Invite a pana</h2>
          <div className="flex gap-2">
            <Input
              value={inviteName}
              placeholder="screenname"
              aria-label="Screenname to invite"
              onChange={(e) => setInviteName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') invite();
              }}
            />
            <Button onClick={invite} disabled={!inviteName.trim() || inviting}>
              <UserPlus className="mr-2 h-4 w-4" />
              {inviting ? 'Sending…' : 'Invite'}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            They&rsquo;ll get it in their Pana inbox. If they haven&rsquo;t set
            up a key yet, the invitation waits until they do.
          </p>
        </section>
      )}

      {group.canManage && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Group details</h2>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={editName}
              maxLength={80}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-about">Description</Label>
            <Textarea
              id="edit-about"
              value={editAbout}
              maxLength={500}
              rows={3}
              onChange={(e) => setEditAbout(e.target.value)}
            />
          </div>
          <Button onClick={save} disabled={!editName.trim() || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </section>
      )}

      {group.isMember && !group.systemProvisioned && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Leave</h2>
          <p className="text-muted-foreground text-sm">
            Leaving takes about a day to take effect — rejoining before then
            cancels it. If you&rsquo;re the last member, the group is deleted
            when it does.
          </p>
          <Button variant="outline" onClick={() => setConfirmLeave(true)}>
            Leave this group
          </Button>
        </section>
      )}

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {group.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {group.memberCount === 1
                ? 'You are the only member, so the group will be deleted once this takes effect in about a day. Messages already published to Nostr are not retracted by this.'
                : 'You will stop receiving this group about a day from now. Rejoining before then cancels it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={leave} disabled={leaving}>
              {leaving ? 'Leaving…' : 'Leave group'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
