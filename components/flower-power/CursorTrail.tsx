'use client';

import { useEffect } from 'react';

interface Trail {
  id: number;
  x: number;
  y: number;
  life: number;
  emoji: string;
}

const TRAIL_EMOJIS = ['✨', '🌸', '🌺', '🌼', '💫', '⭐'];

export function CursorTrail() {
  useEffect(() => {
    // Check if prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const trails: Trail[] = [];
    let trailId = 0;
    let animationId: number;
    let lastX = 0;
    let lastY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      // Only create trail if mouse has moved significantly
      const distance = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      if (distance < 10) return;

      lastX = e.clientX;
      lastY = e.clientY;

      trails.push({
        id: trailId++,
        x: e.clientX,
        y: e.clientY,
        life: 1,
        emoji: TRAIL_EMOJIS[Math.floor(Math.random() * TRAIL_EMOJIS.length)],
      });

      // Limit trail length
      if (trails.length > 20) {
        trails.shift();
      }
    };

    const animate = () => {
      const container = document.getElementById('cursor-trail');
      if (!container) return;

      container.innerHTML = '';

      for (let i = trails.length - 1; i >= 0; i--) {
        const trail = trails[i];
        trail.life -= 0.02;

        if (trail.life <= 0) {
          trails.splice(i, 1);
          continue;
        }

        const element = document.createElement('div');
        element.textContent = trail.emoji;
        element.style.position = 'fixed';
        element.style.left = `${trail.x}px`;
        element.style.top = `${trail.y}px`;
        element.style.transform = 'translate(-50%, -50%)';
        element.style.opacity = `${trail.life}`;
        element.style.pointerEvents = 'none';
        element.style.fontSize = '20px';
        element.style.transition = 'opacity 0.1s';
        container.appendChild(element);
      }

      animationId = requestAnimationFrame(animate);
    };

    // Create container
    const container = document.createElement('div');
    container.id = 'cursor-trail';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9998';
    document.body.appendChild(container);

    document.addEventListener('mousemove', handleMouseMove);
    animate();

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
      container.remove();
    };
  }, []);

  return null;
}
