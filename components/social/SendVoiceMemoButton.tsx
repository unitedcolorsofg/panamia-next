'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { VoiceMemoComposer } from './VoiceMemoComposer';
import { Mic } from 'lucide-react';

interface Recipient {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  uri: string;
}

interface SendVoiceMemoButtonProps {
  recipient: Recipient;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
}

export function SendVoiceMemoButton({
  recipient,
  size = 'sm',
  variant = 'outline',
}: SendVoiceMemoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Mic className="mr-1 h-4 w-4" />
          Voice Memo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Send Voice Memo to @{recipient.username}
          </DialogTitle>
        </DialogHeader>
        <VoiceMemoComposer
          initialRecipient={recipient}
          onSuccess={() => setOpen(false)}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
