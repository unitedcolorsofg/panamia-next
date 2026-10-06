/**
 * Durable Object: WebRTC Signaling Room (SQLite-backed)
 *
 * Coordinates WebRTC peer connections for 2–3 participants via WebSocket.
 * Persists participants and chat history in SQLite so that a user who
 * drops (e.g. wifi → cellular) can reconnect and rejoin seamlessly.
 * All data is deleted once the last participant leaves.
 *
 * Uses the WebSocket Hibernation API: sockets are handed to the runtime with
 * state.acceptWebSocket() rather than ws.accept(), so this object can be
 * evicted between messages and is billed only while it actually runs. That
 * matters because signaling is almost entirely idle — the offer/answer/ICE
 * exchange happens in the first seconds and the media then flows peer-to-peer
 * without passing through here, so an hour-long call previously billed an hour
 * of wall-clock duration for a few seconds of work.
 *
 * The consequence is that no instance field survives between messages. Room
 * membership is reloaded from SQLite by the constructor on every wake, and each
 * socket carries its own identity via serializeAttachment() — see attachmentOf.
 *
 * Protocol (JSON messages over WebSocket):
 *   Client → Server:
 *     { type: "join", userId: string, userName: string }
 *     { type: "offer", sdp: string, target: string }
 *     { type: "answer", sdp: string, target: string }
 *     { type: "ice-candidate", candidate: RTCIceCandidateInit, target: string }
 *     { type: "chat", text: string }
 *     { type: "wb-sync", update: string }  // base64 Yjs update for whiteboard
 *     { type: "leave" }
 *
 *   Server → Client:
 *     { type: "room-state", participants: {userId,userName}[], chatHistory: ChatMsg[] }
 *     { type: "peer-joined", userId: string, userName: string, peers: {userId,userName}[] }
 *     { type: "peer-left", userId: string }
 *     { type: "offer"|"answer"|"ice-candidate", from: string, ... }
 *     { type: "chat", from: string, fromName: string, text: string, ts: number }
 *     { type: "wb-sync", from: string, update: string }  // whiteboard update broadcast
 *     { type: "do-debug", message: string }
 *     { type: "error", message: string }
 */

const MAX_PARTICIPANTS = 3;
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

// ── Future: Session Metrics for /account/admin/mentoring ─────────────
// When video sessions move beyond PoC, copy session metrics into the
// Supabase mentoring tables before deleting SQLite data. The admin
// dashboard should only query Supabase — never SQLite directly.
//
// Suggested approach:
//   1. Add a `video_sessions` table in Supabase (session_id, room_id,
//      started_at, ended_at, participant_count, total_chat_messages,
//      files_transferred, reconnect_count).
//   2. On cleanupIfEmpty() (room teardown), POST a summary to
//      /api/admin/mentoring/video-session BEFORE deleting SQLite rows.
//      The DO has all the data at that point — aggregate and flush.
//   3. Extend DashboardMetrics in account/admin/mentoring/page.tsx with:
//      - videoSessions: { total, avgDuration }
//      - videoReliability: { reconnectRate, avgReconnectsPerSession }
//   4. Extend /api/admin/mentoring/dashboard to query video_sessions
//      from Supabase and return the new fields.
//
// The DO already tracks: participants (join/leave/reconnect), chat
// message count, and file transfers. Call duration can be derived from
// the first join to the last leave timestamp.
// ─────────────────────────────────────────────────────────────────────

/**
 * Room membership, mirrored from the SQLite `participants` table.
 *
 * Deliberately holds no WebSocket reference. Under hibernation this object is
 * evicted and rebuilt freely, so a socket stored here would be a dangling
 * reference on the next wake. The live sockets are whatever
 * state.getWebSockets() returns. Membership outlives connection on purpose: a
 * participant who drops stays in the room until purgeStale() removes them.
 */
interface Participant {
  userId: string;
  userName: string;
}

/** Identity pinned to a socket at join time, readable after a wake. */
interface SocketIdentity {
  userId: string;
  userName: string;
}

export class SignalingRoom {
  private participants: Map<string, Participant> = new Map(); // keyed by userId
  private sql: SqlStorage;
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.sql = state.storage.sql;
    this.initDb();
    this.purgeStale();
    this.restoreParticipants();

    // Answer application-level keepalives in the runtime instead of here. No
    // client sends these today, but a heartbeat is the natural thing to add
    // for mobile, where the WebView is suspended on backgrounding and
    // connections die quietly. Browser JS cannot send a protocol ping frame,
    // so a web or Capacitor keepalive has to be an ordinary message — and as
    // an ordinary message it would wake this object on every beat and undo
    // hibernation entirely. Auto-responses are handled without incurring
    // wall-clock time, so adding one later stays free.
    //
    // A genuinely native client would not need this: protocol-level ping
    // frames (OkHttp's pingInterval, URLSessionWebSocketTask.sendPing) are
    // answered by the runtime, never reach webSocketMessage, and do not
    // interrupt hibernation.
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
  }

  private initDb() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS participants (
        user_id TEXT PRIMARY KEY,
        user_name TEXT NOT NULL,
        joined_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        from_name TEXT NOT NULL,
        text TEXT NOT NULL,
        ts INTEGER NOT NULL
      );
    `);
  }

  /** Purge participants older than STALE_THRESHOLD_MS and clean up if none remain */
  private purgeStale() {
    const cutoff = Date.now() - STALE_THRESHOLD_MS;
    const stale = [
      ...this.sql.exec(
        'SELECT user_id FROM participants WHERE joined_at < ?',
        cutoff
      ),
    ];
    if (stale.length > 0) {
      this.sql.exec('DELETE FROM participants WHERE joined_at < ?', cutoff);
      console.log(
        `[DO] Purged ${stale.length} stale participant(s): ${stale.map((r) => r.user_id).join(', ')}`
      );
      // If no participants remain, clear chat too
      const remaining = [
        ...this.sql.exec('SELECT COUNT(*) as n FROM participants'),
      ];
      if (Number(remaining[0]?.n) === 0) {
        this.sql.exec('DELETE FROM chat');
        console.log('[DO] All participants stale — chat table cleared');
      }
    }
  }

  /**
   * Rebuild the membership cache from SQLite.
   *
   * Under hibernation this runs on every wake rather than once per room, so it
   * deliberately does not log — a line per message burst would be the single
   * noisiest thing in this Worker. SQLite is the source of truth; this is only
   * the in-memory view of it.
   */
  private restoreParticipants() {
    for (const row of this.sql.exec(
      'SELECT user_id, user_name FROM participants'
    )) {
      this.participants.set(row.user_id as string, {
        userId: row.user_id as string,
        userName: row.user_name as string,
      });
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Hand the socket to the runtime rather than calling server.accept().
    // accept() pins this object in memory for the entire call and bills
    // wall-clock duration throughout, nearly all of it idle. acceptWebSocket()
    // lets the runtime evict us between messages and wake us on the next one.
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Hibernation handlers ──────────────────────────────────────────────
  // The runtime calls these in place of the addEventListener closures this
  // class used before. They have to be methods: a closure captured at accept
  // time does not survive the object being evicted.

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text =
      typeof message === 'string' ? message : new TextDecoder().decode(message);
    try {
      this.handleMessage(ws, JSON.parse(text));
    } catch {
      this.send(ws, { type: 'error', message: 'Invalid JSON' });
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.handleDisconnect(ws);

    // compatibility_date is 2026-02-24, which predates
    // web_socket_auto_reply_to_close (2026-04-07), and the flag is not set in
    // compatibility_flags either. So the runtime does not echo the Close frame
    // for us and the server half stays open until we close it here. That is
    // not just untidy: a lingering socket can keep appearing in
    // getWebSockets(), which is now the only thing that knows who is present,
    // so socketFor() could hand back a dead socket and the stillConnected
    // check in handleDisconnect could swallow a real peer-left.
    try {
      // 1005 (no status received) and 1006 (abnormal closure) are receive-only
      // codes; echoing either is rejected, so report a normal closure instead.
      ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
    } catch {
      /* already closed */
    }
  }

  async webSocketError(ws: WebSocket) {
    this.handleDisconnect(ws);
  }

  private handleDisconnect(ws: WebSocket) {
    const who = this.attachmentOf(ws);
    if (!who) return; // never completed a join

    // An explicit `leave` already removed them and announced it, and the socket
    // close that follows lands here straight after. The old code got this for
    // free: removeParticipant() deleted the very map entry the lookup scanned,
    // so the second pass found nothing. Identity now lives on the socket and
    // outlives that deletion, so the guard has to be explicit.
    if (!this.participants.has(who.userId)) return;

    // Likewise a reconnect closes the previous socket for this identity, and
    // that close arrives after the new one has joined. Announcing peer-left
    // here would contradict the peer-joined that just went out. The old code
    // was shielded by reassigning existing.ws before the close fired.
    const stillConnected = this.state
      .getWebSockets()
      .some((s) => s !== ws && this.attachmentOf(s)?.userId === who.userId);
    if (stillConnected) return;

    // Membership deliberately survives the socket: the SQLite row stays so a
    // reconnect re-attaches instead of arriving as a stranger. The disconnect
    // is implicit now — the socket simply stops appearing in getWebSockets() —
    // so there is no ws field left to null out.
    this.debugAll(
      `DO: participant ${who.userId} disconnected (kept in SQLite for reconnect)`
    );
    this.broadcast(ws, { type: 'peer-left', userId: who.userId });
  }

  private handleMessage(
    ws: WebSocket,
    data: {
      type: string;
      userId?: string;
      userName?: string;
      sdp?: string;
      candidate?: unknown;
      target?: string;
      text?: string;
      update?: string; // base64 Yjs update for wb-sync
    }
  ) {
    switch (data.type) {
      case 'join': {
        if (!data.userId || !data.userName) {
          this.send(ws, {
            type: 'error',
            message: 'userId and userName required',
          });
          return;
        }

        const existing = this.participants.get(data.userId);
        if (existing) {
          // Reconnect: drop any socket still lingering under this identity
          // before the new one takes over, so a half-dead connection cannot
          // keep receiving the room's traffic.
          const stale = this.socketFor(data.userId);
          if (stale && stale !== ws) {
            try {
              stale.close();
            } catch {
              /* already closed */
            }
          }
          existing.userName = data.userName;
          // Refresh joined_at so reconnecting users don't get purged
          this.sql.exec(
            'UPDATE participants SET joined_at = ? WHERE user_id = ?',
            Date.now(),
            data.userId
          );
          this.debug(
            ws,
            `DO: reconnect — ${data.userName} (${data.userId}) reattached, joined_at refreshed`
          );
        } else {
          // New participant — whiteboard-only connections (wb-*) don't count toward limit
          const isWhiteboardOnly = data.userId.startsWith('wb-');
          if (!isWhiteboardOnly) {
            const videoParticipants = [...this.participants.keys()].filter(
              (id) => !id.startsWith('wb-')
            ).length;
            if (videoParticipants >= MAX_PARTICIPANTS) {
              this.send(ws, { type: 'error', message: 'Room is full (max 3)' });
              return;
            }
          }
          this.participants.set(data.userId, {
            userId: data.userId,
            userName: data.userName,
          });
          this.sql.exec(
            'INSERT OR REPLACE INTO participants (user_id, user_name, joined_at) VALUES (?, ?, ?)',
            data.userId,
            data.userName,
            Date.now()
          );
          this.debugAll(
            `DO: SQLite INSERT participants — ${data.userName} (${data.userId}), ${this.participants.size} total`
          );
        }

        // Pin identity to the socket itself. This is what lets
        // webSocketMessage and webSocketClose know who is speaking after a
        // wake, when every in-memory reference is gone.
        ws.serializeAttachment({
          userId: data.userId,
          userName: data.userName,
        } satisfies SocketIdentity);

        // Send room state to the joining/reconnecting user
        const chatRows = [
          ...this.sql.exec(
            'SELECT from_id, from_name, text, ts FROM chat ORDER BY id'
          ),
        ];
        const chatHistory = chatRows.map((r) => ({
          from: r.from_id as string,
          fromName: r.from_name as string,
          text: r.text as string,
          ts: r.ts as number,
        }));
        const participantList = [...this.participants.values()].map((p) => ({
          userId: p.userId,
          userName: p.userName,
        }));
        this.debug(
          ws,
          `DO: SQLite SELECT — ${participantList.length} participant(s), ${chatRows.length} chat row(s) sent as room-state`
        );
        this.send(ws, {
          type: 'room-state',
          participants: participantList,
          chatHistory,
        });

        // Notify connected peers
        this.broadcast(ws, {
          type: 'peer-joined',
          userId: data.userId,
          userName: data.userName,
          peers: participantList,
        });
        break;
      }

      case 'chat': {
        const sender = this.attachmentOf(ws);
        if (!sender) {
          this.send(ws, { type: 'error', message: 'Must join first' });
          return;
        }
        if (!data.text?.trim()) return;

        const ts = Date.now();
        this.sql.exec(
          'INSERT INTO chat (from_id, from_name, text, ts) VALUES (?, ?, ?, ?)',
          sender.userId,
          sender.userName,
          data.text.trim(),
          ts
        );
        this.debug(
          ws,
          `DO: SQLite INSERT chat — from ${sender.userName}, ${data.text.trim().length} chars`
        );

        // Broadcast to everyone including sender (confirmation)
        const chatMsg = {
          type: 'chat',
          from: sender.userId,
          fromName: sender.userName,
          text: data.text.trim(),
          ts,
        };
        for (const peer of this.state.getWebSockets()) {
          this.send(peer, chatMsg);
        }
        break;
      }

      case 'leave': {
        const leaver = this.attachmentOf(ws);
        if (leaver) {
          this.debugAll(
            `DO: SQLite DELETE participants — ${leaver.userName} (${leaver.userId}) left`
          );
          this.removeParticipant(leaver.userId);
          this.broadcast(null, { type: 'peer-left', userId: leaver.userId });
          this.cleanupIfEmpty();
        }
        try {
          ws.close();
        } catch {
          /* already closed */
        }
        break;
      }

      case 'wb-sync': {
        // Whiteboard Yjs update — broadcast binary (base64) to all other participants
        const wbSender = this.attachmentOf(ws);
        if (!wbSender) {
          this.send(ws, { type: 'error', message: 'Must join first' });
          return;
        }
        this.broadcast(ws, {
          type: 'wb-sync',
          from: wbSender.userId,
          update: data.update, // base64-encoded Yjs update
        });
        break;
      }

      case 'offer':
      case 'answer':
      case 'ice-candidate': {
        const sender = this.attachmentOf(ws);
        if (!sender) {
          this.send(ws, { type: 'error', message: 'Must join first' });
          return;
        }
        if (!data.target) {
          this.send(ws, { type: 'error', message: 'target required' });
          return;
        }
        const targetWs = this.socketFor(data.target);
        if (!targetWs) return; // not connected

        const forwarded: Record<string, unknown> = {
          type: data.type,
          from: sender.userId,
        };
        if (data.sdp !== undefined) forwarded.sdp = data.sdp;
        if (data.candidate !== undefined) forwarded.candidate = data.candidate;
        this.send(targetWs, forwarded);
        break;
      }

      default:
        this.send(ws, { type: 'error', message: `Unknown type: ${data.type}` });
    }
  }

  /**
   * Identity of a socket, read back from the attachment set at join time.
   *
   * Replaces the old linear scan for `p.ws === ws`. The attachment is stored
   * by the runtime alongside the socket, so it survives hibernation where an
   * in-memory map would not.
   */
  private attachmentOf(ws: WebSocket): SocketIdentity | null {
    try {
      const raw = ws.deserializeAttachment();
      if (raw && typeof raw === 'object' && 'userId' in raw) {
        return raw as SocketIdentity;
      }
    } catch {
      // Nothing attached — the socket has not completed a join.
    }
    return null;
  }

  /** The live socket for a userId, or null when they are not connected. */
  private socketFor(userId: string): WebSocket | null {
    for (const ws of this.state.getWebSockets()) {
      if (this.attachmentOf(ws)?.userId === userId) return ws;
    }
    return null;
  }

  private removeParticipant(userId: string) {
    this.participants.delete(userId);
    this.sql.exec('DELETE FROM participants WHERE user_id = ?', userId);
  }

  /** Delete all data once no participants remain */
  private cleanupIfEmpty() {
    if (this.participants.size === 0) {
      this.sql.exec('DELETE FROM chat');
      this.sql.exec('DELETE FROM participants');
      this.debugAll(
        'DO: SQLite CLEANUP — all participants gone, chat and participants tables cleared'
      );
    }
  }

  /** Send a debug message to a specific client */
  private debug(ws: WebSocket, message: string) {
    this.send(ws, { type: 'do-debug', message });
  }

  /** Send a debug message to all connected clients */
  private debugAll(message: string) {
    for (const ws of this.state.getWebSockets()) {
      this.send(ws, { type: 'do-debug', message });
    }
  }

  private send(ws: WebSocket, msg: unknown) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Connection already closed
    }
  }

  private broadcast(exclude: WebSocket | null, msg: unknown) {
    const payload = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      if (ws === exclude) continue;
      try {
        ws.send(payload);
      } catch {
        // Will be cleaned up on close event
      }
    }
  }
}
