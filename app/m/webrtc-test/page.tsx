import dynamic from 'next/dynamic';

const VideoCall = dynamic(
  () => import('./_components/video-call').then((m) => m.VideoCall),
  {
    ssr: false,
    loading: () => (
      <p className="text-muted-foreground py-12 text-center">
        Loading video...
      </p>
    ),
  }
);

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

      <div className="bg-muted/50 mx-auto max-w-2xl rounded-lg border p-4 text-sm">
        <p className="font-semibold">Before you join</p>
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
          <li>
            This is a peer-to-peer connection. Your IP address will be visible
            to other participants.
          </li>
          <li>
            Do not share personal information you would not share with someone
            you encountered in a public space — including your physical address,
            banking details, or other sensitive data.
          </li>
          <li>
            It&apos;s <em>possible</em> participants may use AI-based filters or
            personas. You may not be communicating with someone as they appear.
          </li>
        </ul>
      </div>
      <VideoCall />
    </div>
  );
}
