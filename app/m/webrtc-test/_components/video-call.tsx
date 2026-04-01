'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  userId: string;
  userName: string;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

const ROOM_ID = 'pana-test-room';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function VideoCall({ userId, userName }: Props) {
  const [state, setState] = useState<ConnectionState>('idle');
  const [error, setError] = useState('');
  const [peers, setPeers] = useState<string[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteContainerRef = useRef<HTMLDivElement>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );

  const cleanup = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    for (const [, pc] of peerConnectionsRef.current) {
      pc.close();
    }
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteContainerRef.current) {
      remoteContainerRef.current.innerHTML = '';
    }
    remoteVideosRef.current.clear();
    setPeers([]);
    setState('idle');
  }, []);

  useEffect(() => cleanup, [cleanup]);

  function getOrCreateRemoteVideo(peerId: string): HTMLVideoElement {
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
      label.textContent = `Peer: ${peerId.slice(0, 8)}…`;
      wrapper.appendChild(video);
      wrapper.appendChild(label);
      remoteContainerRef.current.appendChild(wrapper);
      remoteVideosRef.current.set(peerId, video);
    }
    return video!;
  }

  function createPeerConnection(peerId: string): RTCPeerConnection {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(peerId, pc);

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }
    }

    pc.ontrack = (event) => {
      const video = getOrCreateRemoteVideo(peerId);
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

  function handleSignalingMessage(data: Record<string, unknown>) {
    switch (data.type) {
      case 'peer-joined': {
        const joinedUserId = data.userId as string;
        const peerList = data.peers as string[];
        setPeers(peerList.filter((p) => p !== userId));
        if (joinedUserId === userId) {
          for (const peerId of peerList) {
            initiateOffer(peerId);
          }
        }
        break;
      }

      case 'peer-left': {
        const leftUserId = data.userId as string;
        setPeers((prev) => prev.filter((p) => p !== leftUserId));
        const pc = peerConnectionsRef.current.get(leftUserId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(leftUserId);
        }
        pendingCandidatesRef.current.delete(leftUserId);
        document.getElementById(`remote-${leftUserId}`)?.remove();
        remoteVideosRef.current.delete(leftUserId);
        if (peerConnectionsRef.current.size === 0) {
          setState('connecting');
        }
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

      case 'error':
        setError(data.message as string);
        break;
    }
  }

  async function initiateOffer(peerId: string) {
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsRef.current?.send(
      JSON.stringify({ type: 'offer', sdp: offer.sdp, target: peerId })
    );
  }

  async function handleOffer(from: string, sdp: string) {
    const pc = createPeerConnection(from);
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

  async function joinRoom() {
    setError('');
    setState('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/signaling/${ROOM_ID}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', userId }));
      };

      ws.onmessage = (event) => {
        try {
          handleSignalingMessage(JSON.parse(event.data));
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (state !== 'idle') {
          setState('idle');
          setError('Connection closed');
        }
      };

      ws.onerror = () => {
        setState('error');
        setError('WebSocket connection failed');
      };
    } catch (err) {
      setState('error');
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to access camera/microphone'
      );
    }
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
                    : 'default'
              }
            >
              {state === 'idle'
                ? 'not joined'
                : state === 'connecting'
                  ? 'waiting for peer…'
                  : state === 'connected'
                    ? 'connected'
                    : 'error'}
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
          {/* How to test */}
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
                Everyone on this page shares the same room (max 3). Video flows
                peer-to-peer; the server only relays signaling.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {state === 'idle' ? (
              <Button onClick={joinRoom}>Join Room</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={toggleAudio}>
                  {audioEnabled ? 'Mute' : 'Unmute'}
                </Button>
                <Button variant="outline" size="sm" onClick={toggleVideo}>
                  {videoEnabled ? 'Cam Off' : 'Cam On'}
                </Button>
                <Button variant="destructive" size="sm" onClick={cleanup}>
                  Leave
                </Button>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {/* Video grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
