'use client';

import { useEffect, useRef, useState } from 'react';
import { useFlowerPower } from '@/components/flower-power/FlowerPowerProvider';

export function useButtonEvasion() {
  const { isActive } = useFlowerPower();
  const [dodgeCount, setDodgeCount] = useState(0);
  const elementRef = useRef<HTMLElement | null>(null);
  const isDodging = useRef(false);

  useEffect(() => {
    if (!isActive || !elementRef.current) return;

    const element = elementRef.current;
    const maxDodges = 3;

    const handleMouseMove = (e: MouseEvent) => {
      if (dodgeCount >= maxDodges || isDodging.current) return;

      // Check if prefers-reduced-motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // Calculate distance from mouse to button center
      const buttonCenterX = rect.left + rect.width / 2;
      const buttonCenterY = rect.top + rect.height / 2;
      const distance = Math.hypot(
        mouseX - buttonCenterX,
        mouseY - buttonCenterY
      );

      // If mouse is within 100px, dodge!
      if (distance < 100) {
        isDodging.current = true;

        // Calculate dodge direction (away from mouse)
        const angle = Math.atan2(
          buttonCenterY - mouseY,
          buttonCenterX - mouseX
        );
        const dodgeDistance = 100;
        const newX = Math.cos(angle) * dodgeDistance;
        const newY = Math.sin(angle) * dodgeDistance;

        // Apply transform
        element.style.transform = `translate(${newX}px, ${newY}px)`;
        element.style.transition =
          'transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';

        setDodgeCount((prev) => prev + 1);

        // Reset after animation
        setTimeout(() => {
          isDodging.current = false;
        }, 300);
      }
    };

    const handleClick = () => {
      // Reset on successful click
      setDodgeCount(0);
      element.style.transform = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('click', handleClick);
    };
  }, [isActive, dodgeCount]);

  return { elementRef, dodgeCount };
}
