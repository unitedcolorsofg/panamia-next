'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, ChevronDown, ExternalLink, Settings } from 'lucide-react';
import {
  MOCK_MEMBER,
  SHARED_ROOMS,
  SURFACE_BLURB,
  SURFACE_TONE,
  type MockSurface,
} from '../_data/panaverse';

/* The panaverse switcher.
 *
 * The problem it solves is not navigation — a link would do that. It is that
 * panamia.club and social.panamia.club are different origins, so without
 * something saying otherwise, arriving at the second one reads as having been
 * handed off to a different company's product. That is the exact failure the
 * current embedded feed already has.
 *
 * So the switcher leads with identity rather than with a list of links. The
 * first thing in the panel is who you are and the handle that is the same in
 * every room; the destinations come after. An app-grid of equal tiles — the
 * pattern this could easily have been — says "here are our products". This
 * says "here is you, and here is where you can take yourself".
 *
 * Rooms are listed below surfaces and styled differently on purpose. They are
 * real, shipped features that live on the main site, and flattening them into
 * the same list as the surfaces would imply a hostname they do not have. */
export function SurfaceSwitcher({
  surfaces,
  currentId,
  onSelect,
}: {
  surfaces: MockSurface[];
  currentId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current =
    surfaces.find((surface) => surface.id === currentId) ?? surfaces[0];

  /* Dismiss on outside click and on Escape. A switcher that traps you inside
     it is a worse version of the problem it exists to solve. */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="surface-switcher" ref={rootRef}>
      <button
        type="button"
        className="surface-pill"
        data-tone={SURFACE_TONE[current.id]}
        aria-expanded={open}
        aria-haspopup="menu"
        /* Named explicitly because the visible label is hidden below 480px to
           keep the masthead from overflowing. Without this the button would
           lose its accessible name at exactly the width where the surrounding
           context is thinnest. */
        aria-label={`Switch surface, currently ${current.name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="surface-dot" aria-hidden="true" />
        <span className="surface-pill-name">{current.name}</span>
        <ChevronDown
          className="h-3.5 w-3.5 flex-none transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="surface-panel" role="menu" aria-label="Panaverse">
          {/* Identity first. The handle is the load-bearing element: it is
              pinned to the fediverse domain, so it is genuinely the same
              string on every surface and in every other fediverse server. */}
          <div className="surface-panel-identity">
            <Image
              src={MOCK_MEMBER.avatar}
              alt=""
              width={44}
              height={44}
              className="chrome-avatar h-11 w-11 flex-none"
            />
            <div className="min-w-0">
              <p className="surface-identity-name truncate">
                {MOCK_MEMBER.name}
              </p>
              <p className="surface-identity-handle truncate">
                {MOCK_MEMBER.fediverseHandle}
              </p>
            </div>
          </div>

          <p className="surface-panel-note">
            One Pana account. Same you in every room.
          </p>

          <div className="surface-panel-group">
            {surfaces.map((surface) => {
              const isCurrent = surface.id === current.id;
              return (
                <button
                  key={surface.id}
                  type="button"
                  role="menuitem"
                  className="surface-option"
                  data-tone={SURFACE_TONE[surface.id]}
                  data-current={isCurrent}
                  onClick={() => {
                    onSelect(surface.id);
                    setOpen(false);
                  }}
                >
                  <span className="surface-dot mt-1" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="surface-option-head">
                      <span className="surface-option-name">
                        {surface.name}
                      </span>
                      {isCurrent ? (
                        <span className="surface-here">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          You&apos;re here
                        </span>
                      ) : (
                        <ExternalLink
                          className="text-pana-ink/35 ml-auto h-3.5 w-3.5 flex-none"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="surface-option-blurb">
                      {SURFACE_BLURB[surface.id]}
                    </span>
                    <span className="surface-host">{surface.hostname}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Rooms. Deliberately quieter than the surfaces above: these are
              real and shipped, but they live on the main site, and giving them
              equal weight would promise a front door that does not exist. */}
          <div className="surface-panel-group">
            <p className="surface-panel-label">Also on Pana Mia</p>
            {SHARED_ROOMS.map((room) => (
              <button
                key={room.path}
                type="button"
                role="menuitem"
                className="surface-room"
                data-tone={room.tone}
              >
                <span className="surface-dot" aria-hidden="true" />
                <span className="surface-room-name">{room.name}</span>
                <span className="surface-room-blurb">{room.blurb}</span>
              </button>
            ))}
          </div>

          {/* One settings page for the whole panaverse. Per-surface settings
              would mean a member has to remember which room they changed their
              email in. */}
          <a href="#" className="surface-panel-footer">
            <Settings className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
            Account settings
            <span className="text-pana-ink/45 ml-auto text-[11px] font-bold">
              Applies everywhere
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
