'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  Calendar,
  MessageCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import ArticleCard from '@/components/ArticleCard';

interface Article {
  _id: string;
  slug: string;
  title: string;
  excerpt?: string;
  articleType: 'business_update' | 'community_commentary';
  tags: string[];
  coverImage?: string;
  readingTime?: number;
  publishedAt: string;
  author: {
    screenname?: string;
    name?: string;
  };
  coAuthorCount: number;
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useTranslation('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/directory/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section with Search */}
      <section
        className="relative bg-cover bg-center py-8 text-center md:py-12"
        style={{ backgroundImage: 'url(/img/home/website_banner.jpg)' }}
      >
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-[90vw] space-y-8">
            {/* Logo */}
            <div className="py-8 md:py-12">
              <Image
                src="/logos/pana_logo_long_pink.png"
                alt="Pana Mia"
                width={600}
                height={150}
                className="flower-power-logo mx-auto h-auto max-w-full"
                priority
              />
            </div>

            {/* Search Section */}
            <div className="py-8">
              <h1
                className="mb-4 text-4xl font-bold md:text-5xl"
                style={{
                  color: 'white',
                  textShadow:
                    '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                }}
              >
                {t('hero.headline')}
              </h1>
              <p
                className="mb-6 text-2xl md:text-3xl"
                style={{
                  color: 'white',
                  textShadow:
                    '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                }}
              >
                {t('hero.subheadline')}
              </p>

              <form onSubmit={handleSearch} className="mx-auto max-w-2xl">
                <label htmlFor="search" className="sr-only">
                  {t('hero.searchLabel')}
                </label>
                <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
                  <Input
                    id="search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('hero.searchPlaceholder')}
                    className="h-12 min-w-[33vw] rounded-2xl border-2 text-lg"
                    aria-label={t('hero.searchAriaLabel')}
                  />
                  <Button type="submit" size="lg" className="px-8">
                    <Search className="mr-2 h-5 w-5" aria-hidden="true" />
                    {t('hero.searchButton')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Community Events Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <Card className="overflow-hidden">
            <div className="grid gap-0 md:grid-cols-2">
              <div className="relative aspect-video min-h-[300px] md:aspect-auto">
                <Image
                  src="/img/home/EventsBanner.webp"
                  alt="Community events banner"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <CardContent className="flex flex-col justify-center p-8 md:p-12">
                <div className="space-y-4">
                  <div className="text-pana-blue flex items-center gap-2">
                    <Calendar className="h-6 w-6" aria-hidden="true" />
                    <Badge variant="secondary">{t('events.badge')}</Badge>
                  </div>
                  <CardTitle className="text-3xl">
                    {t('events.title')}
                  </CardTitle>
                  <CardDescription className="text-lg break-words whitespace-normal">
                    {t('events.description')}
                  </CardDescription>
                  <Link href="https://shotgun.live/venues/pana-mia-club">
                    <Button size="lg">{t('events.viewEvents')}</Button>
                  </Link>
                </div>
              </CardContent>
            </div>
          </Card>
        </div>
      </section>

      {/* Recent Articles Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-pana-blue/10 flex h-12 w-12 items-center justify-center rounded-full">
                <FileText
                  className="text-pana-blue h-6 w-6"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{t('articles.title')}</h2>
                <p className="text-muted-foreground text-sm">
                  {t('articles.subtitle')}
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/a">{t('articles.viewAll')}</Link>
            </Button>
          </div>
          {articlesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : articles.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium">
                {t('articles.noArticles')}
              </h3>
              <p className="mt-1 text-gray-500">
                {t('articles.noArticlesDesc')}
              </p>
              <Button asChild className="mt-4">
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

      {/* About Section */}
      <section className="bg-muted/30 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <div className="bg-pana-blue/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
              <MessageCircle
                className="text-pana-blue h-8 w-8"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-3xl font-bold">{t('about.title')}</h2>
            <p className="text-muted-foreground text-xl">
              {t('about.tagline')}
            </p>
            <p className="text-lg">{t('about.body')}</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted/30 py-16 md:py-24" id="home-faq">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-3xl font-bold">
              {t('faq.title')}
            </h2>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>{t('faq.q1')}</AccordionTrigger>
                <AccordionContent>{t('faq.a1')}</AccordionContent>
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
                    className="text-primary underline"
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
                <AccordionContent>{t('faq.a8')}</AccordionContent>
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
    </div>
  );
}
