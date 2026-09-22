'use client';

import { useEffect } from 'react';

/**
 * Fades and lifts `[data-rv]` elements into view as they approach the fold,
 * as in the design mock.
 *
 * Two deliberate choices:
 *
 *  - The hidden state is scoped to `html[data-rv-ready]`, which only this
 *    component sets. If the bundle fails, is blocked, or never hydrates, the
 *    rule never matches and every section renders normally. Putting
 *    `opacity: 0` in the stylesheet unconditionally is how this pattern ships
 *    permanently-invisible content.
 *
 *  - A rAF-throttled sweep rather than IntersectionObserver. An element that
 *    jumps from below the viewport to above it in one go — an anchor jump, a
 *    restored scroll position — never changes intersection state, so IO would
 *    not fire and the section would stay stranded. The homepage is full of
 *    anchor links (#directory, #home-faq), so this matters here.
 *
 * Elements are re-queried each sweep so sections that mount later (the async
 * article and featured-pana rails) are still picked up.
 */
export default function ScrollReveal() {
  useEffect(() => {
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reduced) return;

    const root = document.documentElement;
    root.setAttribute('data-rv-ready', '');

    let seen = 0;
    let ticking = false;

    function sweep() {
      ticking = false;
      const limit = window.innerHeight * 0.92;
      const pending = document.querySelectorAll<HTMLElement>(
        '[data-rv]:not(.rv-in)'
      );

      pending.forEach((el) => {
        // Stagger in groups of six so a row of cards cascades rather than
        // arriving as one block.
        if (!el.style.transitionDelay) {
          el.style.transitionDelay = `${(seen % 6) * 55}ms`;
          seen += 1;
        }
        if (el.getBoundingClientRect().top < limit) el.classList.add('rv-in');
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sweep);
    }

    sweep();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('load', onScroll);
      root.removeAttribute('data-rv-ready');
    };
  }, []);

  return null;
}
