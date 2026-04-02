import { VideoCall } from './_components/video-call';

export default function WebRtcTestPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">WebRTC Video Test</h1>
        <p className="text-muted-foreground mt-2">
          Proof-of-concept: Durable Object signaling for peer-to-peer video (2–3
          participants).
        </p>
      </div>
      <VideoCall />
    </div>
  );
}
