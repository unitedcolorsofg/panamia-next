'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Check, Plus, Settings } from 'lucide-react';

import { useIdentity, type Identity } from './identity-provider';
import styles from './identity.module.css';
import { cn } from '@/lib/utils';

/** Up to two initials, so "Café Curú" reads as CC rather than C. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function Avatar({ identity, large }: { identity: Identity; large?: boolean }) {
  return (
    <span
      className={cn(
        styles.avatar,
        !identity.isPersonal && styles.avatarBusiness,
        large && styles.avatarLg
      )}
      aria-hidden="true"
    >
      {initialsOf(identity.name ?? '?')}
    </span>
  );
}

/**
 * The "acting as" menu in the masthead.
 *
 * One login can administer several profiles — the person's own, plus any
 * business listing they own or help run. This is where you choose which of
 * them the rest of the app speaks for.
 *
 * Renders a dropdown on desktop and a bottom sheet on phones: a top-right
 * popover is not reachable one-handed, and this control is used mid-task.
 */
export function IdentityMenu() {
  const { t } = useTranslation('common');
  const identity = useIdentity();
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
    const first = listRef.current?.querySelector<HTMLElement>(
      '[data-identity-row]'
    );
    first?.focus();
  }, [open]);

  // Roving arrow-key focus across the rows.
  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[data-identity-row]') ??
        []
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

  const active = identity?.active ?? null;

  if (!identity || identity.identities.length === 0) return null;

  const { identities, activeId, switching, error, switchTo } = identity;

  async function onPick(profileId: string) {
    close(false);
    if (profileId !== activeId) await switchTo(profileId);
  }

  const rows = (
    <div ref={listRef} onKeyDown={onListKeyDown} role="menu">
      <div className={styles.menuHeading}>{t('identity.actingAs')}</div>

      {identities.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            data-identity-row
            disabled={switching !== null}
            onClick={() => onPick(item.id)}
            className={cn(styles.row, isActive && styles.rowActive)}
          >
            <Avatar identity={item} />
            <span className={styles.rowMeta}>
              <span className={styles.rowName}>{item.name}</span>
              <span className={styles.rowHandle}>
                {item.screenname
                  ? `@${item.screenname}`
                  : item.isPersonal
                    ? t('identity.you')
                    : t('identity.business')}
              </span>
            </span>

            {item.active === false && (
              <span className={styles.badge}>{t('identity.inactive')}</span>
            )}
            {item.isPersonal ? (
              <span className={styles.badge}>{t('identity.you')}</span>
            ) : (
              <span className={styles.badge}>
                {item.role === 'manager'
                  ? t('identity.manager')
                  : t('identity.owner')}
              </span>
            )}

            {switching === item.id ? (
              <span className={styles.spinner} aria-hidden="true" />
            ) : isActive ? (
              <Check className={styles.check} aria-hidden="true" />
            ) : null}
          </button>
        );
      })}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.separator} />

      <Link
        href="/form/list-your-business"
        role="menuitem"
        data-identity-row
        onClick={() => close(false)}
        className={styles.row}
      >
        <span className={styles.addIcon} aria-hidden="true">
          <Plus className="h-4 w-4" />
        </span>
        <span className={styles.rowMeta}>
          <span className={styles.rowName}>{t('identity.listBusiness')}</span>
          <span className={styles.rowHandle}>
            {t('identity.listBusinessHint')}
          </span>
        </span>
      </Link>

      <div className={styles.separator} />

      <Link
        href="/account/user/edit"
        role="menuitem"
        data-identity-row
        onClick={() => close(false)}
        className={cn(styles.row, styles.rowQuiet)}
      >
        <Settings className="h-4 w-4 opacity-70" aria-hidden="true" />
        <span className={styles.rowMeta}>
          <span className={styles.rowName}>{t('identity.settings')}</span>
        </span>
      </Link>
    </div>
  );

  return (
    <div className={styles.anchor} ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          active
            ? `${t('identity.switchAccount')} — ${active.name}`
            : t('identity.switchAccount')
        }
        onClick={() => setOpen((v) => !v)}
      >
        {active ? (
          <Avatar identity={active} />
        ) : (
          <span className={styles.avatar} aria-hidden="true">
            ?
          </span>
        )}
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
            aria-label={t('identity.switchAccount')}
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
