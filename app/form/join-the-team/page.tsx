import type { Metadata } from 'next';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export const metadata: Metadata = {
  title: 'Join The Team - Pana MIA Club',
  description:
    'Join the Pana MIA team! We are looking for enthusiastic contributors to help us transform South Florida.',
};

export default function JoinTheTeamPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-4xl font-bold">Join The Team</h1>
          <p className="text-lg text-muted-foreground">
            Passionate about community and local growth? We&apos;re looking for
            enthusiastic contributors to help us transform South Florida! Apply
            via the form below
          </p>
        </div>

        {/* Job Positions Accordion */}
        <div className="mb-12">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left text-xl font-semibold">
                Developer/UX Developer
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>
                  Pana MIA is, at its core, a technological solution, a digital
                  tool to connect and unite local communities. Join the Pana MIA
                  developer community and bring to life digital tools that will
                  transform living and loving locally. Looking for front end
                  developers, UI/UX designers, JS/React developers. Check out
                  our GitHub in our bio.
                </p>
                <p>
                  <strong>Project Examples:</strong> Accessible/CoOp Housing
                  Forum, jobs board, optimizing connectivity and accessibility
                  within the platform, community /activism page, site
                  retheme-ing
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left text-xl font-semibold">
                Social Media Manager
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>
                  Do you love connecting on social media and want to help local
                  brands, businesses and creatives?
                </p>
                <p>
                  Use your storytelling skills to bring awareness to locals
                  making a meaningful impact in their communities. Tap into our
                  growing network and curate the narrative of what it means to
                  live and love South Florida. We&apos;re looking for someone
                  creative and consistent.
                </p>
                <p>
                  <strong>Content Pillar:</strong> Highlights from our podcast
                  interviews, promoting the adoption of the local directory as a
                  fun tool, educating on the importance of living a more locally
                  minded lifestyle, offering tools and advice to new
                  entrepreneurs and creatives, engaging on social media.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left text-xl font-semibold">
                Event Coordinator
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>
                  Pana MIA loves putting on events that promote local arts and
                  culture. If you are interested in creating intentional events
                  that help connect and foster community, consider joining our
                  team as Pana MIA&apos;s event coordinator. You will have
                  access to Pana MIA&apos;s growing network of performers,
                  vendors and venues.
                </p>
                <p>
                  <strong>Event Examples:</strong> Art Print Fair, vendor
                  markets, Local Music Festivals, Industry Specific Networking
                  events, Workshops, Education Panels, etc.
                </p>
                <p>
                  <strong>
                    This position is compensated as a percentage of event
                    revenue
                  </strong>
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left text-xl font-semibold">
                Content Producer/Editor
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>
                  Are you an aspiring filmmaker or content creator? Use your
                  storytelling skills to bring awareness to locals making a
                  meaningful impact in their communities. Tap into our growing
                  network and curate the narrative of what it means to live and
                  love South Florida.
                </p>
                <p>
                  <strong>Content Pillars:</strong> Highlights from our podcast
                  interviews, promoting the adoption of the local directory as a
                  fun tool, educating on the importance of living a more locally
                  minded lifestyle, offering tools and advice to new
                  entrepreneurs and creatives.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-left text-xl font-semibold">
                Grant Writer
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>
                  Help us build a sustainable organization! In order for Pana
                  MIA to grow sustainably - we need funds!
                </p>
                <p>
                  If you&apos;re looking to build your portfolio as a grant
                  writer or copywriter- Pana MIA is looking for compelling
                  writers to join our team for this purpose. We&apos;re looking
                  for excellent storytellers with a passion for community
                  advocacy.
                </p>
                <p>
                  <strong>Project Examples:</strong> Researching and Applying
                  for grants, Assist in Newsletter creation, creating website
                  and email copy that for fundraising purposes.
                </p>
                <p>
                  <strong>
                    This position is compensated as a percentage of awarded
                    grant funds
                  </strong>
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-left text-xl font-semibold">
                Community Engagement Affiliate
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>
                  If you&apos;re someone looking to gain experience in Public
                  Relations, Communications and/or Community Engagement and are
                  interested in becoming more connected with South Florida
                  community, this is a great role for you. We&apos;re looking
                  for someone communicative and organized.
                </p>
                <p>
                  <strong>What You Can Expect:</strong> Community outreach,
                  assembly of press kits and sponsorship decks, Pana Relations
                  managing, engaging on social media, affiliate program
                  management, creative campaign ideation
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger className="text-left text-xl font-semibold">
                Outreach Partners
              </AccordionTrigger>
              <AccordionContent className="space-y-4 text-base">
                <p>
                  Are you looking to engage in local South Florida scene more
                  intentionally? Are you out-going or looking to practice public
                  speaking?
                </p>
                <p>
                  Pana MIA is looking for friendly, community-minded people that
                  want to represent us at events, online and in community.
                  Partners will help us raise awareness of our mission and
                  educate on the importance of supporting local in South
                  Florida, what we do to help and how to support Pana MIA.
                </p>
                <p>
                  <strong>What You Can Expect:</strong> Tabling at Events,
                  Content Creation, Community Outreach, Event Volunteering,
                  Content Distribution
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Google Form Embed */}
        <div className="w-full">
          <iframe
            src="https://docs.google.com/forms/d/e/1FAIpQLScD2cLJ7LM8dhcbaArXPRTn1XkA74siZMs-f16rikHiRCVCvg/viewform?embedded=true"
            className="h-[1200px] w-full rounded-lg border-0 md:h-[1400px]"
            title="Join The Team Application Form"
          >
            Loading...
          </iframe>
        </div>
      </div>
    </div>
  );
}
