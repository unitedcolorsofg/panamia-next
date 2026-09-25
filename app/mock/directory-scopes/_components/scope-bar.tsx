'use client';

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { ChevronDown, Lock, Search } from 'lucide-react';
import { KIND_ICON } from './scope-cards';
import {
  countFor,
  SCOPE_BLURB,
  SCOPE_LABEL,
  SCOPE_REQUIRES_PANA,
  SCOPE_TONE,
  SCOPES,
  type Scope,
  type ScopeResults,
} from '../_data';

interface ScopeBarProps {
  term: string;
  scope: Scope;
  results: ScopeResults;
  signedIn: boolean;
  onSearch: (term: string) => void;
  onScopeChange: (scope: Scope) => void;
}

/**
 * Search header for the scoped directory.
 *
 * The scope selector sits *inside* the search pill rather than above or beside
 * it, because scope is part of the question being asked — "panas named Maria"
 * is one query, not a query plus a page setting. Putting it in the pill also
 * means the typeahead dropdown and this control end up in the same place on
 * screen, so pressing Enter no longer changes the subject.
 *
 * Underneath, the same five scopes appear as chips carrying result counts.
 * That is not duplication for its own sake: the menu states what you asked
 * for, the chips state what is actually there. A search for "art" that finds
 * four businesses and no groups should say so before you go looking.
 */
/**
 * The scope selector.
 *
 * This replaced a native `<select>`, which was the right first move and the
 * wrong finished one. A native select renders in OS chrome: the design system
 * stops at its edge, so the menu arrived as a grey system list in the middle
 * of a cream-and-indigo page, and — more to the point — it cannot carry an
 * icon, a count, or a reason. Every scope in this product needs all three.
 * "Panas" means nothing on a first visit, and a scope holding zero results
 * should say so before you pick it, not after.
 *
 * It is built on `.surface-panel` / `.surface-option`, the primitives the
 * panaverse switcher already uses, so this is the same dropdown the masthead
 * has rather than a second one that looks nearly like it.
 *
 * The concern that sent the first version to a native select still stands: in
 * the real directory a typeahead dropdown opens from the input a couple of
 * inches to the right, and two menus open at once from one bar is worse than
 * a plain control. That is a coordination problem, not an argument for OS
 * chrome — this panel anchors under the scope button rather than under the
 * input, and whichever opens closes the other.
 */
function ScopeMenu({
  scope,
  results,
  signedIn,
  onScopeChange,
}: Pick<ScopeBarProps, 'scope' | 'results' | 'signedIn' | 'onScopeChange'>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  // Gated scopes are skipped by the arrow keys rather than merely dimmed;
  // a keyboard user should not have to arrow through a door that is locked.
  const reachable = SCOPES.filter(
    (option) => !(SCOPE_REQUIRES_PANA[option] && !signedIn),
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
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
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
        onClick={() => (open ? close(false) : openWith(Math.max(0, reachable.indexOf(scope))))}
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
             45 clears both that strip and the mock toolbar (40), so an open
             menu is never sliced in half by chrome. Inline so all of it beats
             the class regardless of how the utility layers end up ordered. */
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
              const count = countFor(results, option);
              const index = reachable.indexOf(option);

              return (
                <button
                  key={option}
                  ref={(node) => {
                    if (index >= 0) itemRefs.current[index] = node;
                  }}
                  type="button"
                  role="menuitem"
                  className="surface-option items-center disabled:cursor-not-allowed disabled:opacity-45"
                  data-tone={SCOPE_TONE[option]}
                  data-current={isCurrent}
                  aria-current={isCurrent ? 'true' : undefined}
                  disabled={gated}
                  tabIndex={gated || index < 0 ? -1 : 0}
                  onClick={() => {
                    onScopeChange(option);
                    close(true);
                  }}
                  onKeyDown={(event) => onItemKeyDown(event, index)}
                >
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
                      {!gated && (
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
                      {gated ? 'Sign in as a pana to search members' : SCOPE_BLURB[option]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ScopeBar({
  term,
  scope,
  results,
  signedIn,
  onSearch,
  onScopeChange,
}: ScopeBarProps) {
  const [draft, setDraft] = useState(term);
  const inputId = useId();

  const total = countFor(results, 'all');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(draft);
  };

  return (
    <section className="surface-indigo dirsearch-band">
      <div className="container mx-auto px-4">
        <span className="section-eyebrow">Directory</span>

        <h1 className="dirsearch-title">
          {term ? (
            <>
              <em>{term}</em>
              {scope === 'all' ? (
                <> in South Florida</>
              ) : (
                <> — {SCOPE_LABEL[scope].toLowerCase()}</>
              )}
            </>
          ) : (
            <>Find your people</>
          )}
        </h1>

        <p className="dirsearch-count">
          {total === 0 ? (
            <>No matches yet — try a broader search</>
          ) : scope === 'all' ? (
            <>
              <strong>{total}</strong>
              {total === 1 ? ' result' : ' results'} across businesses, panas,
              groups and events
            </>
          ) : (
            <>
              <strong>{countFor(results, scope)}</strong>
              {' of '}
              {total} {total === 1 ? 'result' : 'results'} are{' '}
              {SCOPE_LABEL[scope].toLowerCase()}
            </>
          )}
        </p>

        <form onSubmit={handleSubmit} className="dirsearch-searchrow">
          <div className="dirsearch-pill">
            <ScopeMenu
              scope={scope}
              results={results}
              signedIn={signedIn}
              onScopeChange={onScopeChange}
            />

            <span className="dirsearch-chipdivide" aria-hidden="true" />

            <label htmlFor={inputId} className="sr-only">
              Search the Pana Mia directory
            </label>
            <Search className="h-5 w-5 shrink-0 opacity-45" aria-hidden="true" />
            <input
              id={inputId}
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Try art, croqueta, zine, Maria…"
              autoComplete="off"
            />
            <button type="submit">Search</button>
          </div>
        </form>
      </div>
    </section>
  );
}

/**
 * The scopes again, as chips carrying counts.
 *
 * These live on the cream filter strip rather than inside the indigo band,
 * for two reasons. `.dirsearch-chip` draws indigo-on-transparent, so on the
 * indigo band every unselected chip is invisible — the primitive was built
 * for the light filter row and only works there. And being sticky means the
 * scope stays switchable while you are twenty results deep, which is exactly
 * when you realise you wanted groups, not businesses.
 */
export function ScopeChips({
  scope,
  results,
  signedIn,
  onScopeChange,
}: Pick<ScopeBarProps, 'scope' | 'results' | 'signedIn' | 'onScopeChange'>) {
  return (
    <div className="dirsearch-filters">
      <div className="container mx-auto px-4">
        <div className="dirsearch-filterrow">
          <span className="dirsearch-filterlabel">Scope</span>
          <div className="dirsearch-chiprow">
            {SCOPES.map((option) => {
              const gated = SCOPE_REQUIRES_PANA[option] && !signedIn;
              const Icon = option === 'all' ? null : KIND_ICON[option];
              // Counts come from the same query that renders the list, so a
              // chip cannot advertise a number the page will not produce.
              const count = countFor(results, option);

              return (
                <button
                  key={option}
                  type="button"
                  className="dirsearch-chip inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                  data-on={option === scope}
                  disabled={gated}
                  onClick={() => onScopeChange(option)}
                  title={gated ? 'Sign in as a pana to search members' : undefined}
                >
                  {gated ? (
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {SCOPE_LABEL[option]}
                  {!gated && <span className="opacity-55">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
