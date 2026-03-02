'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatPanelProps {
  sessionId: string;
  userEmail: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ChatPanel(_props: ChatPanelProps) {
  const [input, setInput] = useState('');

  return (
    <div className="bg-card flex h-64 flex-col rounded-lg border">
      <div className="border-b p-4 font-semibold">Chat</div>
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Real-time chat coming soon
      </div>
      <div className="flex space-x-2 border-t p-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled
        />
        <Button disabled>Send</Button>
      </div>
    </div>
  );
}
