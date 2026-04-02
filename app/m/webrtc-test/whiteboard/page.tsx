import { WhiteboardCanvas } from './_components/whiteboard-canvas';

export default function WhiteboardPage() {
  return (
    <>
      {/* Hide parent layout chrome in popup */}
      <style>{`
        nav.border-b { display: none !important; }
        main.container { padding: 0 !important; max-width: none !important; }
      `}</style>
      <WhiteboardCanvas />
    </>
  );
}
