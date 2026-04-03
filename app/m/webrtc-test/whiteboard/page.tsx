import { WhiteboardCanvas } from './_components/whiteboard-canvas';

export default function WhiteboardPage() {
  return (
    <>
      {/* Hide parent layout chrome (MainHeader + /m nav) */}
      <style>{`
        header { display: none !important; }
        nav.border-b { display: none !important; }
        main.container { padding: 0 !important; max-width: none !important; }
        #layout-main { padding: 0 !important; }
      `}</style>
      <WhiteboardCanvas />
    </>
  );
}
