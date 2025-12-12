'use client';

import { useEffect } from 'react';

interface Petal {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  vx: number;
  vy: number;
  life: number;
}

const PETAL_COLORS = [
  '#FF69B4',
  '#FFB6C1',
  '#FFC0CB',
  '#FF1493',
  '#FF69B4',
  '#DDA0DD',
  '#DA70D6',
  '#BA55D3',
];

export function PetalBurst() {
  useEffect(() => {
    const petals: Petal[] = [];
    let animationId: number;
    let petalId = 0;

    const createPetals = (x: number, y: number) => {
      const petalCount = 12 + Math.random() * 8;

      for (let i = 0; i < petalCount; i++) {
        const angle = (Math.PI * 2 * i) / petalCount + (Math.random() - 0.5);
        const speed = 2 + Math.random() * 4;

        petals.push({
          id: petalId++,
          x,
          y,
          color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
          rotation: Math.random() * 360,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 1,
        });
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Check if prefers-reduced-motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      createPetals(e.clientX, e.clientY);
    };

    const animate = () => {
      const canvas = document.getElementById(
        'petal-canvas'
      ) as HTMLCanvasElement;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = petals.length - 1; i >= 0; i--) {
        const petal = petals[i];

        // Update physics
        petal.vy += 0.1; // gravity
        petal.x += petal.vx;
        petal.y += petal.vy;
        petal.rotation += 5;
        petal.life -= 0.01;

        if (petal.life <= 0 || petal.y > canvas.height) {
          petals.splice(i, 1);
          continue;
        }

        // Draw petal
        ctx.save();
        ctx.translate(petal.x, petal.y);
        ctx.rotate((petal.rotation * Math.PI) / 180);
        ctx.globalAlpha = petal.life;

        // Draw flower petal shape
        ctx.fillStyle = petal.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      animationId = requestAnimationFrame(animate);
    };

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'petal-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('click', handleClick);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationId);
      canvas.remove();
    };
  }, []);

  return null;
}
