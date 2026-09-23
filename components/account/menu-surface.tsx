'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import styles from './identity.module.css';
import { cn } from '@/lib/utils';

/**
 * The masthead popup frame.
 *
 * Extracted from the identity switcher so the signed-out menu is the same
 * frame rather than a lookalike. Two implementations would drift — one would
 * get the scroll lock, the other would keep the dropdown on phones — and the
 * whole point of the signed-out menu is that a visitor meets the control they
 * will keep using once they have an account.
 *
 * Renders a dropdown on desktop and a bottom sheet on phones: a top-right
 * popover is not reachable one-handed, and these controls are used mid-task.
 *
 * Both panels stay mounted and are hidden with `inert` rather than unmounted,
 * because the open/close animation lives in CSS and has nothing to animate if
 * the element appears at the moment it should already be moving.
 */

/**
 * Rows opt into arrow-key navigation by carrying this attribute. Anything
 * without it — a disabled "coming soon" entry, a heading — is skipped, which
 * is what keeps the roving focus landing only on things that do something.
 */
export const MENU_ROW = 'data-menu-row';

export function MenuSurface({
  label,
  trigger,
  triggerClassName,
  children,
}: {
  /** Accessible name for both the trigger and the mobile sheet. */
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
  /** Receives `close` so a row can dismiss the menu as it navigates. */
  children: (close: (returnFocus?: boolean) => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Escape closes from anywhere; click-outside only applies to the desktop
  // dropdown, since the sheet has its own scrim.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onClick = (e: MouseEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, close]);

  // Lock the page behind the sheet, which would otherwise scroll under it.
  useEffect(() => {
    if (!open || !isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    const first = listRef.current?.querySelector<HTMLElement>(`[${MENU_ROW}]`);
    first?.focus();
  }, [open]);

  // Roving arrow-key focus across the rows.
  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>(`[${MENU_ROW}]`) ?? []
    );
    if (rows.length === 0) return;
    e.preventDefault();
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === 'ArrowDown'
        ? rows[(at + 1) % rows.length]
        : rows[(at - 1 + rows.length) % rows.length];
    next?.focus();
  };

  const rows = (
    <div ref={listRef} onKeyDown={onListKeyDown} role="menu">
      {children(close)}
    </div>
  );

  return (
    <div className={styles.anchor} ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>

      {isMobile ? (
        <>
          <div
            className={cn(styles.scrim, open && styles.scrimOpen)}
            onClick={() => close()}
            aria-hidden="true"
          />
          <div
            className={cn(styles.sheet, open && styles.sheetOpen)}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            inert={!open}
          >
            <div className={styles.grabber} aria-hidden="true" />
            {rows}
          </div>
        </>
      ) : (
        <div className={cn(styles.menu, open && styles.menuOpen)} inert={!open}>
          {rows}
        </div>
      )}
    </div>
  );
}
