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
import { useSession } from '@/lib/auth-client';
import { WhiteboardCanvas } from '../whiteboard/_components/whiteboard-canvas';

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

function generateGuestId() {
  return `guest-${Math.random().toString(36).slice(2, 8)}`;
}

export function VideoCall() {
  const { data: session, status } = useSession();
  const [guestId] = useState(generateGuestId);
  const userId = session?.user?.id || guestId;
  const [screenname, setScreenname] = useState('');

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/user/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setScreenname(d.data.screenname || d.data.name || '');
      })
      .catch(() => {});
  }, [status]);

  const userName =
    screenname || (session?.user?.id ? `user-${userId.slice(-6)}` : guestId);
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
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const callStartRef = useRef<number | null>(null);
  const debugEndRef = useRef<HTMLDivElement>(null);

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
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalLeaveRef = useRef(false);
  const hasJoinedRef = useRef(false);
  const wbChannelRef = useRef<BroadcastChannel | null>(null);
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

  // Call timer
  useEffect(() => {
    if (state === 'connected' || state === 'reconnecting') {
      if (!callStartRef.current) callStartRef.current = Date.now();
      const id = setInterval(() => {
        setElapsed(Math.floor((Date.now() - callStartRef.current!) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
    if (state === 'idle') {
      callStartRef.current = null;
      setElapsed(0);
    }
  }, [state]);

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function log(msg: string) {
    const ts = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      fractionalSecondDigits: 3,
    });
    setDebugLog((prev) => [...prev.slice(-200), `[${ts}] ${msg}`]);
    setTimeout(() => {
      const el = debugEndRef.current;
      if (el?.parentElement) {
        el.parentElement.scrollTop = el.parentElement.scrollHeight;
      }
    }, 0);
  }

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
      // Auto-download the file
      const a = document.createElement('a');
      a.href = url;
      a.download = buf.name;
      a.click();
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

  function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setStagedFile(file);
  }

  async function sendStagedFileNow() {
    if (!stagedFile) return;
    const file = stagedFile;
    setStagedFile(null);

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

  function sendStagedFileAfterCall() {
    if (!stagedFile) return;
    setDeferredFiles((prev) => [...prev, stagedFile]);
    setStagedFile(null);
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
    wbChannelRef.current?.close();
    wbChannelRef.current = null;
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

  async function logVideoStats(peerId: string, pc: RTCPeerConnection) {
    try {
      const stats = await pc.getStats();
      const codecs = new Map<
        string,
        { mimeType: string; sdpFmtpLine?: string }
      >();
      stats.forEach((r) => {
        if (r.type === 'codec')
          codecs.set(r.id, {
            mimeType: r.mimeType,
            sdpFmtpLine: r.sdpFmtpLine,
          });
      });
      stats.forEach((r) => {
        if (r.kind !== 'video') return;
        const codec = r.codecId ? codecs.get(r.codecId) : null;
        const codecStr = codec?.mimeType?.replace('video/', '') ?? '?';
        const fmtp = codec?.sdpFmtpLine ?? '';
        const profile = fmtp.match(/profile-level-id=([^;]+)/)?.[1] ?? '';
        const dir =
          r.type === 'inbound-rtp'
            ? 'recv'
            : r.type === 'outbound-rtp'
              ? 'send'
              : null;
        if (!dir) return;
        log(
          `Video ${dir} (${peerId.slice(-6)}): ${codecStr}${profile ? ` profile=${profile}` : ''} ${r.frameWidth ?? '?'}x${r.frameHeight ?? '?'} @${r.framesPerSecond ?? '?'}fps`
        );
      });
    } catch {
      // peer connection may have closed
    }
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
    log(
      `RTCPeerConnection created for ${peerId} (role: ${isOfferer ? 'offerer' : 'answerer'})`
    );

    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      for (const track of tracks) {
        pc.addTrack(track, localStreamRef.current);
      }
      log(
        `Added ${tracks.length} local track(s): ${tracks.map((t) => `${t.kind}[${t.label}]`).join(', ')}`
      );
    } else {
      log('No local media stream — joining without tracks');
    }

    // Prefer VP9 > H.264 > VP8 for better quality at lower bitrates
    const transceivers = pc.getTransceivers();
    for (const t of transceivers) {
      if (t.sender.track?.kind === 'video') {
        const codecs = RTCRtpSender.getCapabilities('video')?.codecs;
        if (codecs) {
          const sorted = [
            ...codecs.filter((c) => c.mimeType === 'video/VP9'),
            ...codecs.filter((c) => c.mimeType === 'video/H264'),
            ...codecs.filter((c) => c.mimeType === 'video/VP8'),
            ...codecs.filter(
              (c) =>
                !['video/VP9', 'video/H264', 'video/VP8'].includes(c.mimeType)
            ),
          ];
          t.setCodecPreferences(sorted);
          log('Video codec preference set: VP9 > H.264 > VP8');
        }
      } else if (t.sender.track?.kind === 'audio') {
        const codecs = RTCRtpSender.getCapabilities('audio')?.codecs;
        if (codecs) {
          // Prefer stereo-capable Opus (channels=2) over mono
          const sorted = [
            ...codecs.filter(
              (c) => c.mimeType === 'audio/opus' && c.channels === 2
            ),
            ...codecs.filter(
              (c) => c.mimeType === 'audio/opus' && c.channels !== 2
            ),
            ...codecs.filter((c) => c.mimeType !== 'audio/opus'),
          ];
          t.setCodecPreferences(sorted);
          log('Audio codec preference set: Opus stereo > mono');
        }
      }
    }

    // Data channel: offerer creates, answerer listens
    if (isOfferer) {
      const dc = pc.createDataChannel('file-transfer', { ordered: true });
      setupDataChannel(peerId, dc);
      log(`DataChannel "file-transfer" created (offerer → ${peerId})`);
    }
    pc.ondatachannel = (event) => {
      log(`DataChannel "${event.channel.label}" received from ${peerId}`);
      setupDataChannel(peerId, event.channel);
    };

    pc.ontrack = (event) => {
      log(`Remote track received: ${event.track.kind} from ${peerId}`);
      const video = getOrCreateRemoteVideo(peerId, peerName);
      if (video.srcObject !== event.streams[0]) {
        video.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const c = event.candidate;
        log(
          `ICE candidate (local → ${peerId}): ${c.type ?? 'unknown'} ${c.protocol ?? ''} ${c.address ?? ''}:${c.port ?? ''}`
        );
        wsRef.current?.send(
          JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate.toJSON(),
            target: peerId,
          })
        );
      } else {
        log(`ICE gathering complete for ${peerId}`);
      }
    };

    pc.onicegatheringstatechange = () => {
      log(`ICE gathering state → ${pc.iceGatheringState} (${peerId})`);
    };

    pc.oniceconnectionstatechange = () => {
      log(`ICE connection state → ${pc.iceConnectionState} (${peerId})`);
    };

    pc.onsignalingstatechange = () => {
      log(`Signaling state → ${pc.signalingState} (${peerId})`);
    };

    pc.onconnectionstatechange = () => {
      log(`Connection state → ${pc.connectionState} (${peerId})`);
      if (pc.connectionState === 'connected') {
        setState('connected');
        reconnectAttemptRef.current = 0;
        // Log video stats once after connection stabilizes
        setTimeout(() => logVideoStats(peerId, pc), 2000);
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
        log(
          `WS ← room-state: ${participants.length} participant(s), ${chatHistory.length} chat msg(s)`
        );
        setPeers(participants.filter((p) => p.userId !== userId));
        setChatMessages(chatHistory);
        for (const peer of participants) {
          if (peer.userId !== userId) {
            log(`Initiating SDP offer → ${peer.userName} (${peer.userId})`);
            initiateOffer(peer.userId, peer.userName);
          }
        }
        break;
      }

      case 'peer-joined': {
        const joinedUserId = data.userId as string;
        const joinedUserName = data.userName as string;
        const peerList = data.peers as PeerInfo[];
        log(
          `WS ← peer-joined: ${joinedUserName} (${joinedUserId}), ${peerList.length} total`
        );
        setPeers(peerList.filter((p) => p.userId !== userId));
        if (joinedUserId !== userId) {
          getOrCreateRemoteVideo(joinedUserId, joinedUserName);
        }
        break;
      }

      case 'peer-left': {
        const leftUserId = data.userId as string;
        log(`WS ← peer-left: ${leftUserId}`);
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
        log(`WS ← SDP offer from ${data.from}`);
        handleOffer(data.from as string, data.sdp as string);
        break;

      case 'answer':
        log(`WS ← SDP answer from ${data.from}`);
        handleAnswer(data.from as string, data.sdp as string);
        break;

      case 'ice-candidate': {
        const c = data.candidate as RTCIceCandidateInit;
        log(
          `WS ← ICE candidate from ${data.from}: ${c.candidate?.split(' ').slice(0, 5).join(' ')}…`
        );
        handleIceCandidate(data.from as string, c);
        break;
      }

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

      case 'wb-sync':
        // Relay incoming Yjs update to whiteboard via BroadcastChannel
        wbChannelRef.current?.postMessage({
          type: 'wb-remote-update',
          update: data.update,
        });
        break;

      case 'do-debug':
        log(data.message as string);
        break;

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
    log(`handleOffer from ${from} — SDP ${sdp.length} bytes`);
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
    log(`setRemoteDescription(offer) OK for ${from}`);
    await flushPendingCandidates(from, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    log(`SDP answer created (${answer.sdp?.length} bytes) → ${from}`);
    wsRef.current?.send(
      JSON.stringify({ type: 'answer', sdp: answer.sdp, target: from })
    );
  }

  async function handleAnswer(from: string, sdp: string) {
    log(`handleAnswer from ${from} — SDP ${sdp.length} bytes`);
    const pc = peerConnectionsRef.current.get(from);
    if (pc) {
      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp })
      );
      log(`setRemoteDescription(answer) OK for ${from}`);
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
      log(`ICE candidate added for ${from}`);
    } else {
      const pending = pendingCandidatesRef.current.get(from) ?? [];
      pending.push(candidate);
      pendingCandidatesRef.current.set(from, pending);
      log(
        `ICE candidate queued for ${from} (no remote description yet, ${pending.length} pending)`
      );
    }
  }

  // --- WebSocket connection ---

  function connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/signaling/${ROOM_ID}`;
    log(`WebSocket connecting → ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      log(
        `WebSocket open — sending join(userId=${userId}, userName=${userName})`
      );
      ws.send(JSON.stringify({ type: 'join', userId, userName }));
      hasJoinedRef.current = true;

      // BroadcastChannel for whiteboard ↔ video call Yjs relay
      wbChannelRef.current?.close();
      const bc = new BroadcastChannel(`pana-wb-${ROOM_ID}`);
      bc.onmessage = (evt) => {
        if (
          evt.data?.type === 'wb-local-update' &&
          ws.readyState === WebSocket.OPEN
        ) {
          ws.send(JSON.stringify({ type: 'wb-sync', update: evt.data.update }));
        }
      };
      wbChannelRef.current = bc;
    };

    ws.onmessage = (event) => {
      try {
        handleSignalingMessage(JSON.parse(event.data));
      } catch {
        // ignore
      }
    };

    ws.onclose = (event) => {
      log(
        `WebSocket closed (code=${event.code}, reason=${event.reason || 'none'})`
      );
      if (intentionalLeaveRef.current) return;
      if (!hasJoinedRef.current) return;
      cleanupPeerConnections();
      attemptReconnect();
    };

    ws.onerror = () => {
      log('WebSocket error');
      // onclose will fire after this
    };
  }

  function attemptReconnect() {
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      log(`Reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts`);
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
    log(
      `Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})`
    );
    setTimeout(() => {
      if (intentionalLeaveRef.current) return;
      connectWebSocket();
    }, delay);
  }

  async function joinRoom() {
    log('joinRoom() called');
    setState('connecting');
    intentionalLeaveRef.current = false;

    try {
      // Try video + audio first, fall back to audio-only, then no media
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24 },
          },
          audio: { channelCount: { ideal: 2 } },
        });
        log(
          `getUserMedia OK — tracks: ${stream
            .getTracks()
            .map((t) => `${t.kind}[${t.label}]`)
            .join(', ')}`
        );
      } catch (mediaErr) {
        log(
          `getUserMedia(video+audio) failed: ${mediaErr instanceof Error ? mediaErr.message : mediaErr}`
        );
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          log(
            `getUserMedia(audio-only) OK — tracks: ${stream
              .getTracks()
              .map((t) => `${t.kind}[${t.label}]`)
              .join(', ')}`
          );
          toast({
            title: 'No camera detected',
            description: 'Joining with audio only.',
          });
          setVideoEnabled(false);
        } catch (audioErr) {
          log(
            `getUserMedia(audio-only) failed: ${audioErr instanceof Error ? audioErr.message : audioErr}`
          );
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
              className={
                state === 'connecting' || state === 'reconnecting'
                  ? 'animate-pulse'
                  : ''
              }
            >
              {stateLabel[state]}
            </Badge>
            {elapsed > 0 && (
              <span className="text-muted-foreground font-mono text-sm">
                {formatElapsed(elapsed)}
              </span>
            )}
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

          {state === 'idle' && (
            <div className="flex gap-2">
              <Button onClick={joinRoom} disabled={status === 'loading'}>
                {status === 'loading' ? 'Loading…' : 'Join Room'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast({
                    title: 'Link copied',
                    description: 'Share this URL with your test partner.',
                  });
                }}
              >
                Copy Link
              </Button>
            </div>
          )}
          {state === 'draining' && (
            <p className="text-sm text-yellow-600">
              Sending deferred files… please wait.
            </p>
          )}

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

      {/* Videos — full width */}
      {state !== 'idle' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="group relative">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full rounded-lg bg-black object-cover"
            />
            <p className="text-muted-foreground mt-1 text-sm">
              You ({userName})
            </p>
            {state !== 'idle' && state !== 'draining' && (
              <div className="absolute inset-x-0 bottom-8 flex justify-center gap-1.5 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 bg-black/60 text-xs text-white backdrop-blur hover:bg-black/80"
                  onClick={toggleAudio}
                >
                  {audioEnabled ? 'Mute' : 'Unmute'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 bg-black/60 text-xs text-white backdrop-blur hover:bg-black/80"
                  onClick={toggleVideo}
                >
                  {videoEnabled ? 'Cam Off' : 'Cam On'}
                </Button>
                <Button
                  size="sm"
                  className="h-7 bg-red-600/80 text-xs text-white backdrop-blur hover:bg-red-700"
                  onClick={deferredFiles.length > 0 ? endCallAndDrain : cleanup}
                >
                  {deferredFiles.length > 0 ? 'End & Send Files' : 'Leave'}
                </Button>
              </div>
            )}
          </div>
          <div ref={remoteContainerRef} className="contents" />
          {peers.length === 0 && (
            <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground animate-pulse text-sm">
                Waiting for peer…
              </p>
            </div>
          )}
        </div>
      )}

      {/* Chat + files — below videos */}
      {state !== 'idle' && (
        <div className="grid gap-4 md:grid-cols-2">
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
                      {f.done ? (
                        <span className="ml-2 shrink-0 text-green-600">
                          Saved
                        </span>
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
                <div className="flex gap-1">
                  <Button
                    variant={stagedFile ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => attachFileInputRef.current?.click()}
                  >
                    {stagedFile ? 'File Attached!' : 'Attach File'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    onClick={sendStagedFileNow}
                    disabled={!stagedFile || dataChannelsRef.current.size === 0}
                  >
                    Send Now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    onClick={sendStagedFileAfterCall}
                    disabled={!stagedFile}
                  >
                    Send After Call
                  </Button>
                  <input
                    ref={attachFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleAttachFile}
                  />
                </div>
                {stagedFile && (
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {stagedFile.name} ({formatSize(stagedFile.size)})
                  </p>
                )}
              </div>
              <div className="mt-2 border-t pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={() => {
                    // On mobile, show inline whiteboard; on desktop, open popup
                    const isMobile = window.innerWidth < 768;
                    if (isMobile) {
                      setShowWhiteboard((prev) => !prev);
                    } else {
                      const room = encodeURIComponent(ROOM_ID);
                      window.open(
                        `/m/webrtc-test/whiteboard?room=${room}`,
                        'pana-whiteboard',
                        'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no'
                      );
                    }
                  }}
                >
                  {showWhiteboard ? 'Hide whiteboard' : 'Start a whiteboard!'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Inline whiteboard (mobile) */}
      {showWhiteboard && (
        <WhiteboardCanvas
          inline
          room={ROOM_ID}
          onClose={() => setShowWhiteboard(false)}
        />
      )}

      {/* Debug log — collapsed by default */}
      {debugLog.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border px-4 py-3">
            <span className="font-mono text-sm font-medium">
              WebRTC Session Log
            </span>
            <Badge variant="outline" className="font-mono text-xs">
              {debugLog.length}
            </Badge>
            <span className="text-muted-foreground ml-auto text-xs">
              click to expand
            </span>
          </summary>
          <Card className="mt-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setDebugLog([])}
                >
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted max-h-64 overflow-y-auto rounded-lg p-3 font-mono text-xs leading-relaxed">
                {debugLog.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.includes('error') || line.includes('failed')
                        ? 'text-red-500'
                        : line.includes('DO:')
                          ? 'text-cyan-600'
                          : line.includes('connected') || line.includes('OK')
                            ? 'text-green-600'
                            : line.includes('ICE candidate')
                              ? 'text-muted-foreground'
                              : ''
                    }
                  >
                    {line}
                  </div>
                ))}
                <div ref={debugEndRef} />
              </div>
            </CardContent>
          </Card>
        </details>
      )}
    </div>
  );
}
