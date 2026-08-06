'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { searchPath } from '@/lib/directory-search-path';

export interface DirectorySuggestion {
  id: string;
  name: string;
  screenname: string;
  primaryImageCdn: string | null;
  addressLocality: string | null;
  fiveWords: string | null;
}

interface DirectorySuggestProps {
  /** Visible-to-screen-readers-only label for the input. */
  label: string;
  placeholder: string;
  ariaLabel: string;
  buttonLabel: string;
  /** Applied to the <form>, so callers keep control of width and placement. */
  className?: string;
  inputClassName?: string;
}

// Matches the API's floor. Below it we never open the list at all.
const MIN_TERM_LENGTH = 2;

// Long enough that a fast typist finishes a word first, short enough that the
// list still feels attached to the keystroke.
const DEBOUNCE_MS = 200;

const FALLBACK_IMAGE = '/img/bg_coconut_blue.jpg';

const LISTBOX_ID = 'directory-suggest-listbox';
const optionId = (index: number) => `directory-suggest-option-${index}`;

/**
 * Directory search box with a typeahead dropdown.
 *
 * Follows the ARIA combobox-with-listbox pattern: focus never leaves the
 * input, arrow keys move `aria-activedescendant`, and a polite live region
 * announces the result count. The suggestions are a shortcut, not a
 * replacement — the last row and a bare Enter both fall through to the full
 * /directory/search results page.
 */
export function DirectorySuggest({
  label,
  placeholder,
  ariaLabel,
  buttonLabel,
  className,
  inputClassName,
}: DirectorySuggestProps) {
  const router = useRouter();
  const { t } = useTranslation('common');

  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState<DirectorySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  // -1 means "nothing highlighted": Enter then submits the typed term rather
  // than picking a row the visitor never moved to.
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLFormElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmed = term.trim();
  // The trailing "search for this term" row is an option too, so it can be
  // arrowed to and is counted in the keyboard bounds below.
  const optionCount = suggestions.length + 1;
  const searchRowIndex = suggestions.length;

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // Fetch suggestions, debounced. Every run aborts the previous request, so a
  // slow response for "da" can't land after a fast one for "dana" and repaint
  // the list with stale rows.
  useEffect(() => {
    if (trimmed.length < MIN_TERM_LENGTH) {
      abortRef.current?.abort();
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `/api/directory/suggest?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const body = await response.json();
        setSuggestions(body.success ? (body.data ?? []) : []);
        setActiveIndex(-1);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        // The box still submits without suggestions, so a failed lookup just
        // empties the list instead of surfacing an error.
        setSuggestions([]);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  // Close on an outside click. Blur alone isn't enough — clicking an option is
  // itself a blur, and the option's own handler needs to win.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, close]);

  // Keep the highlighted row visible. Focus never moves off the input, so the
  // browser does no scrolling of its own — without this, arrowing past the
  // capped height would move an activedescendant nobody can see.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * On a phone, pull the search box up to the top of the viewport on focus.
   *
   * The home hero is tall enough that the input lands near the bottom of the
   * fold, leaving no room below it for a dropdown. Browsers do scroll a focused
   * input into view when the on-screen keyboard opens, but how much varies by
   * browser, so this makes the room deterministically rather than hoping.
   */
  function revealOnSmallScreens() {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goToSearch() {
    if (!trimmed) return;
    close();
    router.push(searchPath(trimmed));
  }

  function goToProfile(suggestion: DirectorySuggestion) {
    close();
    setTerm(suggestion.name);
    router.push(`/p/${suggestion.screenname}`);
  }

  function selectIndex(index: number) {
    if (index === searchRowIndex) {
      goToSearch();
      return;
    }
    const suggestion = suggestions[index];
    if (suggestion) goToProfile(suggestion);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (open && activeIndex >= 0) {
      selectIndex(activeIndex);
      return;
    }
    goToSearch();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open && trimmed.length >= MIN_TERM_LENGTH) {
          setOpen(true);
          setActiveIndex(0);
          return;
        }
        setActiveIndex((index) => (index + 1) % optionCount);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) return;
        setActiveIndex((index) =>
          index <= 0 ? optionCount - 1 : (index - 1) % optionCount
        );
        return;
      case 'Escape':
        // Only swallow the key when there is a popup to dismiss, so Escape
        // keeps its native "clear the search input" behavior otherwise.
        if (open) {
          event.preventDefault();
          close();
        }
        return;
      case 'Tab':
        close();
        return;
      default:
    }
  }

  const showList = open && trimmed.length >= MIN_TERM_LENGTH;

  return (
    <form
      ref={rootRef}
      role="search"
      onSubmit={handleSubmit}
      // scroll-mt clears the sticky site header when revealOnSmallScreens runs.
      className={cn('scroll-mt-24', className)}
    >
      <label htmlFor="directory-suggest-input" className="sr-only">
        {label}
      </label>
      <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
        <div className="relative w-full">
          <Input
            id="directory-suggest-input"
            type="text"
            role="combobox"
            autoComplete="off"
            // Mobile keyboard hints. type="search" would add a native clear
            // button that sits on top of the dropdown, so the search affordance
            // comes from enterKeyHint instead. Autocorrect on a directory of
            // proper nouns does more harm than good.
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-expanded={showList}
            aria-controls={LISTBOX_ID}
            aria-autocomplete="list"
            aria-activedescendant={
              showList && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (trimmed.length >= MIN_TERM_LENGTH) setOpen(true);
              revealOnSmallScreens();
            }}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className={inputClassName}
          />

          {showList && (
            <ul
              id={LISTBOX_ID}
              role="listbox"
              aria-label={label}
              // Height is capped rather than left to the row count: a full
              // eight rows is taller than a phone viewport once the keyboard
              // is up, which buried the "search for this term" row below the
              // fold. Scrolls internally instead, and overscroll-contain stops
              // that scroll from chaining to the page behind it.
              className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-50 mt-2 max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain rounded-xl border shadow-lg"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  // Pointer-down rather than click: click fires after blur, and
                  // the outside-click handler would have closed the list first.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    goToProfile(suggestion);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2 text-left',
                    index === activeIndex && 'bg-accent'
                  )}
                >
                  <img
                    src={suggestion.primaryImageCdn || FALLBACK_IMAGE}
                    alt=""
                    aria-hidden="true"
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {suggestion.name}
                    </span>
                    {(suggestion.fiveWords || suggestion.addressLocality) && (
                      <span className="text-muted-foreground block truncate text-sm">
                        {[suggestion.fiveWords, suggestion.addressLocality]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </span>
                </li>
              ))}

              <li
                id={optionId(searchRowIndex)}
                role="option"
                aria-selected={activeIndex === searchRowIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  goToSearch();
                }}
                onMouseEnter={() => setActiveIndex(searchRowIndex)}
                // Pinned to the bottom of the scroll area so the escape hatch
                // to the full results page is reachable without scrolling past
                // eight suggestions. py-3 keeps it at a 44px touch target.
                className={cn(
                  'bg-popover sticky bottom-0 flex cursor-pointer items-center gap-2 px-3 py-3 text-left text-sm',
                  suggestions.length > 0 && 'border-t',
                  activeIndex === searchRowIndex && 'bg-accent'
                )}
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {t('search.searchFor', { term: trimmed })}
                </span>
              </li>
            </ul>
          )}

          {/* Screen readers get the count; sighted users get the list itself. */}
          <div role="status" aria-live="polite" className="sr-only">
            {showList
              ? t('search.resultsAvailable', { count: suggestions.length })
              : ''}
          </div>
        </div>

        <Button type="submit" size="lg" className="px-8">
          <Search className="mr-2 h-5 w-5" aria-hidden="true" />
          {buttonLabel}
        </Button>
      </div>
    </form>
  );
}
