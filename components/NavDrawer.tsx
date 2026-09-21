'use client';

import { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

import styles from './NavDrawer.module.css';
import { cn } from '@/lib/utils';

export type NavDrawerItem = { href: string; label: string };

/**
 * Slide-in primary navigation. Indigo panel, cream text — the one palette
 * pairing that clears contrast comfortably (9.01:1); every warm surface in the
 * palette has to carry ink instead.
 *
 * Accessibility notes, all of which have bitten this pattern before:
 *  - A translated panel is still focusable. Transitioning `visibility` with a
 *    delay equal to the slide duration takes it out of the tab order on close
 *    without needing `inert` (which Safari only recently shipped).
 *  - Scroll-lock is `overflow: hidden` on <body>. That removes the scrollbar
 *    and widens the viewport, which visibly shifts the centered masthead logo.
 *    `scrollbar-gutter: stable` on <html> (app/globals.css) is what keeps it
 *    still — don't remove one without the other.
 */
export default function NavDrawer({
  open,
  onClose,
  items,
  title,
  closeLabel,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  items: NavDrawerItem[];
  title: string;
  closeLabel: string;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Only query focusables that are actually rendered — the footer swaps with
  // auth state, so this can't be computed once.
  const focusables = useCallback(() => {
    const root = panelRef.current;
    if (!root) return [] as HTMLElement[];
    return Array.from(
      root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    ).filter((el) => el.offsetParent !== null);
  }, []);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    focusables()[0]?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      const inPanel = !!active && !!panelRef.current?.contains(active);

      if (event.shiftKey && (active === first || !inPanel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Hand focus back to whatever opened the drawer.
      restoreRef.current?.focus?.();
      restoreRef.current = null;
    };
  }, [open, onClose, focusables]);

  return (
    <>
      <div
        className={cn(styles.scrim, open && styles.scrimOpen)}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={cn(styles.panel, open && styles.panelOpen)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.head}>
          <span className={styles.title}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            className={styles.close}
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav>
          <ul className={styles.list}>
            {items.map((item, index) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.link}
                  onClick={onClose}
                >
                  <span className={styles.num} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {footer ? <div className={styles.foot}>{footer}</div> : null}
      </div>
    </>
  );
}
