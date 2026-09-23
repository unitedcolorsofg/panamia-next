'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { NoteBlock, StoryBeat } from '../_data';
import { BeatSceneArt } from './beat-scenes';

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
 * So the answers come up to second position, directly under the search. They
 * were briefly three sticky notes on a board; they are now three full-width
 * stops, because the notes had a ceiling. A note is a small square, and a
 * small square can hold a photograph or a sentence but not an argument. The
 * club's case for itself is a diagram and a map and a room full of people,
 * and none of those fit on a square.
 *
 * The sides alternate — artwork left, right, left — so scrolling through them
 * reads as walking past three shopfronts rather than reading three rows of a
 * table. Nothing here requires a click: the face of each stop answers its
 * question outright, and opening one adds the deck's full text for anyone who
 * wants it. That is a different promise from an accordion, where the click
 * *is* the answer.
 */
export function StoryBeats({ beats }: StoryBeatsProps) {
  // Independent, not one-at-a-time. These are three separate questions, and a
  // visitor comparing "what is a pana" against "why local" should not have to
  // keep closing one to read the other.
  const [open, setOpen] = useState<string[]>([]);

  const toggle = (id: string) =>
    setOpen((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );

  return (
    <div className="beats">
      {beats.map((beat) => {
        const isOpen = open.includes(beat.id);
        return (
          <section
            key={beat.id}
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
                aria-expanded={isOpen}
                aria-controls={`beat-${beat.id}`}
                onClick={() => toggle(beat.id)}
              >
                {isOpen ? (
                  <Minus className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {isOpen ? 'Close' : beat.more}
              </button>

              {/* `hidden` rather than unmounting, so the id the button points
                  at with aria-controls exists whether or not it is open. */}
              <div
                id={`beat-${beat.id}`}
                className="beat-detail"
                hidden={!isOpen}
              >
                {beat.detail.map((block, index) => (
                  <BeatBlockView key={index} block={block} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
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
