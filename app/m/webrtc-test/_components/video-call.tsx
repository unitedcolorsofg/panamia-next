'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface Props {
  userId: string;
  userName: string;
}

interface ChatMessage {
  from: string;
  fromName: string;
  text: string;
  ts: number;
}

interface PeerInfo {
  userId: string;
  userName: string;
}

interface FileTransferProgress {
  id: string;
  name: string;
  size: number;
  received: number;
  from: string;
  done: boolean;
  url?: string; // blob URL when complete
}

interface SendProgress {
  name: string;
  size: number;
  sent: number;
  peerId: string;
}

type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'draining' // call ended, sending deferred files
  | 'error';

const ROOM_ID = 'pana-test-room';
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;
const CHUNK_SIZE = 16384; // 16 KB per data channel message

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function VideoCall({ userId, userName }: Props) {
  const [state, setState] = useState<ConnectionState>('idle');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [incomingFiles, setIncomingFiles] = useState<FileTransferProgress[]>(
    []
  );
  const [sendingFiles, setSendingFiles] = useState<SendProgress[]>([]);
  const [deferredFiles, setDeferredFiles] = useState<File[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteContainerRef = useRef<HTMLDivElement>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deferredFileInputRef = useRef<HTMLInputElement>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalLeaveRef = useRef(false);
  const hasJoinedRef = useRef(false);
  // In-progress incoming file buffers: transferId → { chunks, meta }
  const incomingBuffersRef = useRef<
    Map<
      string,
      {
        chunks: ArrayBuffer[];
        name: string;
        size: number;
        type: string;
        from: string;
      }
    >
  >(new Map());

  const scrollChat = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(scrollChat, [chatMessages, scrollChat]);

  // --- Data channel handling ---

  function setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer';
    dataChannelsRef.current.set(peerId, dc);

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // JSON control message
        try {
          const msg = JSON.parse(event.data);
          handleFileControlMessage(peerId, msg);
        } catch {
          // ignore
        }
      } else {
        // Binary chunk
        handleFileChunk(peerId, event.data as ArrayBuffer);
      }
    };

    dc.onclose = () => {
      dataChannelsRef.current.delete(peerId);
    };
  }

  function handleFileControlMessage(
    fromPeerId: string,
    msg: {
      type: string;
      transferId?: string;
      name?: string;
      size?: number;
      mimeType?: string;
    }
  ) {
    if (
      msg.type === 'file-meta' &&
      msg.transferId &&
      msg.name &&
      msg.size !== undefined
    ) {
      incomingBuffersRef.current.set(msg.transferId, {
        chunks: [],
        name: msg.name,
        size: msg.size,
        type: msg.mimeType ?? 'application/octet-stream',
        from: fromPeerId,
      });
      setIncomingFiles((prev) => [
        ...prev,
        {
          id: msg.transferId!,
          name: msg.name!,
          size: msg.size!,
          received: 0,
          from: fromPeerId,
          done: false,
        },
      ]);
    } else if (msg.type === 'file-end' && msg.transferId) {
      const buf = incomingBuffersRef.current.get(msg.transferId);
      if (!buf) return;
      const blob = new Blob(buf.chunks, { type: buf.type });
      const url = URL.createObjectURL(blob);
      incomingBuffersRef.current.delete(msg.transferId);
      setIncomingFiles((prev) =>
        prev.map((f) =>
          f.id === msg.transferId
            ? { ...f, done: true, received: f.size, url }
            : f
        )
      );
    }
  }

  function handleFileChunk(fromPeerId: string, chunk: ArrayBuffer) {
    // Find the active transfer from this peer
    for (const [transferId, buf] of incomingBuffersRef.current) {
      if (buf.from === fromPeerId) {
        buf.chunks.push(chunk);
        const received = buf.chunks.reduce((sum, c) => sum + c.byteLength, 0);
        setIncomingFiles((prev) =>
          prev.map((f) => (f.id === transferId ? { ...f, received } : f))
        );
        break;
      }
    }
  }

  async function sendFileToPeer(
    peerId: string,
    file: File,
    transferId: string
  ) {
    const dc = dataChannelsRef.current.get(peerId);
    if (!dc || dc.readyState !== 'open') return;

    // Send metadata
    dc.send(
      JSON.stringify({
        type: 'file-meta',
        transferId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      })
    );

    // Read and send chunks
    const buffer = await file.arrayBuffer();
    let offset = 0;
    while (offset < buffer.byteLength) {
      const end = Math.min(offset + CHUNK_SIZE, buffer.byteLength);
      const chunk = buffer.slice(offset, end);

      // Back-pressure: wait if buffered amount is high
      if (dc.bufferedAmount > CHUNK_SIZE * 16) {
        await new Promise<void>((resolve) => {
          dc.onbufferedamountlow = () => {
            dc.onbufferedamountlow = null;
            resolve();
          };
          dc.bufferedAmountLowThreshold = CHUNK_SIZE * 4;
        });
      }

      dc.send(chunk);
      offset = end;

      setSendingFiles((prev) =>
        prev.map((s) =>
          s.peerId === peerId && s.name === file.name
            ? { ...s, sent: offset }
            : s
        )
      );
    }

    dc.send(JSON.stringify({ type: 'file-end', transferId }));

    // Remove from sending list
    setSendingFiles((prev) =>
      prev.filter((s) => !(s.peerId === peerId && s.name === file.name))
    );
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-selected

    const transferId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Send to all connected peers
    const peerIds = [...dataChannelsRef.current.keys()];
    if (peerIds.length === 0) {
      toast({
        title: 'No peers connected',
        description:
          'Wait for another participant to join before sending files.',
        variant: 'destructive',
      });
      return;
    }

    // Add send progress entries
    setSendingFiles((prev) => [
      ...prev,
      ...peerIds.map((peerId) => ({
        name: file.name,
        size: file.size,
        sent: 0,
        peerId,
      })),
    ]);

    // Send to each peer in parallel
    await Promise.all(
      peerIds.map((peerId) => sendFileToPeer(peerId, file, transferId))
    );
  }

  function handleDeferredFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setDeferredFiles((prev) => [...prev, file]);
  }

  function removeDeferredFile(index: number) {
    setDeferredFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /** End the video call, send deferred files over freed bandwidth, then leave. */
  async function endCallAndDrain() {
    // Stop media tracks to free bandwidth
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    const filesToSend = [...deferredFiles];
    if (filesToSend.length === 0) {
      // No deferred files — just leave immediately
      cleanup();
      return;
    }

    setState('draining');
    setDeferredFiles([]);

    // Send each deferred file sequentially (full bandwidth available)
    for (const file of filesToSend) {
      const transferId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const peerIds = [...dataChannelsRef.current.keys()];
      if (peerIds.length === 0) break;

      setSendingFiles((prev) => [
        ...prev,
        ...peerIds.map((peerId) => ({
          name: file.name,
          size: file.size,
          sent: 0,
          peerId,
        })),
      ]);

      await Promise.all(
        peerIds.map((peerId) => sendFileToPeer(peerId, file, transferId))
      );
    }

    // All deferred files sent — fully leave
    cleanup();
  }

  // --- Peer connection setup ---

  const cleanupPeerConnections = useCallback(() => {
    for (const [, pc] of peerConnectionsRef.current) {
      pc.close();
    }
    peerConnectionsRef.current.clear();
    dataChannelsRef.current.clear();
    pendingCandidatesRef.current.clear();
    if (remoteContainerRef.current) {
      remoteContainerRef.current.innerHTML = '';
    }
    remoteVideosRef.current.clear();
  }, []);

  const cleanup = useCallback(() => {
    intentionalLeaveRef.current = true;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave' }));
    }
    wsRef.current?.close();
    wsRef.current = null;
    cleanupPeerConnections();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    // Revoke any blob URLs
    for (const f of incomingFiles) {
      if (f.url) URL.revokeObjectURL(f.url);
    }
    incomingBuffersRef.current.clear();
    setPeers([]);
    setChatMessages([]);
    setIncomingFiles([]);
    setSendingFiles([]);
    setState('idle');
    hasJoinedRef.current = false;
    reconnectAttemptRef.current = 0;
  }, [cleanupPeerConnections]);

  useEffect(() => cleanup, [cleanup]);

  function getOrCreateRemoteVideo(
    peerId: string,
    peerName?: string
  ): HTMLVideoElement {
    let video = remoteVideosRef.current.get(peerId);
    if (!video && remoteContainerRef.current) {
      video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.className = 'aspect-video w-full rounded-lg bg-black object-cover';
      const wrapper = document.createElement('div');
      wrapper.className = 'space-y-1';
      wrapper.id = `remote-${peerId}`;
      const label = document.createElement('p');
      label.className = 'text-muted-foreground text-sm';
      label.textContent = peerName ?? `Peer: ${peerId.slice(0, 8)}…`;
      wrapper.appendChild(video);
      wrapper.appendChild(label);
      remoteContainerRef.current.appendChild(wrapper);
      remoteVideosRef.current.set(peerId, video);
    }
    return video!;
  }

  function createPeerConnection(
    peerId: string,
    peerName?: string,
    isOfferer?: boolean
  ): RTCPeerConnection {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(peerId, pc);

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }
    }

    // Data channel: offerer creates, answerer listens
    if (isOfferer) {
      const dc = pc.createDataChannel('file-transfer', { ordered: true });
      setupDataChannel(peerId, dc);
    }
    pc.ondatachannel = (event) => {
      setupDataChannel(peerId, event.channel);
    };

    pc.ontrack = (event) => {
      const video = getOrCreateRemoteVideo(peerId, peerName);
      if (video.srcObject !== event.streams[0]) {
        video.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current?.send(
          JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate.toJSON(),
            target: peerId,
          })
        );
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setState('connected');
        reconnectAttemptRef.current = 0;
      }
    };

    return pc;
  }

  async function flushPendingCandidates(peerId: string, pc: RTCPeerConnection) {
    const pending = pendingCandidatesRef.current.get(peerId);
    if (pending) {
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current.delete(peerId);
    }
  }

  // --- Signaling message handling ---

  function handleSignalingMessage(data: Record<string, unknown>) {
    switch (data.type) {
      case 'room-state': {
        const participants = data.participants as PeerInfo[];
        const chatHistory = data.chatHistory as ChatMessage[];
        setPeers(participants.filter((p) => p.userId !== userId));
        setChatMessages(chatHistory);
        for (const peer of participants) {
          if (peer.userId !== userId) {
            initiateOffer(peer.userId, peer.userName);
          }
        }
        break;
      }

      case 'peer-joined': {
        const joinedUserId = data.userId as string;
        const joinedUserName = data.userName as string;
        const peerList = data.peers as PeerInfo[];
        setPeers(peerList.filter((p) => p.userId !== userId));
        if (joinedUserId !== userId) {
          getOrCreateRemoteVideo(joinedUserId, joinedUserName);
        }
        break;
      }

      case 'peer-left': {
        const leftUserId = data.userId as string;
        setPeers((prev) => prev.filter((p) => p.userId !== leftUserId));
        const pc = peerConnectionsRef.current.get(leftUserId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(leftUserId);
        }
        dataChannelsRef.current.delete(leftUserId);
        pendingCandidatesRef.current.delete(leftUserId);
        document.getElementById(`remote-${leftUserId}`)?.remove();
        remoteVideosRef.current.delete(leftUserId);
        break;
      }

      case 'offer':
        handleOffer(data.from as string, data.sdp as string);
        break;

      case 'answer':
        handleAnswer(data.from as string, data.sdp as string);
        break;

      case 'ice-candidate':
        handleIceCandidate(
          data.from as string,
          data.candidate as RTCIceCandidateInit
        );
        break;

      case 'chat': {
        const msg: ChatMessage = {
          from: data.from as string,
          fromName: data.fromName as string,
          text: data.text as string,
          ts: data.ts as number,
        };
        setChatMessages((prev) => [...prev, msg]);
        break;
      }

      case 'error':
        toast({
          title: 'Signaling error',
          description: data.message as string,
          variant: 'destructive',
        });
        break;
    }
  }

  async function initiateOffer(peerId: string, peerName?: string) {
    const old = peerConnectionsRef.current.get(peerId);
    if (old) {
      old.close();
      peerConnectionsRef.current.delete(peerId);
      dataChannelsRef.current.delete(peerId);
    }

    const pc = createPeerConnection(peerId, peerName, true);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsRef.current?.send(
      JSON.stringify({ type: 'offer', sdp: offer.sdp, target: peerId })
    );
  }

  async function handleOffer(from: string, sdp: string) {
    const old = peerConnectionsRef.current.get(from);
    if (old) {
      old.close();
      peerConnectionsRef.current.delete(from);
      dataChannelsRef.current.delete(from);
    }

    const pc = createPeerConnection(from, undefined, false);
    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: 'offer', sdp })
    );
    await flushPendingCandidates(from, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsRef.current?.send(
      JSON.stringify({ type: 'answer', sdp: answer.sdp, target: from })
    );
  }

  async function handleAnswer(from: string, sdp: string) {
    const pc = peerConnectionsRef.current.get(from);
    if (pc) {
      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp })
      );
      await flushPendingCandidates(from, pc);
    }
  }

  async function handleIceCandidate(
    from: string,
    candidate: RTCIceCandidateInit
  ) {
    const pc = peerConnectionsRef.current.get(from);
    if (pc && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      const pending = pendingCandidatesRef.current.get(from) ?? [];
      pending.push(candidate);
      pendingCandidatesRef.current.set(from, pending);
    }
  }

  // --- WebSocket connection ---

  function connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/signaling/${ROOM_ID}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      ws.send(JSON.stringify({ type: 'join', userId, userName }));
      hasJoinedRef.current = true;
    };

    ws.onmessage = (event) => {
      try {
        handleSignalingMessage(JSON.parse(event.data));
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      if (intentionalLeaveRef.current) return;
      if (!hasJoinedRef.current) return;
      cleanupPeerConnections();
      attemptReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }

  function attemptReconnect() {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setState('error');
      toast({
        title: 'Connection lost',
        description: 'Could not reconnect after multiple attempts.',
        variant: 'destructive',
      });
      return;
    }
    setState('reconnecting');
    const delay =
      RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptRef.current);
    reconnectAttemptRef.current++;
    setTimeout(() => {
      if (intentionalLeaveRef.current) return;
      connectWebSocket();
    }, delay);
  }

  async function joinRoom() {
    setState('connecting');
    intentionalLeaveRef.current = false;

    try {
      // Try video + audio first, fall back to audio-only, then no media
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          toast({
            title: 'No camera detected',
            description: 'Joining with audio only.',
          });
          setVideoEnabled(false);
        } catch {
          // No media devices at all — still allow joining for chat/files
          toast({
            title: 'No camera or microphone',
            description:
              'Joining without media. You can still chat and transfer files.',
          });
          setVideoEnabled(false);
          setAudioEnabled(false);
        }
      }
      localStreamRef.current = stream;
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
      }
      connectWebSocket();
    } catch (err) {
      setState('error');
      toast({
        title: 'Failed to join',
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'chat', text }));
    setChatInput('');
  }

  function toggleAudio() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setAudioEnabled(track.enabled);
    }
  }

  function toggleVideo() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideoEnabled(track.enabled);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const stateLabel: Record<ConnectionState, string> = {
    idle: 'not joined',
    connecting: 'connecting…',
    connected: 'connected',
    reconnecting: 'reconnecting…',
    draining: 'sending deferred files…',
    error: 'error',
  };

  return (
    <div className="space-y-6">
      {/* Instructions + room controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Room
            <Badge
              variant={
                state === 'error'
                  ? 'destructive'
                  : state === 'idle'
                    ? 'secondary'
                    : state === 'draining'
                      ? 'outline'
                      : 'default'
              }
            >
              {stateLabel[state]}
            </Badge>
            {peers.length > 0 && (
              <Badge variant="outline">{peers.length} peer(s)</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Logged in as <strong>{userName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'idle' && (
            <div className="bg-muted space-y-2 rounded-lg p-4 text-sm">
              <p className="font-medium">How to test</p>
              <ol className="list-inside list-decimal space-y-1">
                <li>
                  Click <strong>Join Room</strong> below (grants camera &amp;
                  mic access).
                </li>
                <li>
                  Have a second logged-in user open this same page and click{' '}
                  <strong>Join Room</strong>.
                </li>
                <li>Video should connect within a few seconds.</li>
              </ol>
              <p className="text-muted-foreground">
                Everyone on this page shares the same room (max 3). Video and
                files flow peer-to-peer; the server only relays signaling.
                Switching networks (wifi/cellular) reconnects automatically.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {state === 'idle' ? (
              <Button onClick={joinRoom}>Join Room</Button>
            ) : state === 'draining' ? (
              <p className="text-sm text-yellow-600">
                Sending deferred files… please wait.
              </p>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={toggleAudio}>
                  {audioEnabled ? 'Mute' : 'Unmute'}
                </Button>
                <Button variant="outline" size="sm" onClick={toggleVideo}>
                  {videoEnabled ? 'Cam Off' : 'Cam On'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deferredFiles.length > 0 ? endCallAndDrain : cleanup}
                >
                  {deferredFiles.length > 0 ? 'End Call & Send Files' : 'Leave'}
                </Button>
              </>
            )}
          </div>

          {/* Deferred file queue */}
          {deferredFiles.length > 0 && state !== 'draining' && (
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                Queued for after call ({deferredFiles.length}):
              </p>
              {deferredFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="truncate">{f.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    ({formatSize(f.size)})
                  </span>
                  <button
                    onClick={() => removeDeferredFile(i)}
                    className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {state === 'reconnecting' && (
            <p className="text-sm text-yellow-600">
              Connection lost. Reconnecting (attempt{' '}
              {reconnectAttemptRef.current}/{MAX_RECONNECT_ATTEMPTS})…
            </p>
          )}
        </CardContent>
      </Card>

      {/* Video grid + chat/files side-by-side when in call */}
      {state !== 'idle' && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Videos: 2 cols */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            <div className="space-y-1">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full rounded-lg bg-black object-cover"
              />
              <p className="text-muted-foreground text-sm">You ({userName})</p>
            </div>
            <div ref={remoteContainerRef} className="contents" />
          </div>

          {/* Chat + files: 1 col */}
          <div className="flex flex-col gap-4">
            {/* File transfers */}
            {(sendingFiles.length > 0 || incomingFiles.length > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">File Transfers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {sendingFiles.map((s, i) => (
                    <div key={`send-${i}`} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="truncate">{s.name}</span>
                        <span className="text-muted-foreground ml-2 shrink-0">
                          {formatSize(s.sent)}/{formatSize(s.size)}
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 rounded-full">
                        <div
                          className="h-1.5 rounded-full bg-blue-500 transition-all"
                          style={{
                            width: `${s.size > 0 ? (s.sent / s.size) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {incomingFiles.map((f) => (
                    <div key={f.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{f.name}</span>
                        {f.done && f.url ? (
                          <a
                            href={f.url}
                            download={f.name}
                            className="ml-2 shrink-0 text-blue-600 underline"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-muted-foreground ml-2 shrink-0">
                            {formatSize(f.received)}/{formatSize(f.size)}
                          </span>
                        )}
                      </div>
                      {!f.done && (
                        <div className="bg-muted h-1.5 rounded-full">
                          <div
                            className="h-1.5 rounded-full bg-green-500 transition-all"
                            style={{
                              width: `${f.size > 0 ? (f.received / f.size) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Chat */}
            <Card className="flex max-h-96 flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Chat</CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-1 overflow-y-auto text-sm">
                  {chatMessages.length === 0 && (
                    <p className="text-muted-foreground text-xs">
                      No messages yet
                    </p>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i}>
                      <span className="font-medium">
                        {msg.from === userId ? 'You' : msg.fromName}:
                      </span>{' '}
                      {msg.text}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="mt-2 flex gap-1">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                    placeholder="Type a message…"
                    className="h-8 text-sm"
                  />
                  <Button size="sm" className="h-8" onClick={sendChat}>
                    Send
                  </Button>
                </div>
                <div className="mt-2 border-t pt-2">
                  <p className="text-muted-foreground mb-1 text-xs">
                    Files (peer-to-peer)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={dataChannelsRef.current.size === 0}
                    >
                      Send Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={() => deferredFileInputRef.current?.click()}
                    >
                      Send After Call
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <input
                      ref={deferredFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleDeferredFileSelect}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
