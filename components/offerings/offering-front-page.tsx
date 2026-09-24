'use client';

import { Trans, useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import SurfaceLink from '@/components/panaverse/SurfaceLink';
import ScrollReveal from '@/components/scroll-reveal';
import { PANA_OFFERINGS, getOffering } from '@/lib/panaverse/offerings';

/**
 * The front page every offering gets, told in the homepage's own language.
 *
 * The homepage answers "what is this place?" in bands — a first screen, the
 * basics, the pillars, then the ask. An offering's front page is the same
 * shape one level down. It reuses the homepage's type (`.hero-headline`,
 * `.section-display`, `.section-lede`), its closing band (`.story-point`) and
 * its palette rather than restating any of them, so the six pages cannot drift
 * away from the page they hang off.
 *
 * What it deliberately does *not* borrow is the first screen. The street scene
 * and the search card are the homepage's own argument — the physical place,
 * and the one box that opens it — and repeating them six times would make each
 * offering look like another copy of the front door rather than a room behind
 * it. These open on the headline instead.
 *
 * ## Why the middle of the page is optional
 *
 * The first version of this rendered one fixed shape six times: headline,
 * three cards titled "What You Get", closing band. Every page therefore made
 * the same argument in the same order, which is a brochure — it lists what a
 * thing has without ever saying what is wrong today or how the thing works.
 *
 * The homepage does not do that. Its pillars run problem → answer → programs
 * and its beats run question → answer → detail. So two optional bands are
 * available here in the same spirit:
 *
 * - `problem` — the tension. What is broken if this offering does not exist.
 * - `steps`   — the mechanism. How the thing actually works, in order.
 *
 * Both render only when the offering's locale file defines them, which is what
 * lets these pages be written one at a time instead of needing all six
 * rewritten at once. An offering with neither falls back to exactly the shape
 * it had before.
 *
 * The shapes are deliberately different from each other — a statement with
 * symptoms, then a stacked walkthrough, then a row of cards — because three
 * three-across grids in a column is the other way to be monotonous.
 */

export interface OfferingActions {
  /** Where the page's one primary button goes. */
  primary: string;
  /** The secondary button. */
  secondary: string;
}

const HIGHLIGHT_KEYS = ['one', 'two', 'three'] as const;
const SYMPTOM_KEYS = ['one', 'two', 'three'] as const;
const STEP_KEYS = ['one', 'two', 'three'] as const;

export function OfferingFrontPage({
  id,
  actions,
}: {
  /** An id from `PANA_OFFERINGS`; also the key into the `offerings` namespace. */
  id: string;
  /**
   * Where the two buttons go. Hrefs live at the call site rather than in the
   * locale files — a translator should not be able to change where a button
   * goes — and several of them point at routes (`/e/new`, `/donate`) that have
   * nothing to do with the offering's own registry entry. Their *labels* come
   * from `ctaPrimary` / `ctaSecondary` in the namespace, which is what keeps
   * the six pages themselves down to a single line each.
   */
  actions: OfferingActions;
}) {
  const { t, i18n } = useTranslation('offerings');
  const offering = getOffering(id);

  // Both middle bands are opt-in per offering. `exists` is checked against one
  // required leaf rather than the parent object, because i18next reports a
  // parent as existing as soon as any descendant does.
  const hasProblem = i18n.exists(`offerings:${id}.problem.statement`);
  const hasSteps = i18n.exists(`offerings:${id}.steps.title`);

  const buttons = [
    { href: actions.primary, label: t(`${id}.ctaPrimary`), solid: true },
    { href: actions.secondary, label: t(`${id}.ctaSecondary`), solid: false },
  ];

  return (
    <>
      <ScrollReveal />

      {/* The id is on the element so a single page can be adjusted without a
          new class or a new component — these are being designed one at a
          time, and most of what separates them is spacing and emphasis. */}
      <div className="offering" data-offering={offering.id}>
        <section className="offering-hero">
          <div className="container mx-auto px-4">
            <span className="section-eyebrow">{t(`${id}.eyebrow`)}</span>

            <h1 className="hero-headline offering-headline">
              <Trans
                i18nKey={`${id}.headline`}
                t={t}
                components={{ br: <br />, em: <em className="accent-word" /> }}
              />
            </h1>

            <p className="hero-subheadline offering-lede">{t(`${id}.lede`)}</p>

            <div className="offering-actions">
              {buttons.map((button) => (
                <Button
                  key={button.href}
                  size="lg"
                  asChild
                  className={
                    button.solid
                      ? 'offering-btn offering-btn-solid'
                      : 'offering-btn offering-btn-ghost'
                  }
                >
                  <SurfaceLink href={button.href}>{button.label}</SurfaceLink>
                </Button>
              ))}
            </div>
          </div>
        </section>

        {hasProblem && <OfferingProblem id={id} />}
        {hasSteps && <OfferingSteps id={id} />}

        <section className="home-section offering-highlights">
          <div className="container mx-auto px-4">
            <div className="home-sectionhead" data-rv>
              <h2 className="section-display">
                <Trans
                  i18nKey={`${id}.highlights.title`}
                  t={t}
                  components={{ em: <em className="display-accent" /> }}
                />
              </h2>
            </div>

            <ul className="offering-cards" data-rv>
              {HIGHLIGHT_KEYS.map((key) => (
                <li key={key} className="offering-card">
                  <h3 className="offering-card-title">
                    {t(`${id}.highlights.${key}.title`)}
                  </h3>
                  <p className="offering-card-body">
                    {t(`${id}.highlights.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="home-section story-point">
          <div className="container mx-auto px-4" data-rv>
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <span className="section-eyebrow">
                  {t(`${id}.closing.eyebrow`)}
                </span>
                <h2 className="section-statement mt-6">
                  <Trans
                    i18nKey={`${id}.closing.statement`}
                    t={t}
                    components={{ em: <em /> }}
                  />
                </h2>
              </div>
              <div>
                <p className="section-lede story-point-body">
                  {t(`${id}.closing.lede`)}
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  {buttons.map((button) => (
                    <Button
                      key={button.href}
                      size="lg"
                      asChild
                      className={
                        button.solid
                          ? 'story-btn story-btn-solid rounded-full border-2 border-transparent font-extrabold'
                          : 'story-btn story-btn-ghost rounded-full border-2 font-extrabold'
                      }
                    >
                      <SurfaceLink href={button.href}>
                        {button.label}
                      </SurfaceLink>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <OfferingSwitch currentId={id} />
      </div>
    </>
  );
}

/**
 * The tension, before any of the good news.
 *
 * Nothing on these pages used to say what is wrong today, so every offering
 * arrived as a list of features answering a question the reader had not been
 * asked yet. This band asks it.
 *
 * It is a statement plus three symptoms rather than a paragraph, because the
 * complaint is usually three separate complaints and running them together is
 * what turns them into throat-clearing. Each symptom is marked rather than
 * bulleted — the mark is coral, the one warm colour in the palette that reads
 * as a fault without being an error state.
 */
function OfferingProblem({ id }: { id: string }) {
  const { t } = useTranslation('offerings');

  return (
    <section className="home-section offering-problem">
      <div className="container mx-auto px-4">
        <div className="offering-problem-head" data-rv>
          <span className="section-eyebrow">{t(`${id}.problem.eyebrow`)}</span>
          <h2 className="section-display offering-problem-statement">
            <Trans
              i18nKey={`${id}.problem.statement`}
              t={t}
              components={{ br: <br />, em: <em className="display-accent" /> }}
            />
          </h2>
        </div>

        <ul className="offering-symptoms" data-rv>
          {SYMPTOM_KEYS.map((key) => (
            <li key={key} className="offering-symptom">
              <span className="offering-symptom-mark" aria-hidden="true" />
              <h3 className="offering-symptom-title">
                {t(`${id}.problem.${key}.title`)}
              </h3>
              <p className="offering-symptom-body">
                {t(`${id}.problem.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * How the thing actually works, in the order it happens to you.
 *
 * Stacked rows rather than a third grid of three. The two bands around it are
 * already three-across, and a page whose every section is the same row of
 * three reads as a template no matter how good the words in it are. A
 * walkthrough is also genuinely sequential in a way a feature list is not —
 * step two only makes sense after step one — so the numerals are load-bearing
 * rather than decoration, and a rule runs between them to say so.
 */
function OfferingSteps({ id }: { id: string }) {
  const { t } = useTranslation('offerings');

  return (
    <section className="home-section offering-steps">
      <div className="container mx-auto px-4">
        <div className="home-sectionhead" data-rv>
          <h2 className="section-display">
            <Trans
              i18nKey={`${id}.steps.title`}
              t={t}
              components={{ br: <br />, em: <em className="display-accent" /> }}
            />
          </h2>
          <p className="section-lede max-w-2xl">{t(`${id}.steps.lede`)}</p>
        </div>

        <ol className="offering-steplist" data-rv>
          {STEP_KEYS.map((key, index) => (
            <li key={key} className="offering-step">
              <span className="offering-step-num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="offering-step-copy">
                <h3 className="offering-step-title">
                  {t(`${id}.steps.${key}.title`)}
                </h3>
                <p className="offering-step-body">
                  {t(`${id}.steps.${key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * The other five, at the foot of each one.
 *
 * The nav drawer already lists them, but a drawer has to be opened first.
 * Someone who has read a whole front page has just been told what one offering
 * is and is exactly the person about to wonder what the others are — so the
 * row of siblings sits in the slot the homepage gives its county shortcuts,
 * and for the same reason.
 */
function OfferingSwitch({ currentId }: { currentId: string }) {
  const { t } = useTranslation('offerings');
  const others = PANA_OFFERINGS.filter((offering) => offering.id !== currentId);

  return (
    <section className="home-section story-localrow offering-switch">
      <div className="container mx-auto px-4" data-rv>
        <div className="localrow-inner">
          <div className="localrow-group">
            <span className="localrow-label">{t('switchLabel')}</span>
            <div className="localrow-links">
              {others.map((other) => (
                <SurfaceLink
                  key={other.id}
                  href={other.href}
                  className="localrow-chip"
                >
                  {t(`${other.id}.name`)}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </SurfaceLink>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
