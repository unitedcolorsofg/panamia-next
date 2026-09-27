'use client';

import { ChevronDown, Check } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

export interface FilterMenuOption {
  value: string;
  label: string;
  /** Second line under the label, for options whose name is not self-evident. */
  hint?: string;
  /** Disables the row and explains why on hover. */
  disabledReason?: string;
}

interface FilterMenuProps {
  /** The word on the closed trigger — "Category", "Where", "Sort". */
  label: string;
  options: FilterMenuOption[];
  /** Selected values. Single-select menus pass an array of one. */
  selected: string[];
  onChange: (next: string[]) => void;
  /** Radio behaviour, for menus like Sort where exactly one answer is true. */
  single?: boolean;
  /**
   * The value a single-select menu holds when nobody has touched it. Sort
   * always has an answer, so without this it would render permanently filled
   * and "active" would stop meaning anything across the row.
   */
  defaultValue?: string;
  /** Shown above the options when the menu is open. */
  caption?: ReactNode;
}

/**
 * One filter, folded up until asked for.
 *
 * The bar this belongs to used to lay every choice out as chips, and the
 * comment on FilterBar still argues for that: a "Filters" button costs two
 * clicks before you learn the directory has categories at all, and hides
 * which ones are on once it closes.
 *
 * That argument was right about the failure mode and wrong about the cause.
 * The problem with a filter dialog is not that it folds — it is that it folds
 * *everything*, including the answer. Three chip rows plus a sort row plus a
 * view toggle came to 220px of controls above the first result on a phone,
 * which on an 844px screen left room for roughly one card. The filters were
 * visible and the businesses were not, which inverts what the page is for.
 *
 * So this keeps the two things the chips were good at and drops the third.
 * The trigger names its own state — "Category · 2", "Where · Broward" — so a
 * closed menu still says what it is doing, and any active choice also appears
 * as a removable chip in the row beneath, so clearing one never requires
 * opening anything. What is folded away is only the list of options you are
 * not currently using.
 *
 * Deliberately not <select>: these are multi-select on mobile, where a native
 * multiple select renders as a scrolling list box that is worse than either
 * option. The keyboard contract below is the same one ScopeMenu implements,
 * for the same reason — it is the other menu on this page.
 */
export function FilterMenu({
  label,
  options,
  selected,
  onChange,
  single = false,
  defaultValue,
  caption,
}: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const reachable = options.filter((option) => !option.disabledReason);

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
    window.requestAnimationFrame(() => focusItem(index));
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const toggle = (value: string) => {
    if (single) {
      onChange([value]);
      // A single-answer menu has nothing left to ask once answered.
      close(true);
      return;
    }
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
    );
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      const first = reachable.findIndex((option) =>
        selected.includes(option.value)
      );
      openWith(Math.max(0, first));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openWith(reachable.length - 1);
    }
  };

  const onItemKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
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
        setOpen(false);
        break;
      default:
        break;
    }
  };

  // What the closed trigger says it is doing. One selection is worth naming;
  // past that the name is longer than the button, so it becomes a count.
  const chosen = options.filter((option) => selected.includes(option.value));
  const summary =
    chosen.length === 0
      ? null
      : chosen.length === 1
        ? chosen[0].label
        : String(chosen.length);

  // Filled means "I am changing the results", which a menu sitting on its
  // default is not doing — even though it does have a value to show.
  const active =
    chosen.length > 0 &&
    !(single && defaultValue !== undefined && selected[0] === defaultValue);

  return (
    <div className="dirsearch-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="dirsearch-menubtn"
        data-on={active}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openWith(0))}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="dirsearch-menuname">{label}</span>
        {summary && <span className="dirsearch-menuvalue">{summary}</span>}
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
          aria-label={label}
          className="dirsearch-menupanel"
        >
          {caption && <p className="dirsearch-menucaption">{caption}</p>}

          <div className="dirsearch-menulist">
            {options.map((option) => {
              const on = selected.includes(option.value);
              const index = reachable.indexOf(option);

              return (
                <button
                  key={option.value}
                  ref={(node) => {
                    if (index >= 0) itemRefs.current[index] = node;
                  }}
                  type="button"
                  role={single ? 'menuitemradio' : 'menuitemcheckbox'}
                  aria-checked={on}
                  disabled={Boolean(option.disabledReason)}
                  title={option.disabledReason}
                  className="dirsearch-menuitem"
                  data-on={on}
                  onClick={() => toggle(option.value)}
                  onKeyDown={(event) => onItemKeyDown(event, index)}
                >
                  <span className="dirsearch-menutick" aria-hidden="true">
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="dirsearch-menulabel">{option.label}</span>
                    {option.hint && (
                      <span className="dirsearch-menuhint">{option.hint}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Only offered when there is something to clear, and only on the
              multi-select menus — "no sort" is not a state this page has. */}
          {!single && chosen.length > 0 && (
            <button
              type="button"
              className="dirsearch-menuclear"
              onClick={() => onChange([])}
            >
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
