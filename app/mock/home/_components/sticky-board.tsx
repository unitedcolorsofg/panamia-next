'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { NoteBlock, StickyNote } from '../_data';

interface StickyBoardProps {
  notes: StickyNote[];
}

/**
 * The info card: three pinned notes answering the three questions every new
 * visitor has, in the order they have them.
 *
 * Today this content exists on the homepage, but it is buried in a nine-row
 * FAQ accordion near the bottom of the page — below the directory index,
 * Featured Panas, events, articles and the impact band. Someone who lands on
 * panamia.club not knowing what a pana is has to scroll past everything the
 * site sells before finding out what it is selling.
 *
 * So the notes come up to second position, directly under the search, and
 * they are notes rather than another accordion for a reason: the face of each
 * note answers its question outright. Nothing here requires a click. Opening
 * one adds the deck's full definition for anyone who wants it, which is a
 * different promise from an accordion row, where the click *is* the answer.
 */
export function StickyBoard({ notes }: StickyBoardProps) {
  // Independent, not one-at-a-time. These are three separate questions, and a
  // visitor comparing "what is a pana" against "why local" should not have to
  // keep closing one to read the other.
  const [open, setOpen] = useState<string[]>([]);

  const toggle = (id: string) =>
    setOpen((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );

  return (
    <ul className="stickyboard">
      {notes.map((note) => {
        const isOpen = open.includes(note.id);
        return (
          <li key={note.id} data-rv>
            <article
              className="stickynote"
              data-paper={note.tone}
              data-open={isOpen}
              style={{ '--tilt': `${note.tilt}deg` } as CSSProperties}
            >
              <span className="stickynote-tape" aria-hidden="true" />

              <h3 className="stickynote-q">{note.question}</h3>
              {note.aside && <p className="stickynote-aside">{note.aside}</p>}
              <p className="stickynote-a">{note.answer}</p>

              <button
                type="button"
                className="stickynote-toggle"
                aria-expanded={isOpen}
                aria-controls={`stickynote-${note.id}`}
                onClick={() => toggle(note.id)}
              >
                {isOpen ? (
                  <Minus className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {isOpen ? 'Close' : note.more}
              </button>

              {/* `hidden` rather than unmounting, so the ids the button points
                  at with aria-controls exist whether or not the note is open. */}
              <div
                id={`stickynote-${note.id}`}
                className="stickynote-detail"
                hidden={!isOpen}
              >
                {note.detail.map((block, index) => (
                  <NoteBlockView key={index} block={block} />
                ))}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function NoteBlockView({ block }: { block: NoteBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return <p>{block.text}</p>;

    case 'numbered':
      return (
        <>
          <h4 className="stickynote-label">{block.label}</h4>
          <ol className="stickynote-numbered">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </>
      );

    case 'list':
      return (
        <>
          <h4 className="stickynote-label">{block.label}</h4>
          <ul className="stickynote-list">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      );

    case 'tags':
      return (
        <>
          <h4 className="stickynote-label">{block.label}</h4>
          <ul className="stickynote-tags">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      );
  }
}
