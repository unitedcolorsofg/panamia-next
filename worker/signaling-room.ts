/**
 * Durable Object: WebRTC Signaling Room (SQLite-backed)
 *
 * Coordinates WebRTC peer connections for 2–3 participants via WebSocket.
 * Persists participants and chat history in SQLite so that a user who
 * drops (e.g. wifi → cellular) can reconnect and rejoin seamlessly.
 * All data is deleted once the last participant leaves.
 *
 * Protocol (JSON messages over WebSocket):
 *   Client → Server:
 *     { type: "join", userId: string, userName: string }
 *     { type: "offer", sdp: string, target: string }
 *     { type: "answer", sdp: string, target: string }
 *     { type: "ice-candidate", candidate: RTCIceCandidateInit, target: string }
 *     { type: "chat", text: string }
 *     { type: "leave" }
 *
 *   Server → Client:
 *     { type: "room-state", participants: {userId,userName}[], chatHistory: ChatMsg[] }
 *     { type: "peer-joined", userId: string, userName: string, peers: {userId,userName}[] }
 *     { type: "peer-left", userId: string }
 *     { type: "offer"|"answer"|"ice-candidate", from: string, ... }
 *     { type: "chat", from: string, fromName: string, text: string, ts: number }
 *     { type: "do-debug", message: string }
 *     { type: "error", message: string }
 */

const MAX_PARTICIPANTS = 3;

interface Participant {
  userId: string;
  userName: string;
  ws: WebSocket | null; // null = disconnected but still in room
}

export class SignalingRoom {
  private participants: Map<string, Participant> = new Map(); // keyed by userId
  private sql: SqlStorage;

  constructor(state: DurableObjectState, _env: unknown) {
    this.sql = state.storage.sql;
    this.initDb();
    this.restoreParticipants();
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

  /** Restore in-memory participant map from SQLite (ws=null until they reconnect) */
  private restoreParticipants() {
    const rows = this.sql.exec('SELECT user_id, user_name FROM participants');
    const restored: string[] = [];
    for (const row of rows) {
      const userId = row.user_id as string;
      this.participants.set(userId, {
        userId,
        userName: row.user_name as string,
        ws: null,
      });
      restored.push(userId);
    }
    if (restored.length > 0) {
      // Can't send debug here (no ws yet), but logged for constructor awareness
      console.log(
        `[DO] Restored ${restored.length} participant(s) from SQLite: ${restored.join(', ')}`
      );
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.handleSession(server);
    server.accept();

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleSession(ws: WebSocket) {
    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data as string);
        this.handleMessage(ws, data);
      } catch {
        this.send(ws, { type: 'error', message: 'Invalid JSON' });
      }
    });

    ws.addEventListener('close', () => {
      this.handleDisconnect(ws);
    });

    ws.addEventListener('error', () => {
      this.handleDisconnect(ws);
    });
  }

  private handleDisconnect(ws: WebSocket) {
    // Find the participant by WebSocket reference
    for (const [userId, p] of this.participants) {
      if (p.ws === ws) {
        // Mark as disconnected but keep in room — they may reconnect
        p.ws = null;
        this.debugAll(
          `DO: participant ${userId} disconnected (kept in SQLite for reconnect)`
        );
        this.broadcast(null, { type: 'peer-left', userId });
        break;
      }
    }
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
          // Reconnect: close old WS if still lingering, attach new one
          if (existing.ws && existing.ws !== ws) {
            try {
              existing.ws.close();
            } catch {
              /* already closed */
            }
          }
          existing.ws = ws;
          existing.userName = data.userName;
          this.debug(
            ws,
            `DO: reconnect — ${data.userName} (${data.userId}) reattached to existing SQLite row`
          );
        } else {
          // New participant
          if (this.participants.size >= MAX_PARTICIPANTS) {
            this.send(ws, { type: 'error', message: 'Room is full (max 3)' });
            return;
          }
          this.participants.set(data.userId, {
            userId: data.userId,
            userName: data.userName,
            ws,
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
        const sender = this.findByWs(ws);
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
        for (const [, p] of this.participants) {
          if (p.ws) this.send(p.ws, chatMsg);
        }
        break;
      }

      case 'leave': {
        const leaver = this.findByWs(ws);
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

      case 'offer':
      case 'answer':
      case 'ice-candidate': {
        const sender = this.findByWs(ws);
        if (!sender) {
          this.send(ws, { type: 'error', message: 'Must join first' });
          return;
        }
        if (!data.target) {
          this.send(ws, { type: 'error', message: 'target required' });
          return;
        }
        const target = this.participants.get(data.target);
        if (!target?.ws) return; // not connected

        const forwarded: Record<string, unknown> = {
          type: data.type,
          from: sender.userId,
        };
        if (data.sdp !== undefined) forwarded.sdp = data.sdp;
        if (data.candidate !== undefined) forwarded.candidate = data.candidate;
        this.send(target.ws, forwarded);
        break;
      }

      default:
        this.send(ws, { type: 'error', message: `Unknown type: ${data.type}` });
    }
  }

  private findByWs(ws: WebSocket): Participant | undefined {
    for (const [, p] of this.participants) {
      if (p.ws === ws) return p;
    }
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
    for (const [, p] of this.participants) {
      if (p.ws) this.send(p.ws, { type: 'do-debug', message });
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
    for (const [, p] of this.participants) {
      if (p.ws && p.ws !== exclude) {
        try {
          p.ws.send(payload);
        } catch {
          // Will be cleaned up on close event
        }
      }
    }
  }
}
