'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  FlaskConical,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  ShieldCheck,
} from 'lucide-react';
import { ScopeBar, ScopeChips } from './scope-bar';
import {
  BusinessCard,
  EventCard,
  GroupCard,
  KIND_ICON,
  PanaCard,
} from './scope-cards';
import { businessEntries, eventEntries, ScopeMap } from './scope-map';
import {
  countFor,
  runQuery,
  SCOPE_HAS_MAP,
  SCOPE_LABEL,
  type Scope,
  type ScopeResults,
} from '../_data';

type View = 'list' | 'map';

/** How many of each kind the Everything scope shows before it defers. */
const PREVIEW_LIMIT = 3;

export function DirectoryScopesMock() {
  const [signedIn, setSignedIn] = useState(true);
  const [locationShared, setLocationShared] = useState(true);
  const [term, setTerm] = useState('art');
  const [scope, setScope] = useState<Scope>('all');
  const [view, setView] = useState<View>('list');

  const results = useMemo(() => runQuery(term, signedIn), [term, signedIn]);

  const handleSignedInChange = (next: boolean) => {
    setSignedIn(next);
    // Signing out with the Panas scope open would leave the page on a scope
    // that is no longer allowed to return anything. Fall back rather than
    // render an empty state that blames the search term.
    if (!next && scope === 'pana') setScope('all');
  };

  const handleScopeChange = (next: Scope) => {
    setScope(next);
    // Map is not offered for panas or groups, so a scope change has to clear
    // it — otherwise the toggle stays lit over a view that cannot be drawn.
    if (!SCOPE_HAS_MAP[next]) setView('list');
  };

  return (
    <>
      <MockBar
        signedIn={signedIn}
        locationShared={locationShared}
        onSignedInChange={handleSignedInChange}
        onLocationChange={setLocationShared}
      />

      <ScopeBar
        term={term}
        scope={scope}
        results={results}
        signedIn={signedIn}
        onSearch={setTerm}
        onScopeChange={handleScopeChange}
      />

      <ScopeChips
        scope={scope}
        results={results}
        signedIn={signedIn}
        onScopeChange={handleScopeChange}
      />

      <section className="surface-cream dirsearch-results">
        <div className="container mx-auto px-4">
          <ScopeToolsLine
            scope={scope}
            results={results}
            view={view}
            onViewChange={setView}
          />

          {countFor(results, scope) === 0 ? (
            <EmptyScope scope={scope} term={term} onScopeChange={handleScopeChange} />
          ) : scope === 'all' ? (
            <EverythingView
              results={results}
              locationShared={locationShared}
              onScopeChange={handleScopeChange}
            />
          ) : (
            <ScopedView
              scope={scope}
              results={results}
              view={view}
              locationShared={locationShared}
            />
          )}
        </div>
      </section>

      <MockFooterNote />
    </>
  );
}

/* --------------------------------------------------------------- tools row */

function ScopeToolsLine({
  scope,
  results,
  view,
  onViewChange,
}: {
  scope: Scope;
  results: ScopeResults;
  view: View;
  onViewChange: (view: View) => void;
}) {
  const count = countFor(results, scope);
  if (count === 0) return null;

  return (
    <div className="dirsearch-toolsline mb-5">
      <p className="dirsearch-summary">
        {scope === 'all'
          ? 'Grouped by kind — pick a scope to go deeper'
          : `${count} ${SCOPE_LABEL[scope].toLowerCase()}`}
      </p>

      {SCOPE_HAS_MAP[scope] ? (
        <div className="dirsearch-viewtoggle">
          <button
            type="button"
            data-on={view === 'list'}
            aria-pressed={view === 'list'}
            onClick={() => onViewChange('list')}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            List
          </button>
          <button
            type="button"
            data-on={view === 'map'}
            aria-pressed={view === 'map'}
            onClick={() => onViewChange('map')}
          >
            <MapIcon className="h-4 w-4" aria-hidden="true" />
            Map
          </button>
        </div>
      ) : (
        /* No toggle at all, rather than a disabled one. A greyed-out Map
           button invites the question "why not?" on every search; the reason
           is structural and unchanging, so it is stated once in words. */
        <p className="dirsearch-card-active">
          {scope === 'pana' ? (
            <>
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              Panas are not mapped — personal accounts do not store an address
            </>
          ) : scope === 'group' ? (
            <>Groups have no location — they are not mapped</>
          ) : null}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- all-in-one */

function EverythingView({
  results,
  locationShared,
  onScopeChange,
}: {
  results: ScopeResults;
  locationShared: boolean;
  onScopeChange: (scope: Scope) => void;
}) {
  return (
    <div className="flex flex-col gap-9">
      <KindSection
        kind="business"
        total={results.business.length}
        onScopeChange={onScopeChange}
      >
        {results.business.slice(0, PREVIEW_LIMIT).map((result) => (
          <li key={result.id}>
            <BusinessCard result={result} showKind locationShared={locationShared} />
          </li>
        ))}
      </KindSection>

      <KindSection kind="pana" total={results.pana.length} onScopeChange={onScopeChange}>
        {results.pana.slice(0, PREVIEW_LIMIT).map((result) => (
          <li key={result.id}>
            <PanaCard result={result} showKind locationShared={locationShared} />
          </li>
        ))}
      </KindSection>

      <KindSection kind="group" total={results.group.length} onScopeChange={onScopeChange}>
        {results.group.slice(0, PREVIEW_LIMIT).map((result) => (
          <li key={result.id}>
            <GroupCard result={result} showKind locationShared={locationShared} />
          </li>
        ))}
      </KindSection>

      <KindSection kind="event" total={results.event.length} onScopeChange={onScopeChange}>
        {results.event.slice(0, PREVIEW_LIMIT).map((result) => (
          <li key={result.id}>
            <EventCard result={result} showKind locationShared={locationShared} />
          </li>
        ))}
      </KindSection>
    </div>
  );
}

/**
 * One kind's slice of the Everything view.
 *
 * Everything is a router, not a results page. It shows enough of each kind to
 * prove the kind is there and then hands off, because the four kinds want
 * genuinely different views — a map for businesses and events, a member list
 * for panas — and trying to serve all four at once produces a page that
 * serves none of them.
 */
function KindSection({
  kind,
  total,
  onScopeChange,
  children,
}: {
  kind: Exclude<Scope, 'all'>;
  total: number;
  onScopeChange: (scope: Scope) => void;
  children: React.ReactNode;
}) {
  if (total === 0) return null;
  const Icon = KIND_ICON[kind];
  const shown = Math.min(total, PREVIEW_LIMIT);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-tight">
          <Icon className="h-5 w-5 shrink-0 opacity-60" aria-hidden="true" />
          {SCOPE_LABEL[kind]}
        </h2>
        <span className="dirsearch-card-active">
          {shown === total ? `${total}` : `${shown} of ${total}`}
        </span>
        {total > PREVIEW_LIMIT && (
          <button
            type="button"
            className="dirsearch-view ml-auto"
            onClick={() => onScopeChange(kind)}
          >
            All {total} {SCOPE_LABEL[kind].toLowerCase()}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className="dirsearch-grid">{children}</ul>
    </section>
  );
}

/* ------------------------------------------------------------ single scope */

function ScopedView({
  scope,
  results,
  view,
  locationShared,
}: {
  scope: Exclude<Scope, 'all'>;
  results: ScopeResults;
  view: View;
  locationShared: boolean;
}) {
  if (scope === 'business') {
    return view === 'map' ? (
      <ScopeMap
        entries={businessEntries(results.business)}
        locationShared={locationShared}
        viewerPlace="Wynwood"
        offMapNoun={{ one: 'online-only business', many: 'online-only businesses' }}
        metaIcon="pin"
      />
    ) : (
      <ul className="dirsearch-grid">
        {results.business.map((result) => (
          <li key={result.id}>
            <BusinessCard result={result} showKind={false} locationShared={locationShared} />
          </li>
        ))}
      </ul>
    );
  }

  if (scope === 'event') {
    return view === 'map' ? (
      <ScopeMap
        entries={eventEntries(results.event)}
        locationShared={locationShared}
        viewerPlace="Wynwood"
        offMapNoun={{ one: 'online event', many: 'online events' }}
        metaIcon="calendar"
      />
    ) : (
      <ul className="dirsearch-grid">
        {results.event.map((result) => (
          <li key={result.id}>
            <EventCard result={result} showKind={false} locationShared={locationShared} />
          </li>
        ))}
      </ul>
    );
  }

  if (scope === 'pana') {
    return (
      <ul className="dirsearch-grid">
        {results.pana.map((result) => (
          <li key={result.id}>
            <PanaCard result={result} showKind={false} locationShared={locationShared} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="dirsearch-grid">
      {results.group.map((result) => (
        <li key={result.id}>
          <GroupCard result={result} showKind={false} locationShared={locationShared} />
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ empty */

function EmptyScope({
  scope,
  term,
  onScopeChange,
}: {
  scope: Scope;
  term: string;
  onScopeChange: (scope: Scope) => void;
}) {
  return (
    <div className="dirsearch-empty">
      <p className="dirsearch-empty-title">
        No {scope === 'all' ? 'results' : SCOPE_LABEL[scope].toLowerCase()} for{' '}
        <em>{term}</em>
      </p>
      <p className="dirsearch-empty-lede">
        {scope === 'all'
          ? 'Nothing matched in the directory, in Pana Social, or on the events calendar.'
          : 'The search worked — this scope just has nothing in it. Try another.'}
      </p>
      {scope !== 'all' && (
        <div className="dirsearch-empty-actions">
          <button
            type="button"
            className="dirsearch-empty-primary"
            onClick={() => onScopeChange('all')}
          >
            Search everything instead
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- scaffolding */

function MockBar({
  signedIn,
  locationShared,
  onSignedInChange,
  onLocationChange,
}: {
  signedIn: boolean;
  locationShared: boolean;
  onSignedInChange: (next: boolean) => void;
  onLocationChange: (next: boolean) => void;
}) {
  return (
    <div className="bizprofile-mockbar">
      <div className="container mx-auto flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase opacity-70">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          Design mock
        </span>

        <button
          type="button"
          className="bizprofile-mocktoggle"
          data-on={signedIn}
          aria-pressed={signedIn}
          title="Panas are only searchable by signed-in members"
          onClick={() => onSignedInChange(!signedIn)}
        >
          {!signedIn && <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
          Signed in as a pana
        </button>

        <button
          type="button"
          className="bizprofile-mocktoggle"
          data-on={locationShared}
          aria-pressed={locationShared}
          title="Shows distances on businesses and events"
          onClick={() => onLocationChange(!locationShared)}
        >
          Location shared
        </button>

        <span className="ml-auto hidden text-xs font-semibold opacity-55 lg:inline">
          Scope, search, and the map toggle are live — try them.
        </span>
      </div>
    </div>
  );
}

function MockFooterNote() {
  return (
    <section className="surface-butter dirsearch-tail">
      <div className="container mx-auto px-4">
        <span className="section-eyebrow">About this mock</span>
        <h2 className="section-display">
          One search box, four kinds of answer
        </h2>
        <p className="section-lede">
          <code>/mock/directory-scopes</code> — static fixtures, no database.
          Today the typeahead offers businesses, panas, groups and events, but
          pressing Enter lands on a page that can only return businesses. This
          mock is the proposed fix: the scope you picked comes with you, and
          each kind gets the view its data can actually support.
        </p>
        <div className="dirsearch-tail-actions">
          <Link href="/mock/directory" className="link-arrow">
            Compare with the businesses-only mock
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
