'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AboutUsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section
        className="relative bg-cover bg-center py-32 text-center md:py-48"
        style={{ backgroundImage: 'url(/img/about/florida.jpg)' }}
      >
        <div className="absolute inset-0 bg-black/30" />
        <div className="container relative mx-auto px-4">
          <h1 className="mb-4 text-5xl font-bold text-white md:text-6xl">
            About Us
          </h1>
          <p className="text-2xl text-white md:text-3xl">The Future is Local</p>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="bg-pana-navy py-16 text-white md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Our Mission</h2>
              <p className="text-lg leading-relaxed">
                ...is to unite the diverse working class of South Florida,
                igniting the creation of regenerative and vibrant economies. By
                connecting locals and the quality resources, paired with
                education on the advantages of reinvesting within our own
                community, we aim to cultivate financial stability, personal
                engagement, and emphasize the transformative strength of a
                unified community.
              </p>
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Our Vision</h2>
              <h3 className="text-2xl font-semibold">The Future is Local</h3>
              <p className="text-lg">
                Pana MIA Club is a 501(c)(3) non-profit based in South Florida.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col items-start gap-6 md:flex-row">
              <div className="w-full md:w-1/3">
                <Image
                  src="/img/about/clari_and_anette.webp"
                  alt="Clari and Anette, founders of Pana MIA"
                  width={300}
                  height={400}
                  className="w-full rounded-lg"
                />
              </div>
              <div className="w-full space-y-4 md:w-2/3">
                <h2 className="text-3xl font-bold">Our Story</h2>
                <p className="text-lg leading-relaxed">
                  In the spring of 2022, Anette and Clari, two emerging
                  entrepreneurs, formed a fated bond at a Miami market. Despite
                  their differences, their friendship deepened over time,
                  evolving into an opportunity for something greater than
                  themselves.
                </p>
                <p className="text-lg leading-relaxed">
                  Their shared dreams and mutual support became the catalyst for
                  the creation of Pana MIA Club, proving that entrepreneurship
                  doesn't have to be a solo journey. Together, they discovered
                  the power of unity among local entrepreneurs and creatives.
                  Pana MIA's story began in that unexpected meeting that
                  transformed into the foundation of it all.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Projects Section */}
      <section
        className="bg-cover bg-center py-16 md:py-24"
        style={{ backgroundImage: 'url(/img/about/bubbles_navy.jpg)' }}
      >
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-3xl font-bold text-white">
              Our Projects
            </h2>
            <Tabs defaultValue="directorio" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-3 gap-0 bg-transparent p-0">
                <TabsTrigger
                  value="directorio"
                  className="rounded-b-none rounded-t-lg border-4 border-pana-blue py-3 transition-colors hover:bg-pana-blue hover:text-white data-[state=active]:bg-pana-blue data-[state=inactive]:bg-white data-[state=active]:text-white data-[state=inactive]:text-pana-blue"
                >
                  El Directorio
                </TabsTrigger>
                <TabsTrigger
                  value="leolero"
                  className="rounded-b-none rounded-t-lg border-4 border-pana-yellow py-3 transition-colors hover:bg-pana-yellow hover:text-white data-[state=active]:bg-pana-yellow data-[state=inactive]:bg-white data-[state=active]:text-white data-[state=inactive]:text-pana-yellow"
                >
                  LeoLero
                </TabsTrigger>
                <TabsTrigger
                  value="panavizion"
                  className="rounded-b-none rounded-t-lg border-4 border-pana-pink py-3 transition-colors hover:bg-pana-pink hover:text-white data-[state=active]:bg-pana-pink data-[state=inactive]:bg-white data-[state=active]:text-white data-[state=inactive]:text-pana-pink"
                >
                  PanaVizion
                </TabsTrigger>
              </TabsList>
              <TabsContent value="directorio" className="mt-0">
                <Card className="rounded-t-none border-4 border-pana-blue">
                  <CardContent className="p-8">
                    <p className="text-lg leading-relaxed">
                      El Directorio is your access guide to everything locally
                      made and occurring in SoFlo! Our online Local Directory,
                      with easy keyword search functionality, allows patrons to
                      find locally sourced solutions for any need or desire.
                      This enhances convenience for consumers when shopping
                      locally and provides increased visibility for local
                      brands, service providers, and organizations. Our
                      objective is to create a tool that will stimulate the
                      local SoFlo economy and advocate for a lifestyle centered
                      around supporting local businesses.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="leolero" className="mt-0">
                <Card className="rounded-t-none border-4 border-pana-yellow">
                  <CardContent className="p-8">
                    <p className="text-lg leading-relaxed">
                      Discover the vibrant world of LeoLero, our monthly
                      newsletter that brings you a curated selection of
                      exclusive insights. Dive into excerpts from our talented
                      Panas, catch recaps from our podcast, and join engaging
                      conversations led by seasoned experts. Explore topics that
                      resonate with the SoFlo community and stay in the loop
                      with a thoughtfully crafted playlist and a local events
                      calendar for South Florida. LeoLero is your key to the
                      latest happenings, diverse voices, and the heartbeat of
                      our creative community.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="panavizion" className="mt-0">
                <Card className="rounded-t-none border-4 border-pana-pink">
                  <CardContent className="p-8">
                    <p className="text-lg leading-relaxed">
                      PanaVizión serves as a broadcast channel and podcast
                      dedicated to highlighting impactful community leaders in
                      South Florida through curated media content that shares
                      their stories. Our goal is to uncover the rich
                      experiences, talents, and creations that the people of
                      South Florida have to offer. By providing a platform for
                      these stories, we strive to expand the public's
                      perspective and appreciation for the diverse narratives
                      within the community.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* Our Board Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-12">
            <h2 className="text-center text-3xl font-bold">Our Board</h2>

            {/* Anette Mago */}
            <div className="flex flex-col items-start gap-6 md:flex-row">
              <div className="w-full md:w-1/3">
                <Image
                  src="/img/about/anette_mago.jpg"
                  alt="Anette Mago"
                  width={320}
                  height={400}
                  className="w-full rounded-lg"
                />
              </div>
              <div className="w-full space-y-4 md:w-2/3">
                <h3 className="text-2xl font-semibold">
                  Anette Mago, Co-Founder
                </h3>
                <p className="text-lg leading-relaxed">
                  Anette Mago, a Venezuelan-American conceptual artist raised in
                  South Florida, has long been fascinated by the multicultural
                  landscape and vibrant community of her home state. Having
                  graduated from the University of Florida in Visual Art Studies
                  in 2021, she delved into the Miami art scene while
                  establishing her artwear brand, Alobebi. Two years into her
                  entrepreneurial journey, Anette formed a close bond with
                  Claribel, another small business owner. Recognizing the
                  importance of a supportive community, Anette's realization led
                  to the creation of Pana MIA Club, her most ambitious art
                  project to date.
                </p>
              </div>
            </div>

            {/* Claribel Avila */}
            <div className="flex flex-col items-start gap-6 md:flex-row-reverse">
              <div className="w-full md:w-1/3">
                <Image
                  src="/img/about/claribel_avila.jpg"
                  alt="Claribel Avila"
                  width={320}
                  height={400}
                  className="w-full rounded-lg"
                />
              </div>
              <div className="w-full space-y-4 md:w-2/3">
                <h3 className="text-2xl font-semibold">
                  Claribel Avila, Co-Founder
                </h3>
                <p className="text-lg leading-relaxed">
                  Claribel Avila is a Puerto Rican entrepreneur and creative who
                  began calling Miami home in 2021. They graduated from
                  Northeastern University in 2018 with a Bachelors in Economic
                  Policy. Having been raised by an entrepreneurial migrant
                  family, they explored diverse industries and started their
                  first business in 2019, selling herbal-infused honey. Despite
                  their many passions and personal pursuits, their central focus
                  has always been social, economic and racial justice. Moving to
                  Miami brought purpose, and as a problem solver, their work
                  with Pana MIA Club soon became a way to leverage strengths in
                  order to bring about a more equitable and humane world.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Team Section */}
      <section
        className="bg-cover bg-fixed bg-center py-16 md:py-24"
        style={{ backgroundImage: 'url(/img/about/parallax2.jpg)' }}
      >
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-3xl font-bold text-white">
              Our Team
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="text-center">
                <CardContent className="p-4">
                  <Image
                    src="/img/about/bee_maria.jpg"
                    alt="Bee Maria"
                    width={200}
                    height={200}
                    className="mb-3 w-full rounded-lg"
                  />
                  <h3 className="text-lg font-semibold">Bee Maria</h3>
                  <p className="text-sm text-muted-foreground">Copywriter</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-4">
                  <Image
                    src="/img/about/jdowns.jpg"
                    alt="Jeremy Downs"
                    width={200}
                    height={200}
                    className="mb-3 w-full rounded-lg"
                  />
                  <h3 className="text-lg font-semibold">Jeremy Downs</h3>
                  <p className="text-sm text-muted-foreground">
                    Technical Advisor
                  </p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-4">
                  <Image
                    src="/img/about/gbarrios.jpg"
                    alt="Genesis Barrios"
                    width={200}
                    height={200}
                    className="mb-3 w-full rounded-lg"
                  />
                  <h3 className="text-lg font-semibold">Genesis Barrios</h3>
                  <p className="text-sm text-muted-foreground">Web Developer</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Support Our Club Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col items-center gap-8 md:flex-row">
              <div className="w-full md:w-1/3">
                <Image
                  src="/img/about/floridamap_panamia.jpg"
                  alt="Florida map with Pana MIA"
                  width={320}
                  height={400}
                  className="w-full rounded-lg"
                />
              </div>
              <div className="w-full space-y-6 md:w-2/3">
                <h2 className="text-3xl font-bold">Support Our Club</h2>
                <p className="text-lg leading-relaxed">
                  Pana MIA Club works hard towards our vision for a unified
                  local SoFlo community everyday. We know we can do it with your
                  help! You can support us by funding our mission with a
                  one-time donation or by joining our community of supporters
                  called Gente dePana!
                </p>
                <Button
                  size="lg"
                  className="bg-pana-pink hover:bg-pana-pink/90"
                  asChild
                >
                  <Link href="/donate">
                    Help Fund Our Open-Access Local's Directory
                  </Link>
                </Button>
                <p className="text-lg leading-relaxed">
                  Our Gente dePana subscribers are the foundation of Pana MIA's
                  sustainability, monthly contributions allow us to make bigger
                  strides in our projects to support the local community. In
                  return, our Gente are rewarded with so many benefits,
                  discounts and perks that give you special access to all things
                  Pana!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
