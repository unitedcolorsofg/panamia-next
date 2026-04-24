import dynamic from 'next/dynamic';

const WhiteboardCanvas = dynamic(
  () =>
    import('./_components/whiteboard-canvas').then((m) => m.WhiteboardCanvas),
  {
    ssr: false,
    loading: () => (
      <p className="text-muted-foreground py-12 text-center">
        Loading whiteboard...
      </p>
    ),
  }
);

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
