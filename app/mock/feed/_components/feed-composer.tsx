'use client';

import Image from 'next/image';
import {
  Calendar,
  ChevronDown,
  Globe2,
  ImagePlus,
  MapPin,
  Mic,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOCK_VIEWER, type FeedState } from '../_data/mock-feed';

/* The composer at the top of the feed.
 *
 * The production feed puts a bare `+` button in the bottom-right corner, which
 * is a mobile pattern borrowed onto a desktop page: it hides the single most
 * important action behind an unlabelled icon that says nothing about what you
 * can post. This is the opposite — an open box, addressed to the reader by
 * name, with every post type named next to it.
 *
 * The chips are not decoration either. Voice memos and group posts already
 * exist in the schema and nobody finds them, because there is currently no
 * surface that mentions them.
 *
 * It renders in the empty state too. A new account is told to post — removing
 * the box it would post in is how an onboarding step becomes a dead end. Only
 * the reach line changes, because zero Panas is the truth at that point and
 * the county timeline is the honest answer to "who sees this". */
export function FeedComposer({ state = 'populated' }: { state?: FeedState }) {
  const isNew = state === 'empty';

  return (
    <div className="feed-composer">
      <div className="flex items-start gap-3">
        <div className="border-pana-ink/10 relative h-10 w-10 flex-none overflow-hidden rounded-full border-2">
          <Image
            src={MOCK_VIEWER.avatar}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <label htmlFor="feed-composer-input" className="sr-only">
            Write a post
          </label>
          <textarea
            id="feed-composer-input"
            rows={2}
            className="feed-composer-prompt"
            placeholder={`¿Qué tal, ${MOCK_VIEWER.name.split(' ')[0]}? Ask the Panas something, or show what you're working on.`}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-13">
        <button type="button" className="composer-chip">
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          Photo
        </button>
        <button type="button" className="composer-chip">
          <Mic className="h-3.5 w-3.5" aria-hidden="true" />
          Voice memo
        </button>
        <button type="button" className="composer-chip">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          Event
        </button>
        <button type="button" className="composer-chip">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          Place
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* Visibility is a first-class control rather than a setting buried
              in a menu: on a local network people are posting to a county they
              live in, and they should always be able to see who that is. */}
          <button type="button" className="composer-chip">
            <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
            Everyone
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </button>
          <Button
            size="sm"
            className="bg-pana-indigo text-pana-cream hover:bg-pana-indigo/90 rounded-full px-5 font-extrabold"
          >
            Post
          </Button>
        </div>
      </div>

      <p className="text-pana-ink/50 mt-2.5 text-[12px] font-bold sm:pl-13">
        <Users
          className="mr-1 inline h-3 w-3 align-[-1px]"
          aria-hidden="true"
        />
        {isNew
          ? `Posting to the ${MOCK_VIEWER.county} timeline — anyone nearby can see this`
          : `Posting to ${MOCK_VIEWER.panas.toLocaleString('en-US')} Panas and ${MOCK_VIEWER.groups} groups`}
      </p>
    </div>
  );
}
