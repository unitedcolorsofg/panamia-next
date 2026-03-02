'use client';

import { useRef, useState } from 'react';
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
  initialNotes,
}: VideoRoomProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const startLocalVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

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
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    window.location.href = '/m/schedule';
  };

  return (
    <div className="grid h-full grid-cols-3 gap-4">
      {/* Video Section */}
      <div className="relative col-span-2 rounded-lg bg-black">
        {/* Remote video placeholder */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full rounded-lg object-cover"
        />

        {/* Local video */}
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
          {!localStream && (
            <Button onClick={startLocalVideo} variant="default">
              Join Call
            </Button>
          )}
          {localStream && (
            <>
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
            </>
          )}
          <Button onClick={endCall} variant="destructive">
            End Call
          </Button>
        </div>

        <div className="absolute top-4 left-4 rounded-lg bg-yellow-500 px-4 py-2 text-white">
          Peer connection coming soon
        </div>
      </div>

      {/* Sidebar (Chat + Notes) */}
      <div className="flex flex-col space-y-4">
        <ChatPanel sessionId={sessionId} userEmail={userEmail} />
        <NotesPanel sessionId={sessionId} initialNotes={initialNotes} />
      </div>
    </div>
  );
}
