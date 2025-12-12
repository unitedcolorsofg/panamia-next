'use client';

import { useEffect } from 'react';
import { useFlowerPower } from './FlowerPowerProvider';

interface ButtonState {
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  dodgeCount: number;
  lastMouseMove: number;
  animationFrame?: number;
}

export function GlobalButtonEvasion() {
  const { isActive } = useFlowerPower();

  useEffect(() => {
    if (!isActive) return;

    const buttonStates = new Map<HTMLElement, ButtonState>();
    const maxDodges = 3;
    const activationRadius = 250; // Much larger radius
    const dodgeDistance = 150;
    const homingDelay = 800; // Time before button starts homing in (ms)
    const homingSpeed = 0.02; // Speed of homing in toward cursor
    const maxBoundary = 200; // Maximum distance from original position (px)

    let currentMouseX = 0;
    let currentMouseY = 0;

    const applyEvasionToButton = (button: HTMLElement) => {
      if (buttonStates.has(button)) return;

      // Initialize state
      const state: ButtonState = {
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
        dodgeCount: 0,
        lastMouseMove: Date.now(),
      };
      buttonStates.set(button, state);

      // Add evading class to disable wobble
      button.classList.add('evading');

      const animate = () => {
        if (!buttonStates.has(button)) return;

        const state = buttonStates.get(button)!;
        const rect = button.getBoundingClientRect();
        const buttonCenterX = rect.left + rect.width / 2 - state.currentX;
        const buttonCenterY = rect.top + rect.height / 2 - state.currentY;
        const distanceToMouse = Math.hypot(
          currentMouseX - buttonCenterX,
          currentMouseY - buttonCenterY
        );

        // Check if mouse is within activation radius and we haven't maxed out dodges
        if (
          distanceToMouse < activationRadius &&
          state.dodgeCount < maxDodges
        ) {
          // Calculate direction away from mouse
          const angle = Math.atan2(
            buttonCenterY - currentMouseY,
            buttonCenterX - currentMouseX
          );

          // Set target position (dodge away)
          state.targetX = Math.cos(angle) * dodgeDistance;
          state.targetY = Math.sin(angle) * dodgeDistance;

          console.log(
            '[Flower Power] Button evading! Dodge count:',
            state.dodgeCount
          );
        } else if (distanceToMouse >= activationRadius) {
          // Mouse is far away - gradually return to home position
          state.targetX *= 0.95; // Decay toward zero
          state.targetY *= 0.95;

          // Reset dodge count when back at home
          const distanceFromHome = Math.hypot(state.currentX, state.currentY);
          if (distanceFromHome < 5) {
            state.dodgeCount = 0;
          }
        } else {
          // Check if mouse hasn't moved recently (and still within activation zone)
          const timeSinceMouseMove = Date.now() - state.lastMouseMove;

          if (
            timeSinceMouseMove > homingDelay &&
            state.dodgeCount < maxDodges
          ) {
            // Gradually home in toward cursor
            const dx = currentMouseX - buttonCenterX;
            const dy = currentMouseY - buttonCenterY;

            state.targetX += dx * homingSpeed;
            state.targetY += dy * homingSpeed;

            console.log('[Flower Power] Button homing in...');
          }
        }

        // Apply boundary constraints to target position
        const distanceFromOrigin = Math.hypot(state.targetX, state.targetY);
        if (distanceFromOrigin > maxBoundary) {
          const scale = maxBoundary / distanceFromOrigin;
          state.targetX *= scale;
          state.targetY *= scale;
        }

        // Smoothly interpolate current position toward target
        const easing = 0.15;
        state.currentX += (state.targetX - state.currentX) * easing;
        state.currentY += (state.targetY - state.currentY) * easing;

        // Apply transform
        button.style.transform = `translate(${state.currentX}px, ${state.currentY}px)`;
        button.style.transition = 'none'; // Disable CSS transition for smooth animation

        // Continue animation
        state.animationFrame = requestAnimationFrame(animate);
      };

      // Start animation loop
      state.animationFrame = requestAnimationFrame(animate);

      const handleClick = () => {
        const state = buttonStates.get(button);
        if (state) {
          console.log('[Flower Power] Button clicked! Resetting...');
          // Reset position and dodge count
          state.currentX = 0;
          state.currentY = 0;
          state.targetX = 0;
          state.targetY = 0;
          state.dodgeCount = 0;
          button.style.transform = '';
        }
      };

      button.addEventListener('click', handleClick);

      // Store cleanup function
      (button as any).__evasionCleanup = () => {
        if (state.animationFrame) {
          cancelAnimationFrame(state.animationFrame);
        }
        button.removeEventListener('click', handleClick);
        button.classList.remove('evading');
        button.style.transform = '';
        buttonStates.delete(button);
      };
    };

    const removeEvasionFromButton = (button: HTMLElement) => {
      if ((button as any).__evasionCleanup) {
        (button as any).__evasionCleanup();
        delete (button as any).__evasionCleanup;
      }
    };

    // Global mouse move handler
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      currentMouseX = e.clientX;
      currentMouseY = e.clientY;

      // Update last mouse move time for all buttons
      buttonStates.forEach((state, button) => {
        state.lastMouseMove = Date.now();

        // Increment dodge count when mouse approaches
        const rect = button.getBoundingClientRect();
        const buttonCenterX = rect.left + rect.width / 2 - state.currentX;
        const buttonCenterY = rect.top + rect.height / 2 - state.currentY;
        const distance = Math.hypot(
          currentMouseX - buttonCenterX,
          currentMouseY - buttonCenterY
        );

        // Only increment dodge count once per approach
        if (distance < activationRadius && state.dodgeCount < maxDodges) {
          const wasClose = distance < activationRadius - 50;
          if (!wasClose && state.dodgeCount === 0) {
            state.dodgeCount = 1;
          } else if (
            distance < activationRadius - 100 &&
            state.dodgeCount === 1
          ) {
            state.dodgeCount = 2;
          } else if (
            distance < activationRadius - 150 &&
            state.dodgeCount === 2
          ) {
            state.dodgeCount = 3;
          }
        }
      });
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);

    // Find all buttons with rounded-md class (excluding theme toggle)
    const findAndApplyEvasion = () => {
      const buttons = document.querySelectorAll(
        'button.rounded-md:not([data-no-wobble])'
      );
      console.log('[Flower Power] Found buttons for evasion:', buttons.length);
      buttons.forEach((button) => {
        applyEvasionToButton(button as HTMLElement);
      });
    };

    // Initial application - delay to ensure DOM is ready
    setTimeout(() => {
      findAndApplyEvasion();
    }, 100);

    // Watch for new buttons being added
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (
              node.tagName === 'BUTTON' &&
              node.classList.contains('rounded-md') &&
              !node.hasAttribute('data-no-wobble')
            ) {
              applyEvasionToButton(node);
            }
            const buttons = node.querySelectorAll(
              'button.rounded-md:not([data-no-wobble])'
            );
            buttons.forEach((button) => {
              applyEvasionToButton(button as HTMLElement);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      observer.disconnect();
      buttonStates.forEach((_, button) => {
        removeEvasionFromButton(button);
      });
    };
  }, [isActive]);

  return null;
}
