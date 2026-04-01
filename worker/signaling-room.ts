/**
 * Durable Object: WebRTC Signaling Room
 *
 * Coordinates WebRTC peer connections for 2–3 participants via WebSocket.
 * Each room is identified by a unique name (mapped to a DO instance).
 *
 * Protocol (JSON messages over WebSocket):
 *   Client → Server:
 *     { type: "join", userId: string }
 *     { type: "offer", sdp: string, target: string }
 *     { type: "answer", sdp: string, target: string }
 *     { type: "ice-candidate", candidate: RTCIceCandidateInit, target: string }
 *
 *   Server → Client:
 *     { type: "peer-joined", userId: string, peers: string[] }
 *     { type: "peer-left", userId: string }
 *     { type: "offer", sdp: string, from: string }
 *     { type: "answer", sdp: string, from: string }
 *     { type: "ice-candidate", candidate: RTCIceCandidateInit, from: string }
 *     { type: "error", message: string }
 */

const MAX_PARTICIPANTS = 3;

interface Participant {
  userId: string;
  ws: WebSocket;
}

export class SignalingRoom {
  private participants: Map<WebSocket, Participant> = new Map();

  // Durable Object requires a constructor with state + env, even if unused
  constructor(
    private state: DurableObjectState,
    private env: unknown
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    if (this.participants.size >= MAX_PARTICIPANTS) {
      return new Response('Room is full', { status: 403 });
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
      const participant = this.participants.get(ws);
      if (participant) {
        this.participants.delete(ws);
        this.broadcast(ws, { type: 'peer-left', userId: participant.userId });
      }
    });

    ws.addEventListener('error', () => {
      this.participants.delete(ws);
    });
  }

  private handleMessage(
    ws: WebSocket,
    data: {
      type: string;
      userId?: string;
      sdp?: string;
      candidate?: unknown;
      target?: string;
    }
  ) {
    switch (data.type) {
      case 'join': {
        if (!data.userId) {
          this.send(ws, { type: 'error', message: 'userId required' });
          return;
        }
        // Check if userId already taken by another connection
        for (const [, p] of this.participants) {
          if (p.userId === data.userId && p.ws !== ws) {
            this.send(ws, { type: 'error', message: 'userId already in room' });
            return;
          }
        }
        this.participants.set(ws, { userId: data.userId, ws });
        // Tell existing peers about the new participant
        const existingPeers = [...this.participants.values()]
          .filter((p) => p.ws !== ws)
          .map((p) => p.userId);
        this.send(ws, {
          type: 'peer-joined',
          userId: data.userId,
          peers: existingPeers,
        });
        // Notify others
        this.broadcast(ws, {
          type: 'peer-joined',
          userId: data.userId,
          peers: [...this.participants.values()].map((p) => p.userId),
        });
        break;
      }

      case 'offer':
      case 'answer':
      case 'ice-candidate': {
        const sender = this.participants.get(ws);
        if (!sender) {
          this.send(ws, { type: 'error', message: 'Must join first' });
          return;
        }
        if (!data.target) {
          this.send(ws, { type: 'error', message: 'target required' });
          return;
        }
        const target = this.findByUserId(data.target);
        if (!target) return; // target not connected, silently ignore

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

  private findByUserId(userId: string): Participant | undefined {
    for (const [, p] of this.participants) {
      if (p.userId === userId) return p;
    }
  }

  private send(ws: WebSocket, msg: unknown) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Connection already closed
    }
  }

  private broadcast(exclude: WebSocket, msg: unknown) {
    const payload = JSON.stringify(msg);
    for (const [socket] of this.participants) {
      if (socket !== exclude) {
        try {
          socket.send(payload);
        } catch {
          // Connection closed, will be cleaned up on close event
        }
      }
    }
  }
}
