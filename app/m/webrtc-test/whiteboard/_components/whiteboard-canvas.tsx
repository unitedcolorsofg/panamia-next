'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Canvas, PencilBrush, Rect, Circle, Line } from 'fabric';
import * as Y from 'yjs';

const COLORS = [
  '#000000',
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#ffffff',
];

const BRUSH_SIZES = [2, 4, 8, 16];

type Tool = 'draw' | 'select' | 'rect' | 'circle' | 'line' | 'eraser';

export function WhiteboardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const isRemoteUpdate = useRef(false);

  const [tool, setTool] = useState<Tool>('draw');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [roomId, setRoomId] = useState('');
  const [peerCount, setPeerCount] = useState(0);

  // Read room ID from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRoomId(params.get('room') || 'pana-test-room');
  }, []);

  // Sync canvas state to Yjs
  const syncToYjs = useCallback(() => {
    if (isRemoteUpdate.current || !fabricRef.current || !ydocRef.current)
      return;
    const ymap = ydocRef.current.getMap('whiteboard');
    const json = fabricRef.current.toJSON();
    ymap.set('canvas', JSON.stringify(json));
  }, []);

  // Initialize fabric canvas + Yjs (only on roomId change)
  useEffect(() => {
    if (!canvasRef.current || !roomId) return;

    const fc = new Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: window.innerWidth,
      height: window.innerHeight - 56, // toolbar height
      backgroundColor: '#ffffff',
    });

    const brush = new PencilBrush(fc);
    brush.color = '#000000';
    brush.width = 4;
    fc.freeDrawingBrush = brush;
    fabricRef.current = fc;

    // Sync on every modification
    fc.on('object:added', syncToYjs);
    fc.on('object:modified', syncToYjs);
    fc.on('object:removed', syncToYjs);
    fc.on('path:created', syncToYjs);

    // --- Yjs setup (synced via DO WebSocket through BroadcastChannel) ---
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Detect popup vs navigated (mobile): popup has window.opener
    const isPopup = !!window.opener;

    // Encode/decode helpers for Yjs binary updates
    const encodeUpdate = (update: Uint8Array) =>
      btoa(String.fromCharCode(...update));
    const decodeUpdate = (b64: string) =>
      Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    let bc: BroadcastChannel | null = null;
    let ws: WebSocket | null = null;

    if (isPopup) {
      // Desktop popup: relay through BroadcastChannel ↔ video call tab ↔ DO
      bc = new BroadcastChannel(`pana-wb-${roomId}`);
      bcRef.current = bc;

      ydoc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === 'remote') return;
        bc!.postMessage({
          type: 'wb-local-update',
          update: encodeUpdate(update),
        });
      });

      bc.onmessage = (evt) => {
        if (evt.data?.type === 'wb-remote-update' && evt.data.update) {
          Y.applyUpdate(ydoc, decodeUpdate(evt.data.update), 'remote');
        } else if (evt.data?.type === 'wb-peer-count') {
          setPeerCount(evt.data.count);
        }
      };
    } else {
      // Mobile (navigated): connect directly to the DO WebSocket
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/signaling/${roomId}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Join as a whiteboard-only participant
        const wbUserId = `wb-${Math.random().toString(36).slice(2, 8)}`;
        ws!.send(
          JSON.stringify({
            type: 'join',
            userId: wbUserId,
            userName: 'Whiteboard',
          })
        );
        setPeerCount(1); // at least connected
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'wb-sync' && data.update) {
            Y.applyUpdate(ydoc, decodeUpdate(data.update), 'remote');
          }
        } catch {
          // ignore
        }
      };

      ydoc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === 'remote') return;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({ type: 'wb-sync', update: encodeUpdate(update) })
          );
        }
      });
    }

    // Observe Yjs map changes to update canvas
    const ymap = ydoc.getMap('whiteboard');
    ymap.observe(() => {
      const data = ymap.get('canvas') as string | undefined;
      if (!data || !fabricRef.current) return;
      isRemoteUpdate.current = true;
      fabricRef.current.loadFromJSON(JSON.parse(data)).then(() => {
        fabricRef.current?.renderAll();
        isRemoteUpdate.current = false;
      });
    });

    // Handle resize
    const handleResize = () => {
      fc.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 56,
      });
      fc.renderAll();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      bc?.close();
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave' }));
        ws.close();
      }
      ydoc.destroy();
      fc.dispose();
      fabricRef.current = null;
      ydocRef.current = null;
      bcRef.current = null;
      setPeerCount(0);
    };
  }, [roomId, syncToYjs]);

  // Update brush when tool/color/size changes
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    if (tool === 'draw' || tool === 'eraser') {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.color = tool === 'eraser' ? '#ffffff' : color;
      brush.width = tool === 'eraser' ? brushSize * 4 : brushSize;
      fc.freeDrawingBrush = brush;
    } else {
      fc.isDrawingMode = false;
    }

    if (tool === 'select') {
      fc.selection = true;
      fc.defaultCursor = 'default';
    } else {
      fc.selection = false;
    }
  }, [tool, color, brushSize]);

  // Shape drawing for rect/circle/line
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc || (tool !== 'rect' && tool !== 'circle' && tool !== 'line'))
      return;

    let startX = 0;
    let startY = 0;
    let shape: Rect | Circle | Line | null = null;

    const onMouseDown = (opt: { e: MouseEvent }) => {
      const pointer = fc.getScenePoint(opt.e);
      startX = pointer.x;
      startY = pointer.y;

      if (tool === 'rect') {
        shape = new Rect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: color,
          strokeWidth: brushSize,
        });
      } else if (tool === 'circle') {
        shape = new Circle({
          left: startX,
          top: startY,
          radius: 0,
          fill: 'transparent',
          stroke: color,
          strokeWidth: brushSize,
        });
      } else if (tool === 'line') {
        shape = new Line([startX, startY, startX, startY], {
          stroke: color,
          strokeWidth: brushSize,
        });
      }
      if (shape) fc.add(shape);
    };

    const onMouseMove = (opt: { e: MouseEvent }) => {
      if (!shape) return;
      const pointer = fc.getScenePoint(opt.e);
      if (tool === 'rect' && shape instanceof Rect) {
        const w = pointer.x - startX;
        const h = pointer.y - startY;
        shape.set({
          width: Math.abs(w),
          height: Math.abs(h),
          left: w < 0 ? pointer.x : startX,
          top: h < 0 ? pointer.y : startY,
        });
      } else if (tool === 'circle' && shape instanceof Circle) {
        const r =
          Math.sqrt(
            Math.pow(pointer.x - startX, 2) + Math.pow(pointer.y - startY, 2)
          ) / 2;
        shape.set({ radius: r });
      } else if (tool === 'line' && shape instanceof Line) {
        shape.set({ x2: pointer.x, y2: pointer.y });
      }
      fc.renderAll();
    };

    const onMouseUp = () => {
      shape = null;
      syncToYjs();
    };

    fc.on('mouse:down', onMouseDown);
    fc.on('mouse:move', onMouseMove);
    fc.on('mouse:up', onMouseUp);

    return () => {
      fc.off('mouse:down', onMouseDown);
      fc.off('mouse:move', onMouseMove);
      fc.off('mouse:up', onMouseUp);
    };
  }, [tool, color, brushSize, syncToYjs]);

  function clearCanvas() {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.clear();
    fc.backgroundColor = '#ffffff';
    fc.renderAll();
    syncToYjs();
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-white px-3">
        {/* Tools */}
        <div className="flex gap-1">
          {(
            [
              ['draw', 'Draw'],
              ['select', 'Select'],
              ['rect', 'Rect'],
              ['circle', 'Circle'],
              ['line', 'Line'],
              ['eraser', 'Eraser'],
            ] as [Tool, string][]
          ).map(([t, label]) => (
            <Button
              key={t}
              variant={tool === t ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setTool(t)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="bg-border mx-1 h-6 w-px" />

        {/* Colors */}
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`h-6 w-6 rounded-full border-2 ${
                color === c ? 'border-blue-500' : 'border-gray-300'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <div className="bg-border mx-1 h-6 w-px" />

        {/* Brush size */}
        <div className="flex gap-1">
          {BRUSH_SIZES.map((s) => (
            <Button
              key={s}
              variant={brushSize === s ? 'default' : 'outline'}
              size="sm"
              className="h-7 w-7 text-xs"
              onClick={() => setBrushSize(s)}
            >
              {s}
            </Button>
          ))}
        </div>

        <div className="bg-border mx-1 h-6 w-px" />

        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          onClick={clearCanvas}
        >
          Clear
        </Button>

        <span className="text-muted-foreground ml-auto flex items-center gap-2 text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${peerCount > 0 ? 'bg-green-500' : 'bg-yellow-500'}`}
          />
          {peerCount > 0
            ? `${peerCount} peer${peerCount > 1 ? 's' : ''}`
            : 'waiting…'}
          <span className="text-muted-foreground/60">|</span>
          {roomId}
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
