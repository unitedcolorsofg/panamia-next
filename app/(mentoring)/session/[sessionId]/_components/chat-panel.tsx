'use client';

import { useEffect, useState, useRef } from 'react';
import { pusherClient } from '@/lib/pusher-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatPanelProps {
  sessionId: string;
  userEmail: string;
}

export function ChatPanel({ sessionId, userEmail }: ChatPanelProps) {
  const [messages, setMessages] = useState<
    Array<{ from: string; text: string; timestamp: number }>
  >([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = pusherClient.subscribe(`presence-session-${sessionId}`);

    channel.bind('client-chat-message', (data: any) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      pusherClient.unsubscribe(`presence-session-${sessionId}`);
    };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;

    const channel = pusherClient.channel(`presence-session-${sessionId}`);
    channel?.trigger('client-chat-message', {
      from: userEmail,
      text: input,
      timestamp: Date.now(),
    });

    setInput('');
  };

  return (
    <div className="bg-white rounded-lg border h-64 flex flex-col">
      <div className="p-4 border-b font-semibold">Chat</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`text-sm ${msg.from === userEmail ? 'text-right' : 'text-left'}`}
          >
            <span className="font-semibold text-xs text-gray-500">
              {msg.from}
            </span>
            <div
              className={`inline-block px-3 py-1 rounded-lg ${
                msg.from === userEmail
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t flex space-x-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <Button onClick={sendMessage}>Send</Button>
      </div>
    </div>
  );
}
