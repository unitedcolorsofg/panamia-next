'use client';

/**
 * useDmSocket — live DM delivery.
 *
 * Opens one socket to `/ws/dm` and turns each notification into a react-query
 * invalidation. The socket carries no message content, so this hook never
 * writes to the cache: it only says "this is stale", and the ordinary
 * authenticated queries fetch the actual message.
 *
 * That is the whole design. Postgres stays the single source of truth, every
 * read guard (expiry, blocks, hidden actors, the request gate) keeps applying
 * because nothing bypasses the read path, and a dropped socket degrades to the
 * polling the queries already do rather than to a missing message.
 *
 * ## What this replaces
 *
 * `useConversation`'s 15-second `refetchInterval`. That stays as the fallback —
 * removing it would make a failed socket silently fatal — but with the socket
 * open the visible latency is the round trip, not up to fifteen seconds.
 *
 * ## Explicitly not here
 *
 * Presence, typing indicators, read receipts. The socket could carry them and
 * the cost would be real: a typing indicator is a message per keystroke per
 * recipient, and presence means publishing when a member is at their desk. A
 * two-person DM thread does not need either. Group and event rooms may earn
 * them later.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socialQueryKey } from '@/lib/query/social';

/** What the mailbox broadcasts. Mirrors DmNotification in worker/dm-stream.ts. */
interface DmSocketMessage {
  type: 'dm' | 'ready' | 'error';
  conversationActorId?: string | null;
  statusId?: string;
  at?: number;
  message?: string;
}

/**
 * Reconnect backoff. Starts fast because the common disconnect is a laptop lid
 * or a tunnel, where the network is back almost immediately, and caps at half a
 * minute so a member who left a tab open overnight against a down deployment
 * does not reconnect thousands of times.
 */
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * Application-level keepalive, answered by the Durable Object's auto-response
 * without waking it — so this costs no DO billing. It exists because browser
 * JS cannot send a protocol ping frame, and an idle WebSocket through an
 * intermediary proxy is commonly dropped at around 60 seconds.
 */
const HEARTBEAT_MS = 45_000;

export function useDmSocket(enabled: boolean) {
  const queryClient = useQueryClient();

  // Held in refs rather than state: every one of these changes as part of
  // connection bookkeeping, and re-rendering the subscriber because a timer
  // fired would be noise. Nothing here is rendered.
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);
  const closedByUsRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    closedByUsRef.current = false;

    const clearTimers = () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const connect = () => {
      if (closedByUsRef.current) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // No actor id in the URL, by design: the Worker derives the mailbox from
      // the session. There is nothing here to tamper with. See worker/index.ts.
      const socket = new WebSocket(
        `${protocol}//${window.location.host}/ws/dm`
      );
      socketRef.current = socket;

      socket.onopen = () => {
        attemptsRef.current = 0;
        heartbeatRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('ping');
        }, HEARTBEAT_MS);
      };

      socket.onmessage = (event) => {
        // 'pong' is the auto-response to our heartbeat and is not JSON.
        if (event.data === 'pong') return;

        let payload: DmSocketMessage;
        try {
          payload = JSON.parse(event.data as string) as DmSocketMessage;
        } catch {
          return;
        }

        if (payload.type !== 'dm') return;

        // The list always changes: a new message moves a conversation to the
        // top and rewrites its snippet, whoever it was with.
        queryClient.invalidateQueries({
          queryKey: [socialQueryKey, 'messages', 'conversations'],
        });

        // Requests can change too. A first message from a stranger is held,
        // which creates a request rather than a conversation — so the folder
        // that would otherwise need a reload is what fills in.
        queryClient.invalidateQueries({
          queryKey: [socialQueryKey, 'dm-requests'],
        });

        // The thread itself, when the notification names one. A multi-recipient
        // DM names none — it has no 1:1 thread — and the list refresh above is
        // the whole of its effect.
        if (payload.conversationActorId) {
          queryClient.invalidateQueries({
            queryKey: [
              socialQueryKey,
              'messages',
              'conversation',
              payload.conversationActorId,
            ],
          });
        }
      };

      socket.onclose = () => {
        clearTimers();
        socketRef.current = null;
        if (closedByUsRef.current) return;

        // Refetch on reconnect rather than replaying: the DO holds no history
        // to replay from, and Postgres already knows everything missed while
        // the socket was down. This is why losing the socket costs nothing.
        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** attemptsRef.current,
          RECONNECT_MAX_MS
        );
        attemptsRef.current += 1;
        reconnectRef.current = setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: [socialQueryKey, 'messages'],
          });
          connect();
        }, delay);
      };

      socket.onerror = () => {
        // Deliberately quiet. onclose follows an error and owns the retry, so
        // handling it here would double the backoff schedule. A failing socket
        // is not a user-visible fault — the queries keep polling — so there is
        // nothing to surface either.
        socket.close();
      };
    };

    connect();

    return () => {
      closedByUsRef.current = true;
      clearTimers();
      socketRef.current?.close(1000, 'unmounted');
      socketRef.current = null;
    };
  }, [enabled, queryClient]);
}
