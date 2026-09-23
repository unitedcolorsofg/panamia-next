'use client';

import { useEffect, useState } from 'react';
import {
  AtSign,
  Database,
  KeyRound,
  MapPin,
  Megaphone,
  Scale,
} from 'lucide-react';
import { SETTINGS_SECTIONS, type SectionId } from '../_data/mock-settings';

const SECTION_ICONS: Record<SectionId, typeof AtSign> = {
  identity: AtSign,
  signin: KeyRound,
  place: MapPin,
  publishing: Scale,
  messages: Megaphone,
  data: Database,
};

/* The section nav.
 *
 * The page it replaces had no navigation at all: six unrelated concerns in two
 * cards, four of them collapsed inside one accordion row labelled "Advanced
 * Settings". You could not see what the page contained without opening it, and
 * opening it told you nothing about where you were.
 *
 * So the nav's real job is the table of contents, not the jumping. It is a
 * column of rules in the margin rather than a filled sidebar, because a solid
 * panel at this width reads as app chrome, and app chrome is the register the
 * redesign is trying to leave. Below the lg breakpoint it becomes a scrolling
 * row above the content — still the whole list, still in order. */
export function SettingsNav() {
  const [active, setActive] = useState<SectionId>(SETTINGS_SECTIONS[0].id);

  /* Tracked rather than set on click. A sticky nav that only updates when you
     use it is lying for as long as you scroll by hand, and scrolling by hand
     is how most of this page gets read. */
  useEffect(() => {
    const nodes = SETTINGS_SECTIONS.map((section) =>
      document.getElementById(section.id)
    ).filter((node): node is HTMLElement => node !== null);

    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        /* The topmost section currently crossing the band below the masthead
           wins. Taking the first intersecting entry in document order avoids
           the flicker you get from reacting to whichever entry fired last. */
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) setActive(visible[0].target.id as SectionId);
      },
      /* A band just under the sticky masthead, not the whole viewport: with a
         full viewport every long section would match at once.

         Pixels, not rem — rootMargin only parses px and %, and a rem value
         throws rather than degrading. 96px is the 6rem the sections reserve
         via scroll-margin-top. */
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      className="settings-nav -mx-1 px-1 lg:sticky lg:top-24 lg:mx-0 lg:px-0"
      aria-label="Settings sections"
    >
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section.id];
        const isActive = section.id === active;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="settings-nav-item"
            data-active={isActive}
            aria-current={isActive ? 'true' : undefined}
          >
            <Icon className="h-4 w-4 flex-none" aria-hidden="true" />
            <span className="whitespace-nowrap">{section.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
