'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
import { Search, Users, Calendar, MessageCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const isLoading = status === 'loading';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/directory/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const categories = [
    'Music',
    'Artist',
    'Food',
    'Organizations',
    'Venue',
    'Jewelry',
    'Art',
    'Cafe',
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section with Search */}
      <section
        className="relative bg-cover bg-center py-8 text-center md:py-12"
        style={{ backgroundImage: 'url(/img/home/website_banner.jpg)' }}
      >
        {/* Auth Buttons & Theme Toggle - Top Right */}
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          {!isLoading && !session && (
            <>
              <Button size="default" asChild variant="outline">
                <Link href="/api/auth/signin">Log In</Link>
              </Button>
              <Button size="default" asChild variant="outline">
                <Link href="/form/become-a-pana">Become A Pana</Link>
              </Button>
            </>
          )}
          {!isLoading && session && (
            <Button size="default" asChild variant="outline">
              <Link href="/account/user">My Account</Link>
            </Button>
          )}
          <ThemeToggle />
        </div>

        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-[90vw] space-y-8">
            {/* Logo */}
            <div className="py-8 md:py-12">
              <Image
                src="/logos/pana_logo_long_pink.png"
                alt="Pana Mia"
                width={600}
                height={150}
                className="mx-auto h-auto max-w-full"
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
                The Future is Local
              </h1>
              <p
                className="mb-6 text-2xl md:text-3xl"
                style={{
                  color: 'white',
                  textShadow:
                    '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                }}
              >
                Search South Florida&apos;s First Local Directory
              </p>

              <form onSubmit={handleSearch} className="mx-auto max-w-2xl">
                <label htmlFor="search" className="sr-only">
                  Search directory
                </label>
                <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
                  <Input
                    id="search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, category, products"
                    className="h-12 min-w-[33vw] rounded-2xl border-2 text-lg"
                    aria-label="Search the directory"
                  />
                  <Button type="submit" size="lg" className="px-8">
                    <Search className="mr-2 h-5 w-5" aria-hidden="true" />
                    Search
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
                  <div className="flex items-center gap-2 text-pana-blue">
                    <Calendar className="h-6 w-6" aria-hidden="true" />
                    <Badge variant="secondary">Upcoming Events</Badge>
                  </div>
                  <CardTitle className="text-3xl">Community Events</CardTitle>
                  <CardDescription className="text-lg">
                    Pana MIA curates intentional events centered around
                    meaningful connection and the celebration of local culture
                    and art.
                  </CardDescription>
                  <Button size="lg" asChild>
                    <Link href="https://shotgun.live/venues/pana-mia-club">
                      View Events
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>
        </div>
      </section>

      {/* About Section */}
      <section className="bg-muted/30 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pana-blue/10">
              <MessageCircle
                className="h-8 w-8 text-pana-blue"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-3xl font-bold">¿Que Tal, Pana?</h2>
            <p className="text-xl text-muted-foreground">
              Being a small business owner can be overwhelming and isolating,
              but you&apos;re not alone.
            </p>
            <p className="text-lg">
              Miami is filled with small vendors, all with different strengths
              and skillsets. We started Pana Mia to bring everyone
              together—pooling resources, insights, and strategies. As consumers
              recognize the benefits of shopping local, we&apos;re creating a
              centralized space to explore and fall in love with local brands.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted/30 py-16 md:py-24" id="home-faq">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-3xl font-bold">
              Frequently Asked Questions
            </h2>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>What does Pana mean?</AccordionTrigger>
                <AccordionContent>
                  Pana is a Latine term for friend or homie.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>
                  Is this platform free? If so, will it always be free?
                </AccordionTrigger>
                <AccordionContent>
                  Experience the freedom of our platform - forever, completely
                  free! Join us in breaking down barriers and empowering local
                  businesses and creatives like never before.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger>
                  When can I expect the directory on your website to be up and
                  running?
                </AccordionTrigger>
                <AccordionContent>
                  We currently have a team of developers dedicated to working on
                  the directory, projected to release this Fall 2023. In order
                  to accelerate the development process, we are actively
                  fundraising.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger>How does Pana MIA work?</AccordionTrigger>
                <AccordionContent>
                  South Florida&apos;s comprehensive directory allows people to
                  discover the essence of supporting local as lifestyle. Search
                  for services or creatives near you in our keyword-searchable
                  directory. Locally based business owners and creatives are
                  welcome to join our community and create profiles to showcase
                  their offerings.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger>How do I sign up?</AccordionTrigger>
                <AccordionContent>
                  Simple! Fill out our Google form.{' '}
                  <Link
                    href="/form/become-a-pana"
                    className="text-primary underline"
                  >
                    Become a Pana!
                  </Link>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger>
                  What are the perks to being a Pana?
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc space-y-2 pl-6">
                    <li>
                      Be a part of our open access list of all locally-based
                      creatives and entrepreneurs available to patrons looking
                      to support local
                    </li>
                    <li>
                      Tag us in your content and we can promote on our platform
                    </li>
                    <li>
                      Potentially be featured in our social media, newsletters,
                      and podcast
                    </li>
                    <li>More opportunities for collaboration</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7">
                <AccordionTrigger>Who can become a Pana?</AccordionTrigger>
                <AccordionContent>
                  Any locally-based creatives, organization, or small business
                  can become a member of our collective. Eligibility requires
                  residence in Broward, Miami-Dade, or Palm Beach County for
                  either yourself or the owner/director of the
                  business/organization.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8">
                <AccordionTrigger>
                  Where can I access the directory?
                </AccordionTrigger>
                <AccordionContent>
                  We&apos;ve crafted a Google Sheets file complete with keyword
                  search capability and tags, which you can access through the
                  link in our bio. Our ultimate goal is to onboard all
                  locally-owned businesses, transforming the directory into an
                  indispensable lifestyle tool - fostering collaborations by
                  connecting businesses and creatives.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9">
                <AccordionTrigger>
                  What are the Terms & Conditions?
                </AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2">
                    We maintain the authority to remove individuals from the
                    directory if they engage in harmful and hateful behavior
                    towards others or the community as a whole.
                  </p>
                  <p>
                    Becoming a member is straightforward. You need to be a
                    locally owned and operated business in South Florida and
                    complete our form.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>
    </div>
  );
}
