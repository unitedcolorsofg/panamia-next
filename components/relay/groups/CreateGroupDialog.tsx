'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import type { JoinPolicy } from './types';

const NAME_MAX = 80;
const ABOUT_MAX = 500;

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void | Promise<void>;
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateGroupDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>('invite_only');
  const [busy, setBusy] = useState(false);

  // Reset on open so a cancelled attempt doesn't leak into the next one.
  useEffect(() => {
    if (open) {
      setName('');
      setAbout('');
      setJoinPolicy('invite_only');
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const res = await axios.post<{ groupId: string }>('/api/relay/groups', {
        name: name.trim(),
        about: about.trim() || undefined,
        joinPolicy,
      });
      toast({
        title: 'Group created',
        description: 'You are its first member.',
      });
      await onCreated();
      onOpenChange(false);
      router.push(`/r/groups/${res.data.groupId}`);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : 'Refresh and try again.';
      toast({
        title: 'Could not create the group',
        description: message,
        variant: 'destructive',
      });
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Group chat happens in your Nostr app. This sets up who can be in it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              maxLength={NAME_MAX}
              placeholder="Little Haiti Mutual Aid"
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              The name can be changed later. The group&rsquo;s id is built from
              it now and stays fixed, because every message in the group is
              tagged with it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-about">What&rsquo;s it for? (optional)</Label>
            <Textarea
              id="group-about"
              value={about}
              maxLength={ABOUT_MAX}
              rows={3}
              onChange={(e) => setAbout(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Who can join?</Label>
            <RadioGroup
              value={joinPolicy}
              onValueChange={(v) => setJoinPolicy(v as JoinPolicy)}
              className="space-y-2"
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem
                  value="invite_only"
                  id="policy-invite"
                  className="mt-1"
                />
                <Label
                  htmlFor="policy-invite"
                  className="leading-relaxed font-normal"
                >
                  <span className="font-medium">Invite only</span>
                  <br />
                  <span className="text-muted-foreground text-sm">
                    Only people you invite can join. The group is not listed
                    anywhere and Nostr clients won&rsquo;t show it in public
                    directories.
                  </span>
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <RadioGroupItem
                  value="open"
                  id="policy-open"
                  className="mt-1"
                />
                <Label
                  htmlFor="policy-open"
                  className="leading-relaxed font-normal"
                >
                  <span className="font-medium">Open to all panas</span>
                  <br />
                  <span className="text-muted-foreground text-sm">
                    Any enrolled member can find and join it. The name and
                    description become public on the relay.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            Group chat is read-gated at the relay, not end-to-end encrypted.
            When the last member leaves, the group is deleted.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || busy}>
            {busy ? 'Creating…' : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
