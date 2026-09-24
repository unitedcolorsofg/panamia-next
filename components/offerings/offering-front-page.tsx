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
 * shape one level down: what it is, what you get, and where to go. It reuses
 * the homepage's type (`.hero-headline`, `.section-display`, `.section-lede`),
 * its closing band (`.story-point`) and its palette rather than restating any
 * of them, so the six pages cannot drift away from the page they hang off.
 *
 * What it deliberately does *not* borrow is the first screen. The street scene
 * and the search card are the homepage's own argument — the physical place,
 * and the one box that opens it — and repeating them six times would make each
 * offering look like another copy of the front door rather than a room behind
 * it. These open on the headline instead.
 *
 * One component rather than six pages of markup: the copy differs, the
 * structure does not, and six hand-written variants are six chances for one of
 * them to quietly lose a heading level or a landmark.
 */

export interface OfferingActions {
  /** Where the page's one primary button goes. */
  primary: string;
  /** The secondary button. */
  secondary: string;
}

const HIGHLIGHT_KEYS = ['one', 'two', 'three'] as const;

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
  const { t } = useTranslation('offerings');
  const offering = getOffering(id);
  const isBuilt = offering.appHref !== null;

  const buttons = [
    { href: actions.primary, label: t(`${id}.ctaPrimary`), solid: true },
    { href: actions.secondary, label: t(`${id}.ctaSecondary`), solid: false },
  ];

  return (
    <>
      <ScrollReveal />

      <div className="offering">
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

            {/* An offering with nothing to open says so here, once, rather
                than becoming a dead button further down. The badge is the one
                the rest of the site already uses for designed-but-unwired
                work: a promise, not a broken state. */}
            {!isBuilt && (
              <p className="offering-pending">
                <span className="coming-soon">{t('comingSoon')}</span>
                <span className="offering-pending-note">
                  {t('notBuiltYet')}
                </span>
              </p>
            )}

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
              {HIGHLIGHT_KEYS.map((key, index) => (
                <li key={key} className="offering-card">
                  <span className="offering-card-num" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
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
