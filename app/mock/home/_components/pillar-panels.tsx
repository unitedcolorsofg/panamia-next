'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import type { Pillar, PillarProgram } from '../_data';

interface PillarPanelsProps {
  pillars: Pillar[];
}

/**
 * The three pillars, as expanding panels.
 *
 * The deck puts Collective Tech, Community Building and Culture Work on one
 * slide as three equal columns, and that is the claim: they are three halves
 * of the same thing, not a ranked list. Three equal columns of body copy on a
 * homepage is also how you get three columns nobody reads — so the panels keep
 * all three present at once and give the open one the room its programme list
 * needs.
 *
 * Above 64rem the closed panels collapse to a spine and the open one takes the
 * remaining width, which is the shape in the sketch. Below that it is an
 * ordinary vertical accordion; vertical spines in a narrow column would just
 * be an unreadable stack of sideways words.
 *
 * One panel is always open, so the section never collapses into three closed
 * bars with nothing to read. That means clicking the open panel is a no-op
 * rather than a close — the honest alternative, letting it close, leaves a
 * state where the section says nothing at all.
 */
export function PillarPanels({ pillars }: PillarPanelsProps) {
  const [active, setActive] = useState(pillars[0].id);

  return (
    <div className="pillars">
      {pillars.map((pillar, index) => {
        const isOpen = pillar.id === active;
        return (
          <section
            key={pillar.id}
            className="pillar"
            data-open={isOpen}
            aria-labelledby={`pillar-trigger-${pillar.id}`}
          >
            <h3 className="pillar-head">
              <button
                type="button"
                id={`pillar-trigger-${pillar.id}`}
                className="pillar-trigger"
                aria-expanded={isOpen}
                aria-controls={`pillar-body-${pillar.id}`}
                onClick={() => setActive(pillar.id)}
              >
                <span className="pillar-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="pillar-name">{pillar.name}</span>
                <ArrowRight className="pillar-chev" aria-hidden="true" />
              </button>
            </h3>

            <div
              id={`pillar-body-${pillar.id}`}
              className="pillar-body"
              hidden={!isOpen}
            >
              <p className="pillar-problem">{pillar.problem}</p>
              <p className="pillar-answer">{pillar.answer}</p>

              <ul className="pillar-programs">
                {pillar.programs.map((program) => (
                  <li key={program.name}>
                    <ProgramRow program={program} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* A programme with somewhere to go is a link; one without is not. Rendering
   the unshipped ones as links to `#` would teach visitors that half this
   section's rows are broken. */
function ProgramRow({ program }: { program: PillarProgram }) {
  const isExternal = program.href?.startsWith('http') ?? false;

  const inner = (
    <>
      <span className="pillar-program-name">
        {program.name}
        {program.href && (
          <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
      </span>
      <span className="pillar-program-note">{program.note}</span>
      <span className="pillar-program-status" data-status={program.status}>
        {program.status === 'live' ? 'Live now' : 'Building'}
      </span>
    </>
  );

  if (!program.href) {
    return <div className="pillar-program">{inner}</div>;
  }

  return (
    <Link
      href={program.href}
      className="pillar-program"
      {...(isExternal
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : null)}
    >
      {inner}
      {isExternal && <span className="sr-only">(opens in a new tab)</span>}
    </Link>
  );
}
