'use client';

import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { NoteBlock, StoryBeat } from './content';
import { BeatSceneArt } from './beat-scenes';
import { RailNav, useRail } from './rail';

interface StoryBeatsProps {
  beats: StoryBeat[];
}

/**
 * Three places on the street, answering the three questions every new visitor
 * has, in the order they have them.
 *
 * Today this content exists on the homepage, but it is buried in a nine-row
 * FAQ accordion near the bottom — below the directory index, Featured Panas,
 * events, articles and the impact band. Someone who lands on panamia.club not
 * knowing what a pana is has to scroll past everything the site sells before
 * finding out what it is selling.
 *
 * So the answers come up to second position, directly under the search, and
 * all three fit one screen: three shopfronts on a block rather than three
 * full-width stops stacked down the page. Three questions that a visitor is
 * weighing against each other should be visible at the same time — stacked,
 * the third one was 1,700px below the first and most people never learned it
 * was there.
 *
 * Below 60rem the block becomes a horizontal rail with the next card showing
 * at the edge. Nothing here requires a click: the face of each stop answers
 * its question outright, and opening one draws the deck's full text over the
 * shop window. That is a different promise from an accordion, where the click
 * *is* the answer.
 */
export function StoryBeats({ beats }: StoryBeatsProps) {
  // Independent, not one-at-a-time. These are three separate questions, and a
  // visitor comparing "what is a pana" against "why local" should not have to
  // keep closing one to read the other.
  const [open, setOpen] = useState<string[]>([]);

  const { railRef, rail, syncRail, nudge } = useRail<HTMLDivElement>('.beat');
  const toggleRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const toggle = (id: string) =>
    setOpen((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );

  const close = (id: string) => {
    setOpen((prev) => prev.filter((item) => item !== id));
    // Back to the control that opened it, rather than dumping focus at the
    // top of the document.
    toggleRefs.current[id]?.focus();
  };

  return (
    <div className="beats-rail">
      <div className="beats" ref={railRef} onScroll={syncRail}>
        {beats.map((beat) => {
          const isOpen = open.includes(beat.id);
          return (
            <section
              key={beat.id}
              id={beat.anchor}
              className="beat"
              data-side={beat.side}
              data-accent={beat.accent}
            >
              <div className="beat-art" data-rv>
                <BeatSceneArt scene={beat.scene} />
              </div>

              <div className="beat-copy" data-rv>
                {/* The question is hung like a shop sign rather than set as a
                    heading, because on a street that is what it is. It stays a
                    real h3 underneath. */}
                <h3 className="beat-sign">{beat.question}</h3>

                {beat.aside && <p className="beat-aside">{beat.aside}</p>}
                <p className="beat-answer">{beat.answer}</p>

                <button
                  type="button"
                  className="beat-toggle"
                  ref={(node) => {
                    toggleRefs.current[beat.id] = node;
                  }}
                  aria-expanded={isOpen}
                  aria-controls={`beat-${beat.id}`}
                  onClick={() => toggle(beat.id)}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {beat.more}
                </button>
              </div>

              {/* Drawn over the card rather than pushed under it. The three
                  cards are one row of a grid, so a panel that grows its own
                  card grows all three — open the shortest note and the other
                  two gain a third of a screen of nothing. Over the top, the
                  row never changes size and the section keeps its promise of
                  fitting one screen.

                  `hidden` rather than unmounting, so the id the button points
                  at with aria-controls exists whether or not it is open. */}
              <div
                id={`beat-${beat.id}`}
                className="beat-detail"
                hidden={!isOpen}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') close(beat.id);
                }}
              >
                <div className="beat-detail-body">
                  {beat.detail.map((block, index) => (
                    <BeatBlockView key={index} block={block} />
                  ))}
                </div>

                <button
                  type="button"
                  className="beat-detail-close"
                  onClick={() => close(beat.id)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <RailNav
        rail={rail}
        nudge={nudge}
        className="beats-nav"
        prevLabel="Previous question"
        nextLabel="Next question"
      />
    </div>
  );
}

function BeatBlockView({ block }: { block: NoteBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return <p>{block.text}</p>;

    case 'numbered':
      return (
        <>
          <h4 className="beat-label">{block.label}</h4>
          <ol className="beat-numbered">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </>
      );

    case 'list':
      return (
        <>
          <h4 className="beat-label">{block.label}</h4>
          <ul className="beat-list">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      );

    case 'tags':
      return (
        <>
          <h4 className="beat-label">{block.label}</h4>
          <ul className="beat-tags">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      );
  }
}
