'use client';

import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, FileText, Loader2 } from 'lucide-react';
import ArticleCard from '@/components/ArticleCard';
import { DirectorySuggest } from '@/components/directory-suggest';
import { profileCategoryList } from '@/lib/lists';

interface Article {
  _id: string;
  slug: string;
  title: string;
  excerpt?: string;
  articleType: 'business_update' | 'community_commentary' | 'staff_update';
  tags: string[];
  coverImage?: string;
  coverImageAlt?: string;
  readingTime?: number;
  publishedAt: string;
  author: {
    screenname?: string;
    name?: string;
  };
  coAuthorCount: number;
}

// Shape returned by /api/directory/featured — a card's worth of profile, not
// the whole record.
interface FeaturedPana {
  id: string;
  name: string;
  screenname: string | null;
  primaryImageCdn: string | null;
  addressLocality: string | null;
  fiveWords: string | null;
}

// URL fragments that open a specific FAQ entry, mapped to its accordion value.
// Linking to a collapsed accordion would otherwise just drop the reader next to
// a closed row — see the sign-in ad copy, which points here.
const FAQ_ANCHORS: Record<string, string> = {
  'faq-what-is-a-pana': 'item-what-is-a-pana',
};

// The three pillars under the "Community is a form of power" statement. Kept
// out of the JSX so the markup below stays a single readable loop.
const PILLARS = ['gather', 'connect', 'celebrate'] as const;

export default function HomePage() {
  const { t } = useTranslation('home');
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [featured, setFeatured] = useState<FeaturedPana[]>([]);
  const [openFaq, setOpenFaq] = useState('');

  useEffect(() => {
    async function fetchRecentArticles() {
      try {
        const response = await fetch('/api/articles/recent?limit=3');
        const data = await response.json();
        if (data.success) {
          setArticles(data.data.articles);
        }
      } catch (error) {
        console.error('Failed to fetch recent articles:', error);
      } finally {
        setArticlesLoading(false);
      }
    }
    fetchRecentArticles();
  }, []);

  // Featured Panas has no loading state on purpose: the section is hidden
  // until it has rows, so a spinner would only ever flash in a gap that then
  // collapses. A failed fetch leaves the list empty and the section unrendered.
  useEffect(() => {
    const controller = new AbortController();
    async function fetchFeatured() {
      try {
        const response = await fetch('/api/directory/featured?limit=3', {
          signal: controller.signal,
        });
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setFeatured(data.data);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to fetch featured panas:', error);
        }
      }
    }
    fetchFeatured();
    return () => controller.abort();
  }, []);

  // Open (and scroll to) the FAQ entry named in the URL fragment. The scroll is
  // explicit because this page renders client-side: by the time the accordion
  // exists, the browser has already done its own fragment jump and found
  // nothing. Also listens for hashchange so a same-page link still works.
  useEffect(() => {
    function openFromHash() {
      const anchor = window.location.hash.slice(1);
      const value = FAQ_ANCHORS[anchor];
      if (!value) return;
      setOpenFaq(value);
      document
        .getElementById(anchor)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  const tickerPhrases = t('ticker')
    .split('·')
    .map((phrase) => phrase.trim())
    .filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section with Search */}
      <section className="home-hero-banner relative py-8 text-center md:py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-[90vw] space-y-8">
            {/* Logo */}
            <div className="py-8 md:py-12">
              <Image
                src="/logos/pana_logo_long_white.png"
                alt="Pana Mia"
                width={600}
                height={150}
                className="flower-power-logo mx-auto h-auto max-w-full"
                priority
              />
            </div>

            {/* Search Section */}
            <div className="py-8">
              <h1 className="hero-headline mb-4 text-4xl md:text-5xl">
                {t('hero.headline')}
              </h1>
              <p className="hero-subheadline mb-6 text-2xl md:text-3xl">
                {t('hero.subheadline')}
              </p>

              <DirectorySuggest
                className="mx-auto max-w-2xl"
                label={t('hero.searchLabel')}
                placeholder={t('hero.searchPlaceholder')}
                ariaLabel={t('hero.searchAriaLabel')}
                buttonLabel={t('hero.searchButton')}
                inputClassName="h-12 min-w-[33vw] rounded-full border-2 text-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Marquee strip. The phrase list is rendered twice because the track
          animates by exactly half its width — one copy scrolls off while its
          duplicate scrolls in, so the loop has no visible seam. */}
      <section className="surface-cream py-6">
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex">
                {tickerPhrases.map((phrase, index) => (
                  <span
                    key={`${copy}-${index}`}
                    className="px-6 text-sm font-extrabold tracking-[0.1em] whitespace-nowrap uppercase"
                  >
                    {phrase}
                    <span className="text-pana-indigo px-6">✳</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Find Your People — the directory index. Every row is a real category
          filter, so each one lands on a populated browse result. */}
      <section
        id="directory"
        className="surface-citrus scallop py-16 md:py-24"
        style={{ '--scallop': 'var(--color-pana-cream)' } as CSSProperties}
      >
        <div className="container mx-auto px-4">
          <div className="mb-10 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="section-eyebrow text-pana-ink/80">
                {t('directory.eyebrow')}
              </span>
              <h2 className="section-display mt-4">
                <Trans
                  i18nKey="directory.title"
                  t={t}
                  components={{ em: <em className="not-italic" /> }}
                />
              </h2>
              <p className="section-lede mt-5">{t('directory.lede')}</p>
            </div>
            <Link href="/directory/search" className="link-arrow shrink-0">
              {t('directory.browseAll')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <ul className="mt-10">
            {profileCategoryList.map((category, index) => (
              <li key={category.value}>
                <Link
                  href={`/directory/search?fcat=${encodeURIComponent(category.value)}`}
                  className="index-row focus-visible:ring-pana-ink group rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span className="text-xs font-extrabold opacity-70">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xl font-extrabold tracking-tight sm:text-2xl md:text-3xl">
                    {category.desc}
                  </span>
                  <span className="index-go group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* About + the statement that follows it share one indigo run, separated
          by a rule rather than a colour change — as in the design. */}
      <section id="about" className="surface-indigo py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="section-eyebrow text-pana-butter">
                {t('about.eyebrow')}
              </span>
              <h2 className="section-display mt-4">{t('about.title')}</h2>
              {/* Indigo is the only surface that carries cream text — see the
                  contrast rule in globals.css. `text-muted-foreground` would
                  be near-invisible here. */}
              <p className="text-pana-butter mt-6 text-xl font-semibold">
                {t('about.tagline')}
              </p>
              <p className="section-lede mt-5 text-white/85">
                {t('about.body')}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button
                  size="lg"
                  asChild
                  className="bg-pana-flame text-pana-ink hover:bg-pana-burnt rounded-full font-extrabold"
                >
                  <Link href="/form/become-a-pana">{t('about.ctaJoin')}</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="text-pana-cream hover:text-pana-ink hover:bg-pana-cream rounded-full border-2 border-white/40 bg-transparent font-extrabold"
                >
                  <Link href="/directory/search">{t('about.ctaBrowse')}</Link>
                </Button>
              </div>
            </div>
            <div className="media-frame aspect-[5/4]">
              <Image
                src="/img/home/website_banner.webp"
                alt={t('about.imageAlt')}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Community is a form of power. */}
      <section className="surface-indigo pb-16 md:pb-24">
        <div className="container mx-auto px-4">
          <div className="border-t border-white/20 pt-16 md:pt-24">
            <span className="section-eyebrow text-pana-butter">
              {t('statement.eyebrow')}
            </span>
            <h2 className="section-statement mt-6">
              <Trans
                i18nKey="statement.text"
                t={t}
                components={{ em: <em /> }}
              />
            </h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {PILLARS.map((pillar, index) => (
                <div key={pillar}>
                  <span className="text-pana-butter text-xs font-extrabold tracking-[0.18em]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 text-2xl font-extrabold tracking-tight">
                    {t(`statement.${pillar}.title`)}
                  </h3>
                  <p className="mt-3 text-white/85">
                    {t(`statement.${pillar}.body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Panas. Rendered only when the directory returns rows, so an
          empty or unreachable directory hides the section instead of showing
          three placeholder boxes. */}
      {featured.length > 0 && (
        <section
          id="collective"
          className="surface-butter-2 citrus-host py-16 md:py-24"
        >
          <span
            className="citrus citrus-deco right"
            style={
              {
                '--cz': '22rem',
                '--cz-rim': 'var(--color-pana-flame)',
                '--cz-seg': 'rgb(242 132 68 / 0.45)',
                '--cz-core': 'var(--color-pana-butter-2)',
              } as CSSProperties
            }
            aria-hidden="true"
          />
          <div className="wrap relative container mx-auto px-4">
            <div className="mb-10 md:mb-16">
              <span className="section-eyebrow">{t('collective.eyebrow')}</span>
              <h2 className="section-display mt-4">
                <Trans
                  i18nKey="collective.title"
                  t={t}
                  components={{ em: <em className="not-italic" /> }}
                />
              </h2>
              <p className="section-lede mt-5">{t('collective.lede')}</p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((pana) => (
                <Link
                  key={pana.id}
                  href={`/p/${pana.screenname}`}
                  className="group flex flex-col gap-4"
                >
                  <div className="media-frame aspect-[4/5]">
                    {/* Plain <img> rather than next/image: these are remote
                        CDN URLs and next.config.js declares no remotePatterns,
                        so the image optimizer would reject them at runtime.
                        Matches the directory search result card. */}
                    <img
                      src={pana.primaryImageCdn || '/img/bg_coconut_blue.jpg'}
                      alt={pana.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold tracking-tight">
                      {pana.name}
                    </h3>
                    {pana.fiveWords && (
                      <p className="mt-2 text-base opacity-85">
                        {pana.fiveWords}
                      </p>
                    )}
                    {pana.addressLocality && (
                      <p className="mt-3 text-xs font-bold tracking-[0.08em] uppercase opacity-70">
                        {pana.addressLocality}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-12">
              <Link href="/directory/search" className="link-arrow">
                {t('collective.cta')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Community Events */}
      <section id="events" className="surface-red citrus-host py-16 md:py-24">
        <span
          className="citrus citrus-deco left"
          style={
            {
              '--cz': '20rem',
              '--cz-rim': 'rgb(255 247 236 / 0.6)',
              '--cz-seg': 'rgb(255 247 236 / 0.35)',
              '--cz-core': 'var(--color-pana-red)',
            } as CSSProperties
          }
          aria-hidden="true"
        />
        <div className="wrap relative container mx-auto px-4">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="media-frame aspect-[5/4] lg:order-2">
              <Image
                src="/img/home/EventsBanner.webp"
                alt={t('events.imageAlt')}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="lg:order-1">
              <span className="section-eyebrow text-pana-ink/80">
                {t('events.badge')}
              </span>
              <h2 className="section-display mt-4">{t('events.title')}</h2>
              <p className="section-lede mt-5">{t('events.description')}</p>
              <Button
                size="lg"
                asChild
                className="bg-pana-ink text-pana-cream mt-8 rounded-full font-extrabold hover:bg-black"
              >
                <Link href="https://shotgun.live/venues/pana-mia-club">
                  {t('events.viewEvents')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stories From The Collective */}
      <section id="dispatches" className="surface-cream py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="section-eyebrow">{t('articles.eyebrow')}</span>
              <h2 className="section-display mt-4">
                <Trans
                  i18nKey="articles.title"
                  t={t}
                  components={{ em: <em className="not-italic" /> }}
                />
              </h2>
              <p className="section-lede mt-5">{t('articles.subtitle')}</p>
            </div>
            <Link href="/a" className="link-arrow shrink-0">
              {t('articles.viewAll')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {articlesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="text-pana-ink/40 h-8 w-8 animate-spin" />
            </div>
          ) : articles.length === 0 ? (
            <div className="border-pana-ink/25 rounded-2xl border-2 border-dashed py-12 text-center">
              <FileText
                className="text-pana-ink/40 mx-auto h-12 w-12"
                aria-hidden="true"
              />
              <h3 className="mt-4 text-lg font-bold">
                {t('articles.noArticles')}
              </h3>
              <p className="mt-1 opacity-75">{t('articles.noArticlesDesc')}</p>
              <Button
                asChild
                className="bg-pana-indigo text-pana-cream mt-4 rounded-full font-extrabold"
              >
                <Link href="/a/new">{t('articles.writeArticle')}</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard
                  key={article._id}
                  slug={article.slug}
                  title={article.title}
                  excerpt={article.excerpt}
                  articleType={article.articleType}
                  tags={article.tags}
                  coverImage={article.coverImage}
                  coverImageAlt={article.coverImageAlt}
                  readingTime={article.readingTime}
                  publishedAt={article.publishedAt}
                  author={article.author}
                  coAuthorCount={article.coAuthorCount}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="surface-butter-2 py-16 md:py-24" id="home-faq">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <span className="section-eyebrow">{t('faq.eyebrow')}</span>
            <h2 className="section-display mt-4 mb-10">{t('faq.title')}</h2>

            <Accordion
              type="single"
              collapsible
              className="w-full"
              value={openFaq}
              onValueChange={setOpenFaq}
            >
              <AccordionItem value="item-1">
                <AccordionTrigger>{t('faq.q1')}</AccordionTrigger>
                <AccordionContent>{t('faq.a1')}</AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="item-what-is-a-pana"
                id="faq-what-is-a-pana"
                className="scroll-mt-24"
              >
                <AccordionTrigger>
                  {/* The emphasis is part of the question — it distinguishes
                      this from "What does Pana mean?" directly above.
                      The span is required: AccordionTrigger is a flex row with
                      justify-between, so the three nodes Trans emits around the
                      <em> would otherwise each become a flex item and spread
                      across the full width. */}
                  <span>
                    <Trans
                      i18nKey="faq.qWhatIsAPana"
                      t={t}
                      components={{ em: <em /> }}
                    />
                  </span>
                </AccordionTrigger>
                <AccordionContent>{t('faq.aWhatIsAPana')}</AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>{t('faq.q2')}</AccordionTrigger>
                <AccordionContent>{t('faq.a2')}</AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger>{t('faq.q3')}</AccordionTrigger>
                <AccordionContent>{t('faq.a3')}</AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger>{t('faq.q4')}</AccordionTrigger>
                <AccordionContent>{t('faq.a4')}</AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger>{t('faq.q5')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq.a5')}{' '}
                  <Link
                    href="/form/become-a-pana"
                    className="text-pana-indigo font-bold underline"
                  >
                    {t('faq.a5Link')}
                  </Link>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger>{t('faq.q6')}</AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc space-y-2 pl-6">
                    <li>{t('faq.a6_1')}</li>
                    <li>{t('faq.a6_2')}</li>
                    <li>{t('faq.a6_3')}</li>
                    <li>{t('faq.a6_4')}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7">
                <AccordionTrigger>{t('faq.q7')}</AccordionTrigger>
                <AccordionContent>{t('faq.a7')}</AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8">
                <AccordionTrigger>{t('faq.q8')}</AccordionTrigger>
                <AccordionContent>
                  {t('faq.a8')}{' '}
                  <Link
                    href="/directory/search"
                    className="text-pana-indigo font-bold underline"
                  >
                    {t('faq.a8Link')}
                  </Link>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9">
                <AccordionTrigger>{t('faq.q9')}</AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2">{t('faq.a9_1')}</p>
                  <p>{t('faq.a9_2')}</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Closing statement. The design mock ends on a newsletter capture, but
          there is no public subscribe endpoint on the site — /api/crm/contact/
          subscribe re-subscribes an already-authenticated contact in the CRM.
          Rather than ship an input that silently discards an address, this
          closes on the same statement with the two real destinations behind
          it. */}
      <section className="surface-indigo py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="section-eyebrow text-pana-butter">
                {t('closing.eyebrow')}
              </span>
              <h2 className="section-statement mt-6">
                <Trans
                  i18nKey="closing.statement"
                  t={t}
                  components={{ em: <em /> }}
                />
              </h2>
            </div>
            <div>
              <p className="section-lede text-white/85">{t('closing.lede')}</p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button
                  size="lg"
                  asChild
                  className="bg-pana-flame text-pana-ink hover:bg-pana-burnt rounded-full font-extrabold"
                >
                  <Link href="/form/become-a-pana">{t('closing.ctaJoin')}</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="text-pana-cream hover:text-pana-ink hover:bg-pana-cream rounded-full border-2 border-white/40 bg-transparent font-extrabold"
                >
                  <Link href="/directory/search">{t('closing.ctaBrowse')}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
