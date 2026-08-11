'use client';

import { useEffect, useRef, useState } from 'react';

interface RevealOnView<T extends HTMLElement> {
  /** Attach to the element whose visibility gates the reveal. */
  ref: React.RefObject<T | null>;
  /** True once the element has been seen — never flips back to false. */
  revealed: boolean;
  /** True when the visitor asked for reduced motion. */
  reducedMotion: boolean;
}

/**
 * Reveal an element the first time it scrolls into view.
 *
 * Exists for mount-triggered animations. A Recharts chart animates when it
 * mounts, so a chart placed below the fold plays its whole entrance while it is
 * still off-screen and is simply *there* by the time anyone scrolls down.
 * Gating the mount on intersection makes "first render" and "first seen" the
 * same moment.
 *
 * `reducedMotion` is reported separately rather than folded into `revealed`:
 * callers still need to render immediately in that case, just without the
 * animation, so the two answers cannot share one flag. When reduced motion is
 * requested the element is revealed at once and no observer is created.
 *
 * Degrades to revealing immediately where IntersectionObserver is missing —
 * an un-animated chart beats an absent one.
 */
export function useRevealOnView<
  T extends HTMLElement = HTMLElement,
>(): RevealOnView<T> {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReducedMotion(true);
      setRevealed(true);
      return;
    }

    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setRevealed(true);
        observer.disconnect();
      },
      // A quarter visible: enough of the plot is on screen that the entrance
      // is watched rather than caught halfway.
      { threshold: 0.25 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed, reducedMotion };
}
