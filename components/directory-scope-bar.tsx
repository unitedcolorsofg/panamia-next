'use client';

import Link from 'next/link';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { KIND_ICON } from '@/components/kind-icon';
import {
  countFor,
  SCOPE_BLURB,
  SCOPE_LABEL,
  SCOPE_REQUIRES_PANA,
  SCOPE_TONE,
  SCOPES,
  scopePath,
  type Scope,
  type ScopeCounts,
} from '@/lib/directory-scopes';

interface ScopeNavProps {
  /** The term the counts were computed for; scope links carry it across. */
  term: string;
  scope: Scope;
  /** Null while unknown — the businesses view fetches these after mount, and
      chips are navigation first, so they render without numbers until then. */
  counts: ScopeCounts | null;
  signedIn: boolean;
}

/**
 * The scope selector, promoted from the approved scoped-directory mock.
 *
 * One change from the mock, and it is the important one: scopes are `<Link>`s
 * rather than buttons calling back into local state. Each scope is a real
 * route, so it has to be middle-clickable, shareable and crawlable — that is
 * the whole reason dedicated routes were chosen over a `?kind=` param. A
 * button would have thrown that away at the last step.
 *
 * Why not a native `<select>`: a select renders in OS chrome, so the design
 * system stops at its edge, and it cannot carry an icon, a count or a reason.
 * Every scope here needs all three. "Panas" means nothing on a first visit,
 * and a scope holding zero results should say so before you pick it.
 *
 * Built on `.surface-panel` / `.surface-option`, the primitives the panaverse
 * switcher already uses, so this is the same dropdown the masthead has rather
 * than a second one that looks nearly like it.
 */
export function ScopeMenu({ term, scope, counts, signedIn }: ScopeNavProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuId = useId();

  // Gated scopes are skipped by the arrow keys rather than merely dimmed; a
  // keyboard user should not have to arrow through a door that is locked.
  const reachable = SCOPES.filter(
    (option) => !(SCOPE_REQUIRES_PANA[option] && !signedIn)
  );

  const CurrentIcon = scope === 'all' ? null : KIND_ICON[scope];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const focusItem = (index: number) => {
    const bounded = (index + reachable.length) % reachable.length;
    itemRefs.current[bounded]?.focus();
  };

  const openWith = (index: number) => {
    setOpen(true);
    // Focus after paint — the items do not exist until the panel renders.
    window.requestAnimationFrame(() => focusItem(index));
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Open onto the current scope, so the menu starts where you left it.
      openWith(Math.max(0, reachable.indexOf(scope)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openWith(reachable.length - 1);
    }
  };

  const onItemKeyDown = (
    event: ReactKeyboardEvent<HTMLAnchorElement>,
    index: number
  ) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(reachable.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        // Let focus leave naturally, but do not leave a panel hanging open
        // over the results behind it.
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="surface-pill"
        data-tone={SCOPE_TONE[scope]}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Search scope, currently ${SCOPE_LABEL[scope]}`}
        onClick={() =>
          open ? close(false) : openWith(Math.max(0, reachable.indexOf(scope)))
        }
        onKeyDown={onTriggerKeyDown}
      >
        {CurrentIcon ? (
          <CurrentIcon
            className="h-3.5 w-3.5 flex-none"
            style={{ color: 'var(--surface-tone)' }}
            aria-hidden="true"
          />
        ) : (
          <span className="surface-dot" aria-hidden="true" />
        )}
        <span className="surface-pill-name">{SCOPE_LABEL[scope]}</span>
        <ChevronDown
          className="h-3.5 w-3.5 flex-none transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Search scope"
          className="surface-panel"
          /* `.surface-panel` is written for the masthead: it hangs off the
             right edge, sizes against its positioned ancestor — which here is
             a button about eleven characters wide — and claims `z-index: 30`,
             enough to beat page content but not the sticky scope strip below,
             which also claims 30 and wins the tie by being later in the DOM.
             45 clears both that strip and any page chrome, so an open menu is
             never sliced in half. Inline so all of it beats the class
             regardless of how the utility layers end up ordered. */
          style={{
            left: 0,
            right: 'auto',
            zIndex: 45,
            width: '19.5rem',
            maxWidth: 'calc(100vw - 2rem)',
          }}
        >
          <p className="surface-panel-label">Search for</p>

          <div className="flex flex-col gap-1">
            {SCOPES.map((option) => {
              const gated = SCOPE_REQUIRES_PANA[option] && !signedIn;
              const Icon = option === 'all' ? null : KIND_ICON[option];
              const isCurrent = option === scope;
              const count = counts ? countFor(counts, option) : null;
              const index = reachable.indexOf(option);

              const body = (
                <>
                  {gated ? (
                    <Lock
                      className="text-pana-ink/40 h-4 w-4 flex-none"
                      aria-hidden="true"
                    />
                  ) : Icon ? (
                    <Icon
                      className="h-4 w-4 flex-none"
                      style={{ color: 'var(--surface-tone)' }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="surface-dot" aria-hidden="true" />
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="surface-option-head">
                      <span className="surface-option-name">
                        {SCOPE_LABEL[option]}
                      </span>
                      {/* The count comes from the same query that renders the
                          list, so the menu cannot promise a number the page
                          will not produce. A scope at zero stays pickable —
                          "no groups match art" is an answer. */}
                      {!gated && count !== null && (
                        <span
                          className="ml-auto flex-none text-xs font-black"
                          style={{
                            color:
                              count === 0
                                ? 'rgb(17 13 13 / 0.35)'
                                : 'var(--surface-tone)',
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </span>
                    <span className="surface-option-blurb">
                      {gated
                        ? 'Sign in as a pana to search members'
                        : SCOPE_BLURB[option]}
                    </span>
                  </span>
                </>
              );

              // A gated scope is a span, not a disabled link: there is no
              // destination to offer, and an <a href> that refuses to navigate
              // is worse than one that was never a link.
              if (gated) {
                return (
                  <span
                    key={option}
                    role="menuitem"
                    aria-disabled="true"
                    className="surface-option items-center cursor-not-allowed opacity-45"
                    data-tone={SCOPE_TONE[option]}
                  >
                    {body}
                  </span>
                );
              }

              return (
                <Link
                  key={option}
                  ref={(node) => {
                    if (index >= 0) itemRefs.current[index] = node;
                  }}
                  href={scopePath(option, term)}
                  role="menuitem"
                  className="surface-option items-center"
                  data-tone={SCOPE_TONE[option]}
                  data-current={isCurrent}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => close(false)}
                  onKeyDown={(event) => onItemKeyDown(event, index)}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The scopes again, as chips carrying counts.
 *
 * These live on the cream filter strip rather than inside the indigo band, for
 * two reasons. `.dirsearch-chip` draws indigo-on-transparent, so on the indigo
 * band every unselected chip is invisible — the primitive was built for the
 * light filter row and only works there. And being sticky means the scope
 * stays switchable while you are twenty results deep, which is exactly when
 * you realise you wanted groups, not businesses.
 */
export function ScopeChips({ term, scope, counts, signedIn }: ScopeNavProps) {
  return (
    <div className="dirsearch-filters">
      <div className="container mx-auto px-4">
        <div className="dirsearch-filterrow">
          <span className="dirsearch-filterlabel">Scope</span>
          <nav className="dirsearch-chiprow" aria-label="Search scope">
            {SCOPES.map((option) => {
              const gated = SCOPE_REQUIRES_PANA[option] && !signedIn;
              const Icon = option === 'all' ? null : KIND_ICON[option];
              const count = counts ? countFor(counts, option) : null;

              const inner = (
                <>
                  {gated ? (
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {SCOPE_LABEL[option]}
                  {!gated && count !== null && (
                    <span className="opacity-55">{count}</span>
                  )}
                </>
              );

              if (gated) {
                return (
                  <span
                    key={option}
                    className="dirsearch-chip inline-flex cursor-not-allowed items-center gap-1.5 opacity-40"
                    title="Sign in as a pana to search members"
                  >
                    {inner}
                  </span>
                );
              }

              return (
                <Link
                  key={option}
                  href={scopePath(option, term)}
                  className="dirsearch-chip inline-flex items-center gap-1.5"
                  data-on={option === scope}
                  aria-current={option === scope ? 'page' : undefined}
                >
                  {inner}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
