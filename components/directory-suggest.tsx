'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Search, Store, User, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { searchPath } from '@/lib/directory-search-path';
import {
  MIN_TERM_LENGTH,
  kindLabelKey,
  type Suggestion,
  type SuggestionKind,
} from '@/lib/suggest';

export type { Suggestion as DirectorySuggestion };

interface DirectorySuggestBaseProps {
  /** Visible-to-screen-readers-only label for the input. */
  label: string;
  placeholder: string;
  ariaLabel: string;
  /** Applied to the <form>, so callers keep control of width and placement. */
  className?: string;
  inputClassName?: string;
}

/**
 * `stacked` (default) puts the button beside the input as its own control.
 * `pill` merges the two into a single rounded bar, as the homepage hero does —
 * the button sits inside the input's surface rather than next to it.
 * `masthead` is the surface header's field: a magnifier and an input in one
 * short bar, with no button at all, because chrome that repeats on every page
 * cannot afford a second control's width.
 *
 * Spelled as a union so the button's label is required exactly when there is a
 * button to put it on — a `masthead` caller has nothing to pass it for, and the
 * other two would otherwise be free to render an unlabelled control.
 */
type DirectorySuggestProps = DirectorySuggestBaseProps &
  (
    | { layout?: 'stacked' | 'pill'; buttonLabel: string }
    | { layout: 'masthead'; buttonLabel?: never }
  );

// Long enough that a fast typist finishes a word first, short enough that the
// list still feels attached to the keystroke.
const DEBOUNCE_MS = 200;

const FALLBACK_IMAGE = '/img/bg_coconut_blue.jpg';

/**
 * The icon that says what a row is.
 *
 * The four kinds are not distinguishable from a name and a photo — a cafe, the
 * pana who runs it, the group they organise in and this Saturday's event can
 * all be called the same thing, and they all lead somewhere different. The
 * icon is what makes the destination legible before the click.
 *
 * Store rather than Building for a business, because the directory is small
 * local trade rather than offices. User/Users keeps the person/people
 * distinction doing the work between a pana and a group, which is the pair
 * most easily confused.
 */
const KIND_ICON: Record<SuggestionKind, LucideIcon> = {
  business: Store,
  pana: User,
  group: Users,
  event: CalendarDays,
};

// Businesses and panas are faces and storefronts, and read as circles
// everywhere else in the product. Groups and events are things rather than
// someone, and a cover image cropped to a circle loses most of itself.
const KIND_IMAGE_SHAPE: Record<SuggestionKind, string> = {
  business: 'rounded-full',
  pana: 'rounded-full',
  group: 'rounded-lg',
  event: 'rounded-lg',
};

/**
 * Search box with a typeahead dropdown over the whole club.
 *
 * Suggests businesses, panas, groups and events in one list. Panas and groups
 * only come back for a signed-in visitor — the API decides that, not this
 * component, so there is nothing here to keep in step with a session.
 *
 * Follows the ARIA combobox-with-listbox pattern: focus never leaves the
 * input, arrow keys move `aria-activedescendant`, and a polite live region
 * announces the result count. The suggestions are a shortcut, not a
 * replacement — the last row and a bare Enter both fall through to the full
 * /directory/search results page.
 *
 * WORKS WITHOUT JAVASCRIPT. The form is a real GET to /directory/search with a
 * real `name="q"`, so a submit before the bundle lands — or on a page with
 * scripting off — is an ordinary document navigation to the query-string form
 * of the results page. Once hydrated, `handleSubmit` preventDefaults and routes
 * to the canonical path form instead, so `action` only ever fires as the
 * fallback. This is what lets the masthead field, which used to be a plain GET
 * form for exactly that reason, become a typeahead without losing anything.
 */
export function DirectorySuggest({
  label,
  placeholder,
  ariaLabel,
  buttonLabel,
  className,
  inputClassName,
  layout = 'stacked',
}: DirectorySuggestProps) {
  const router = useRouter();
  const { t } = useTranslation('common');

  // Ids have to be per-instance: the masthead carries this component on every
  // page of a surface, so a page that also has one in its body would otherwise
  // hold two inputs with one id, and `htmlFor`, `aria-controls` and
  // `aria-activedescendant` would all resolve to whichever came first.
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const optionId = useCallback(
    (index: number) => `${baseId}-option-${index}`,
    [baseId]
  );

  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
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
  }, [open, activeIndex, optionId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * On a phone, pull the search box up to the top of the viewport on focus.
   *
   * The home hero is tall enough that the input lands near the bottom of the
   * fold, leaving no room below it for a dropdown. Browsers do scroll a focused
   * input into view when the on-screen keyboard opens, but how much varies by
   * browser, so this makes the room deterministically rather than hoping.
   *
   * Not in the masthead, which is sticky at the top of the viewport already:
   * there the field cannot be any higher than it is, and scrolling to it would
   * throw the page back to the top for nothing.
   */
  function revealOnSmallScreens() {
    if (layout === 'masthead') return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goToSearch() {
    if (!trimmed) return;
    close();
    router.push(searchPath(trimmed));
  }

  function goToSuggestion(suggestion: Suggestion) {
    close();
    setTerm(suggestion.name);
    router.push(suggestion.href);
  }

  function selectIndex(index: number) {
    if (index === searchRowIndex) {
      goToSearch();
      return;
    }
    const suggestion = suggestions[index];
    if (suggestion) goToSuggestion(suggestion);
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

  /**
   * The wiring every layout's input needs.
   *
   * Kept in one object because two layouts render the styled `Input` and the
   * masthead renders a bare `<input>` — the shadcn defaults are a bordered
   * 40px box, which is the opposite of a field that has to disappear into a
   * 34px pill. The ARIA that makes this a combobox is exactly the part that
   * must not drift between the two, so it is written once.
   */
  const inputProps: React.ComponentProps<'input'> = {
    id: inputId,
    type: 'text',
    // A real field name, for the no-JS GET on the form above. Matches the ?q=
    // spelling the results page already accepts.
    name: 'q',
    role: 'combobox',
    autoComplete: 'off',
    // Mobile keyboard hints. type="search" would add a native clear button
    // that sits on top of the dropdown, so the search affordance comes from
    // enterKeyHint instead. Autocorrect on a directory of proper nouns does
    // more harm than good.
    enterKeyHint: 'search',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    'aria-expanded': showList,
    'aria-controls': listboxId,
    'aria-autocomplete': 'list',
    'aria-activedescendant':
      showList && activeIndex >= 0 ? optionId(activeIndex) : undefined,
    value: term,
    onChange: (event) => {
      setTerm(event.target.value);
      setOpen(true);
      setActiveIndex(-1);
    },
    onKeyDown: handleKeyDown,
    onFocus: () => {
      if (trimmed.length >= MIN_TERM_LENGTH) setOpen(true);
      revealOnSmallScreens();
    },
    placeholder,
    'aria-label': ariaLabel,
  };

  return (
    <form
      ref={rootRef}
      role="search"
      // The fallback path, not the normal one: `handleSubmit` preventDefaults
      // once hydrated. Until then this is a plain GET to the query-string form
      // of the results page, which is what the field does with scripting off.
      action="/directory/search"
      method="get"
      onSubmit={handleSubmit}
      // scroll-mt clears the sticky site header when revealOnSmallScreens runs.
      className={cn('scroll-mt-24', className)}
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div
        className={
          layout === 'pill'
            ? 'directory-suggest-pill'
            : layout === 'masthead'
              ? // `contents` rather than a box: the masthead pill is itself the
                // flex row, sized and padded by `.panaverse-search`, and this
                // wrapper exists only because the other two layouts need one.
                // Dissolving it leaves the icon and the field as that row's own
                // children, which is the markup the stylesheet was written for.
                'contents'
              : 'flex flex-col items-center justify-center gap-4 md:flex-row'
        }
      >
        {/* A magnifier at the head of the pill. The button already says
            "Search", but it sits at the far right of a 720px bar, so on a
            wide screen the left end of the field has nothing on it saying
            what it is. Pill layout only: the stacked layout puts the icon on
            the button instead, where that field is narrow enough not to need
            one. */}
        {layout === 'pill' && (
          <Search
            className="text-pana-ink ml-6 h-5 w-5 shrink-0 opacity-45"
            aria-hidden="true"
          />
        )}

        {/* The masthead has no button at all, so its magnifier is the only
            thing saying what the bar is. */}
        {layout === 'masthead' && (
          <Search className="panaverse-search-icon" aria-hidden="true" />
        )}

        {/* `directory-suggest-field` rather than a positional selector: the
            icon above is now the pill's first child, so the stylesheet needs
            to name the field to keep the dropdown anchored to the whole pill
            instead of to the magnifier. */}
        <div className="directory-suggest-field relative w-full">
          {layout === 'masthead' ? (
            <input
              {...inputProps}
              className={cn('panaverse-search-input', inputClassName)}
            />
          ) : (
            <Input {...inputProps} className={inputClassName} />
          )}
          {showList && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label={label}
              // Height is capped rather than left to the row count: a full ten
              // rows is taller than a phone viewport once the keyboard is up,
              // which buried the "search for this term" row below the fold.
              // Scrolls internally instead, and overscroll-contain stops that
              // scroll from chaining to the page behind it.
              // The class carries no styles of its own; it is the hook the
              // home hero uses to drop its own clip while this panel is open.
              // See `.home-hero-banner:has(.directory-suggest-list)`.
              className="directory-suggest-list bg-popover text-popover-foreground absolute top-full right-0 left-0 z-50 mt-2 max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain rounded-xl border shadow-lg"
            >
              {suggestions.map((suggestion, index) => {
                const KindIcon = KIND_ICON[suggestion.kind];
                const kindLabel = t(kindLabelKey(suggestion.kind));
                return (
                  <li
                    // Ids are only unique within their own table, so the kind
                    // has to be part of the key — an event and a profile can
                    // hold the same cuid.
                    key={`${suggestion.kind}:${suggestion.id}`}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    // Pointer-down rather than click: click fires after blur,
                    // and the outside-click handler would have closed the list
                    // first.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      goToSuggestion(suggestion);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3 py-2 text-left',
                      index === activeIndex && 'bg-accent'
                    )}
                  >
                    <span className="relative shrink-0">
                      <img
                        src={suggestion.imageUrl || FALLBACK_IMAGE}
                        alt=""
                        aria-hidden="true"
                        className={cn(
                          'h-10 w-10 object-cover',
                          KIND_IMAGE_SHAPE[suggestion.kind]
                        )}
                      />
                      {/* The badge sits in the same corner on every row, so
                          the kind can be read down the list in one pass rather
                          than found separately on each. Its own background and
                          ring keep it legible over a photo of anything. */}
                      <span
                        className="bg-background ring-background absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full shadow-sm ring-2"
                        aria-hidden="true"
                      >
                        <KindIcon className="h-3 w-3" />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {suggestion.name}
                      </span>
                      {suggestion.subtitle && (
                        <span className="text-muted-foreground block truncate text-sm">
                          {suggestion.subtitle}
                        </span>
                      )}
                    </span>
                    {/* The word behind the icon. Sighted users have the badge;
                        without this a screen reader hears four identically
                        shaped rows and no way to tell a pana from an event. */}
                    <span className="sr-only">{kindLabel}</span>
                  </li>
                );
              })}

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
                // ten suggestions. py-3 keeps it at a 44px touch target.
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

        {/* No button in the masthead: chrome that repeats on every page of a
            surface cannot spend the width, and the magnifier plus Enter are
            what a header search is expected to answer to anyway. */}
        {layout !== 'masthead' && (
          <Button
            type="submit"
            size="lg"
            className={
              layout === 'pill' ? 'directory-suggest-pill-button' : 'px-8'
            }
          >
            {/* The pill layout is text-only, as in the mock — the bar itself
                already reads as a search field. */}
            {layout === 'stacked' && (
              <Search className="mr-2 h-5 w-5" aria-hidden="true" />
            )}
            {buttonLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
