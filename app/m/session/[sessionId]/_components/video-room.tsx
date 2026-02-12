'use client';

import { useEffect, useRef, useState } from 'react';
import { pusherClient } from '@/lib/pusher-client';
import { Button } from '@/components/ui/button';
import { ChatPanel } from './chat-panel';
import { NotesPanel } from './notes-panel';

interface VideoRoomProps {
  sessionId: string;
  userEmail: string;
  role: 'mentor' | 'mentee';
  initialNotes: string;
}

export function VideoRoom({
  sessionId,
  userEmail,
  role,
  initialNotes,
}: VideoRoomProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<any>(null);

  // Initialize WebRTC based on Stack Five pattern
  useEffect(() => {
    const initWebRTC = async () => {
      try {
        // Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create RTCPeerConnection
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        // Handle remote stream
        peerConnection.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Subscribe to Pusher channel for signaling
        const channel = pusherClient.subscribe(`private-session-${sessionId}`);
        channelRef.current = channel;

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            channel.trigger('client-ice-candidate', {
              candidate: event.candidate,
              from: userEmail,
            });
          }
        };

        // Listen for remote ICE candidates
        channel.bind('client-ice-candidate', async (data: any) => {
          if (data.from !== userEmail && data.candidate) {
            await peerConnection.addIceCandidate(
              new RTCIceCandidate(data.candidate)
            );
          }
        });

        // Mentor creates offer
        if (role === 'mentor') {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          channel.trigger('client-offer', {
            offer: peerConnection.localDescription,
            from: userEmail,
          });
        }

        // Mentee listens for offer and creates answer
        channel.bind('client-offer', async (data: any) => {
          if (data.from !== userEmail) {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(data.offer)
            );
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            channel.trigger('client-answer', {
              answer: peerConnection.localDescription,
              from: userEmail,
            });
          }
        });

        // Mentor receives answer
        channel.bind('client-answer', async (data: any) => {
          if (data.from !== userEmail) {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
            setIsConnected(true);
          }
        });

        setPc(peerConnection);
      } catch (error) {
        console.error('Error initializing WebRTC:', error);
      }
    };

    initWebRTC();

    // Cleanup
    return () => {
      if (channelRef.current) {
        pusherClient.unsubscribe(`private-session-${sessionId}`);
      }
      if (pc) {
        pc.close();
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [sessionId, userEmail, role, pc, localStream]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    if (pc) {
      pc.close();
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    window.location.href = '/m/schedule';
  };

  return (
    <div className="grid h-full grid-cols-3 gap-4">
      {/* Video Section */}
      <div className="relative col-span-2 rounded-lg bg-black">
        {/* Remote video (large) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full rounded-lg object-cover"
        />

        {/* Local video (small, corner overlay) */}
        <div className="absolute right-4 bottom-4 h-36 w-48 overflow-hidden rounded-lg border-2 border-white bg-gray-900">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 space-x-4">
          <Button
            onClick={toggleMute}
            variant={isMuted ? 'destructive' : 'default'}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>
          <Button
            onClick={toggleVideo}
            variant={isVideoOff ? 'destructive' : 'default'}
          >
            {isVideoOff ? 'Turn On Video' : 'Turn Off Video'}
          </Button>
          <Button onClick={endCall} variant="destructive">
            End Call
          </Button>
        </div>

        {!isConnected && (
          <div className="absolute top-4 left-4 rounded-lg bg-yellow-500 px-4 py-2 text-white">
            Connecting...
          </div>
        )}
      </div>

      {/* Sidebar (Chat + Notes) */}
      <div className="flex flex-col space-y-4">
        <ChatPanel sessionId={sessionId} userEmail={userEmail} />
        <NotesPanel sessionId={sessionId} initialNotes={initialNotes} />
      </div>
    </div>
  );
}
