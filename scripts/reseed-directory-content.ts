/**
 * Repairs the seeded directory listings so each one describes a single,
 * coherent business.
 *
 * The 100 seeded profiles were generated combinatorially, and the pieces were
 * drawn independently. The result reads convincingly one field at a time and
 * falls apart when you look at a whole row:
 *
 *   - "Ceiba Ceramics" was described as "Leather work done the slow way"
 *   - "Telar Forge" — a forge — sold hand-poured candles
 *   - "Adelante Foundation" led with "Housing advocacy and tenant organizing",
 *     described itself as a mutual aid network, and tagged itself as youth
 *     programming: three different charities in one row
 *   - "Clave Sound" and "Raiz Bodywork" were both filed under Food
 *   - one brand appeared as three businesses — Ceiba Ceramics, Ceiba Craft and
 *     Ceiba Workshop — with no relationship between them
 *
 * There is no generator to fix. The rows were written straight into the
 * database, so this script is the source of truth for their content from here
 * on: re-running it restores every listing to the state described below.
 *
 * How it works
 * ------------
 * Every listing is pinned to an archetype — one real kind of small business,
 * with copy, categories and a photo theme that agree with each other by
 * construction. That replaces the previous approach of guessing a theme from
 * the business name, which could only ever be as good as its keyword list.
 *
 * Renames keep the trailing noun ("Ceiba Craft" becomes "Madera Craft", not
 * "Madera Goods"). Only the brand word moves, so a listing's category, photo
 * and copy stay valid and the rename is legible as the same kind of business
 * under a different name.
 *
 * Multi-location rows are deliberately left paired: "Trenza Studio" and
 * "Trenza Studio Aventura" are one business with two addresses, which is a
 * real pattern and worth keeping. Only same-brand-different-trade rows are
 * split apart.
 *
 * `background` is rewritten rather than regenerated — the old sentence carries
 * a neighborhood and a founding year that are worth keeping, so only the
 * business name inside it is substituted.
 *
 * Usage
 * -----
 *   npx tsx scripts/reseed-directory-content.ts                 # dry run
 *   npx tsx scripts/reseed-directory-content.ts --apply
 *   npx tsx scripts/reseed-directory-content.ts --postgres <url>
 *
 * Without --postgres the target comes from POSTGRES_URL in .env.local, which
 * on a development machine is the local database and not the live site.
 */
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../lib/schema';

config({ path: '.env.local', quiet: true });

const { profiles } = schema;

// A script whose static imports fail to resolve exits 0 under `tsx` with no
// output at all, which is indistinguishable from a clean run reporting
// nothing. Assert on these markers, never on the exit code.
console.log('CONTENT:start');

type Archetype = {
  /** A value from profileCategoryList — note "Venue" is capitalised there. */
  category: string;
  /** Matches a filename prefix in public/img/directory. */
  theme: string;
  /** The card subtitle, shown under the business name. */
  fiveWords: string;
  details: string;
  tags: string;
  /**
   * Alternate copy for archetypes several unrelated businesses share.
   *
   * Four supper clubs reciting the same paragraph is how the original seed
   * data read, and it is the tell that gives away generated content. Listings
   * select a variant through `Listing.v`; branches of one business share an
   * index on purpose, because they really are the same business.
   */
  variants?: { fiveWords: string; details: string }[];
};

const ARCHETYPES: Record<string, Archetype> = {
  // --- food ---------------------------------------------------------------
  'food-truck': {
    category: 'food',
    theme: 'food-truck',
    fiveWords: 'Street food with island roots',
    details:
      'We started out of a home kitchen selling to neighbors and grew into a truck. The menu changes with whatever the local farms and fish markets have, so no two weeks look exactly alike.',
    tags: 'street food, caribbean, catering, late night',
  },
  cafe: {
    category: 'food',
    theme: 'cafe',
    fiveWords: 'Coffee, pastries and a corner to stand on',
    details:
      'Coffee, pastelitos and a place to stand around and talk. We roast in small batches and open early for the people heading to work before anyone else is up.',
    tags: 'coffee, pastries, breakfast, ventanita',
    variants: [
      {
        fiveWords: 'Cortaditos and a counter to lean on',
        details:
          'A walk-up window for cortaditos, colada and whatever came out of the oven that morning. There is no seating, which keeps the line moving and the conversation short.',
      },
      {
        fiveWords: 'Slow mornings, strong coffee',
        details:
          'Single-origin coffee and a short pastry case, open from six. We know most orders by face rather than name, and the back tables are fair game for anyone working.',
      },
    ],
  },
  bakery: {
    category: 'food',
    theme: 'bakery',
    fiveWords: 'Bread and pastries baked overnight',
    details:
      'A family-run bakery working the recipes three generations of our family have used. Everything is baked overnight and sold the same day, and when it runs out it runs out.',
    tags: 'bakery, bread, pastries, family run',
  },
  'supper-club': {
    category: 'food',
    theme: 'supper-club',
    fiveWords: 'Long dinners at a shared table',
    details:
      'A handful of dinners a month at one long table, cooked around whatever is in season. Seats are limited on purpose so the night stays closer to a dinner party than a restaurant.',
    tags: 'supper club, tasting menu, seasonal, reservations',
    variants: [
      {
        fiveWords: 'A set menu, once a week',
        details:
          'One seating a week, one menu, no substitutions beyond allergies. Tickets go up on Sunday and the room holds twenty-two people, which is as many as the kitchen can cook for well.',
      },
      {
        fiveWords: 'Dinners built around one ingredient',
        details:
          'Each dinner is built around a single ingredient we found worth the trip. The menu is not announced in advance, and the price covers the food, the wine and the argument afterwards.',
      },
      {
        fiveWords: 'Home cooking, served to strangers',
        details:
          'Family recipes cooked at volume and served to whoever books a seat. Dinners move between apartments and backyards, so the address goes out the day before.',
      },
    ],
  },
  cocina: {
    category: 'food',
    theme: 'food',
    fiveWords: 'The recipes we grew up on',
    details:
      'A small kitchen cooking the dishes our families cooked, without updating them for anybody. Lunch is the busy hour and most of what we make is gone by two.',
    tags: 'home cooking, lunch, latin, takeout',
  },
  market: {
    category: 'food',
    theme: 'market',
    fiveWords: 'Produce and pantry staples',
    details:
      'A neighborhood market stocking produce, pantry staples and the brands people actually ask for. We buy from local growers first and post what came in that morning.',
    tags: 'grocery, produce, local growers, pantry',
  },

  // --- artisanal ----------------------------------------------------------
  ceramics: {
    category: 'artisanal',
    theme: 'artisanal',
    fiveWords: 'Wheel-thrown pottery made to use',
    details:
      'Wheel-thrown ceramics made for daily use rather than display. Seconds go on the shelf at a discount instead of into the bin, because a warped rim still holds coffee.',
    tags: 'ceramics, pottery, handmade, tableware',
    variants: [
      {
        fiveWords: 'Hand-built stoneware and glazes',
        details:
          'Hand-built stoneware fired in small kiln loads, glazed in colors mixed here rather than bought. No two pieces in a set match exactly and we have stopped apologising for it.',
      },
      {
        fiveWords: 'Pottery classes and studio time',
        details:
          'A teaching studio with wheels you can rent by the hour once you have taken the intro class. Firing is included; the shelf by the door is where finished work waits for pickup.',
      },
    ],
  },
  leather: {
    category: 'artisanal',
    theme: 'artisanal',
    fiveWords: 'Hand-stitched leather, built to repair',
    details:
      'Leather work done the slow way: hand-stitched, edge-finished and repairable. Bring anything we made back when it wears through and we will fix it rather than sell you another.',
    tags: 'leather, handmade, repairs, bags',
  },
  woodwork: {
    category: 'artisanal',
    theme: 'artisanal',
    fiveWords: 'Furniture from salvaged hardwood',
    details:
      'Furniture and small goods built from salvaged South Florida hardwood, most of it from trees that came down in storms. Each piece is different because the material decides.',
    tags: 'woodworking, furniture, salvaged, custom',
    variants: [
      {
        fiveWords: 'Furniture built to be repaired',
        details:
          'Furniture and built-ins made from hardwood, joined so the pieces can be taken apart and fixed later. We keep the drawings in case you need a matching piece in ten years.',
      },
    ],
  },
  candles: {
    category: 'artisanal',
    theme: 'artisanal',
    fiveWords: 'Hand-poured candles and home goods',
    details:
      'Hand-poured candles and home goods using locally sourced scents. We run refills at cost, so the vessel you bought the first time is the one you keep using.',
    tags: 'candles, home goods, refills, small batch',
  },
  metal: {
    category: 'artisanal',
    theme: 'artisanal',
    fiveWords: 'Blacksmithing and metal repair',
    details:
      'Forge work for gates, railings, hardware and the occasional knife. We take repairs nobody else will quote, which is most of what keeps the fire lit.',
    tags: 'blacksmith, metalwork, gates, repairs',
    variants: [
      {
        fiveWords: 'Gates, railings and hand tools',
        details:
          'Forged gates, railings and hand tools, plus repairs on ironwork older than the building it is bolted to. Commissions start with a drawing and a site visit.',
      },
    ],
  },

  // --- apparel ------------------------------------------------------------
  tailor: {
    category: 'apparel',
    theme: 'apparel',
    fiveWords: 'Tailoring for guayaberas and quinces',
    details:
      'Custom tailoring with a focus on guayaberas, formal wear and quinces. Alterations are welcome and usually turned around in a week, sooner if there is a date on it.',
    tags: 'tailoring, alterations, guayabera, formal wear',
    variants: [
      {
        fiveWords: 'Made-to-measure, over two fittings',
        details:
          'Made-to-measure shirts, trousers and jackets, finished over two fittings. We keep your measurements on file, so the second order only takes one visit.',
      },
    ],
  },
  streetwear: {
    category: 'apparel',
    theme: 'apparel',
    fiveWords: 'Streetwear pulled from the neighborhood',
    details:
      'A streetwear label pulling from Caribbean flags, Miami architecture and the signage on our own block. Runs are small and we do not reprint the ones that sell out.',
    tags: 'streetwear, graphic tees, limited runs, local',
    variants: [
      {
        fiveWords: 'Screen-printed tees, cut and sewn here',
        details:
          'Blanks cut and sewn locally, then printed by hand two colors at a time. We post the run size before a drop so nobody has to guess how long it will last.',
      },
      {
        fiveWords: 'Workwear shapes, island colors',
        details:
          'Workwear silhouettes in colors borrowed from a Caribbean paint aisle. Everything is made to be worn hard, and we repair our own garments free for the first year.',
      },
      {
        fiveWords: 'One drop a season, nothing else',
        details:
          'A single collection each season, sold until it is gone. Sizing runs generous, the patterns are drafted here, and there is no outlet rack because there is no leftover stock.',
      },
    ],
  },
  sewing: {
    category: 'apparel',
    theme: 'apparel',
    fiveWords: 'Small-studio sewing, limited runs',
    details:
      'We design and sew in a small studio, producing limited runs rather than stocking sizes we have to discount later. Everything is cut and finished in-house.',
    tags: 'sewing, slow fashion, limited runs, handmade',
    variants: [
      {
        fiveWords: 'Alterations and small production runs',
        details:
          'Alterations for people, and short production runs for labels that cannot meet a factory minimum. Patterns are graded here and samples come back inside two weeks.',
      },
    ],
  },

  // --- art ----------------------------------------------------------------
  gallery: {
    category: 'art',
    theme: 'art',
    fiveWords: 'A working studio and gallery',
    details:
      'A working studio and gallery showing artists from across the Caribbean and its diaspora. Shows rotate every six weeks and the studio stays open while they hang.',
    tags: 'gallery, exhibitions, caribbean, studio',
    variants: [
      {
        fiveWords: 'A working studio open to visitors',
        details:
          'Half gallery, half working studio, open to anyone who wanders in. Shows rotate every six weeks and the artists are usually here painting during them.',
      },
    ],
  },
  printshop: {
    category: 'art',
    theme: 'art',
    fiveWords: 'Screen printing and risograph',
    details:
      'Screen printing and risograph work for artists, bands and nonprofits. Small runs are the point, and we will talk you out of ordering more than you need.',
    tags: 'screen printing, risograph, posters, small runs',
    variants: [
      {
        fiveWords: 'Risograph zines and show posters',
        details:
          'A two-color risograph press that mostly prints zines, show flyers and community newsletters. Misregistration is part of the look, and we price accordingly.',
      },
      {
        fiveWords: 'Letterpress and editioned prints',
        details:
          'Letterpress and editioned prints pulled by hand on cotton paper. Editions are numbered, the plates are destroyed afterwards, and artists keep their own files.',
      },
    ],
  },
  mural: {
    category: 'art',
    theme: 'art',
    fiveWords: 'Murals for businesses and schools',
    details:
      'We paint murals for small businesses, schools and community groups. Most walls start as a conversation with whoever spends the most time looking at them.',
    tags: 'murals, public art, commissions, schools',
  },
  mixedmedia: {
    category: 'art',
    theme: 'art',
    fiveWords: 'Mixed media on migration and memory',
    details:
      'Mixed media work exploring migration, memory and the South Florida landscape. Studio visits happen by appointment and usually run longer than planned.',
    tags: 'mixed media, migration, studio visits, original work',
    variants: [
      {
        fiveWords: 'Assemblage and found-material work',
        details:
          'Assemblage and found-material work by a group of artists who share the space and the scrap pile. Studio visits by appointment, and most pieces sell off the wall.',
      },
    ],
  },

  // --- music --------------------------------------------------------------
  recording: {
    category: 'music',
    theme: 'music',
    fiveWords: 'A studio for independent budgets',
    details:
      'A recording studio built for independent artists on independent budgets. Day rates include an engineer, because a cheap room with nobody in it helps no one.',
    tags: 'recording studio, engineering, day rates, independent',
    variants: [
      {
        fiveWords: 'Analog tracking and mixing',
        details:
          'Tape machines, a live room and an engineer who will tell you when a take is good enough. Day rates include mixing, and the stems go home with you.',
      },
    ],
  },
  producer: {
    category: 'music',
    theme: 'music',
    fiveWords: 'Mixing and mastering, Latin and Caribbean',
    details:
      'Production, mixing and mastering with a focus on Latin and Caribbean genres. We work on revisions until it sits right rather than billing by the pass.',
    tags: 'mixing, mastering, production, latin',
    variants: [
      {
        fiveWords: 'Beats, arrangement and session players',
        details:
          'Production and arrangement, with a list of session players who can be here the same week. We work in whatever software you already use rather than converting you.',
      },
    ],
  },
  dj: {
    category: 'music',
    theme: 'music',
    fiveWords: 'A DJ co-op that shares the calendar',
    details:
      'A co-op of DJs who share gear, a calendar and the work of chasing bookings. If one of us is double-booked the night still gets covered.',
    tags: 'dj, co-op, events, weddings',
    variants: [
      {
        fiveWords: 'Vinyl sets for parties and weddings',
        details:
          'A co-op of DJs playing mostly vinyl, from quinceañeras to warehouse parties. You book through one number and we sort out who is the right fit for the room.',
      },
    ],
  },
  booking: {
    category: 'music',
    theme: 'music',
    fiveWords: 'Live music, backyards to festivals',
    details:
      'We book and play live music across South Florida, from backyard parties to festival stages. Ask about the smaller rooms, since those are the ones we like.',
    tags: 'live music, booking, bands, events',
  },
  rehearsal: {
    category: 'music',
    theme: 'music',
    fiveWords: 'Rehearsal rooms with backline',
    details:
      'Rehearsal rooms with backline, available by the hour. We keep a bulletin board by the door because half the bands in here formed off of it.',
    tags: 'rehearsal space, backline, hourly, bands',
  },

  // --- venues -------------------------------------------------------------
  warehouse: {
    category: 'Venue',
    theme: 'venue',
    fiveWords: 'A warehouse with a stage and a bar',
    details:
      'A converted warehouse with a stage, a bar and room for three hundred people. Load-in is at street level, which the touring acts notice before anything else.',
    tags: 'venue, live music, warehouse, capacity 300',
  },
  courtyard: {
    category: 'Venue',
    theme: 'venue',
    fiveWords: 'An outdoor courtyard for gatherings',
    details:
      'An outdoor courtyard available for weddings, birthdays and pop-up dinners. There is shade by four and string lighting after dark, and no curfew on Fridays.',
    tags: 'courtyard, weddings, outdoor, pop-ups',
    variants: [
      {
        fiveWords: 'An outdoor space under old trees',
        details:
          'An outdoor space under two flamboyán trees, with string lights and seating for eighty. The rain plan is a tent we keep on site, included in the rate.',
      },
    ],
  },
  rooms: {
    category: 'Venue',
    theme: 'venue',
    fiveWords: 'Flexible rooms rented by the hour',
    details:
      'Flexible rooms rented by the hour for classes, workshops and rehearsals. Chairs, tables and a projector are included, so you are not renting those separately.',
    tags: 'workshop space, hourly, classes, meetings',
    variants: [
      {
        fiveWords: 'A rooftop loft for shoots and dinners',
        details:
          'A rooftop loft rented by the half day for photo shoots, dinners and workshops. Freight elevator, blackout curtains, and a skyline you do not have to light.',
      },
    ],
  },
  eventspace: {
    category: 'Venue',
    theme: 'venue',
    fiveWords: 'An event space that stays affordable',
    details:
      'An event space built for the kind of gatherings that get priced out everywhere else. Nonprofit and neighborhood rates are posted rather than negotiated.',
    tags: 'event space, affordable, nonprofit rates, community',
    variants: [
      {
        fiveWords: 'A hall with a stage and a kitchen',
        details:
          'A hall with a small stage, a working kitchen and tables for a hundred and twenty. Sound system included; bring your own caterer or cook in the back yourself.',
      },
    ],
  },

  // --- tech ---------------------------------------------------------------
  web: {
    category: 'tech',
    theme: 'tech',
    fiveWords: 'Websites and online ordering',
    details:
      'We build websites and online ordering for small businesses that have been quoted far too much for both. You own the accounts and the domain, not us.',
    tags: 'web design, online ordering, small business, hosting',
    variants: [
      {
        fiveWords: 'Websites that load on old phones',
        details:
          'Websites built to load fast on an old phone over spotty data, because that is how most of our clients are actually found. You get a login and can edit the text yourself.',
      },
    ],
  },
  itsupport: {
    category: 'tech',
    theme: 'tech',
    fiveWords: 'Bilingual IT support, no contracts',
    details:
      'Bilingual IT support for shops, clinics and community organizations. Month to month, no contracts, and we will tell you when the fix is cheaper than the upgrade.',
    tags: 'it support, bilingual, networks, no contract',
    variants: [
      {
        fiveWords: 'IT help for people, not servers',
        details:
          'On-call IT for small offices and clinics — email, backups, the printer nobody can fix. Flat monthly rate, so calling us is never a budget decision.',
      },
    ],
  },
  software: {
    category: 'tech',
    theme: 'tech',
    fiveWords: 'Custom software and integrations',
    details:
      'Custom software and integrations, mostly for logistics and hospitality. We hand over the source and the documentation at the end of every engagement.',
    tags: 'software, integrations, logistics, custom builds',
    variants: [
      {
        fiveWords: 'Internal tools for small teams',
        details:
          'Internal tools for teams outgrowing spreadsheets — inventory, scheduling, invoicing. We build the smallest thing that solves the problem and leave you able to maintain it.',
      },
      {
        fiveWords: 'Data plumbing between systems',
        details:
          'We connect the systems that will not talk to each other: point of sale to accounting, booking to payroll. Mostly unglamorous work that saves somebody a day every week.',
      },
      {
        fiveWords: 'Mobile apps, start to store',
        details:
          'Mobile apps taken from sketch to app store, including the parts nobody enjoys like review submissions and crash reporting. Source and signing keys are yours from day one.',
      },
    ],
  },
  codeclass: {
    category: 'tech',
    theme: 'tech',
    fiveWords: 'Free Saturday coding classes',
    details:
      'We run a free Saturday coding class for teenagers and career changers, and a paid consultancy that pays for it. Laptops stay in the room for anyone who needs one.',
    tags: 'coding classes, free, mentorship, career change',
  },

  // --- wellness -----------------------------------------------------------
  massage: {
    category: 'wellness',
    theme: 'wellness',
    fiveWords: 'Massage for people who work standing',
    details:
      'Massage and recovery work aimed at people who use their bodies at work. Evening appointments exist because that is when those people are actually free.',
    tags: 'massage, recovery, bodywork, evenings',
    variants: [
      {
        fiveWords: 'Deep tissue and injury work',
        details:
          'Deep tissue and injury work, mostly for people who stand or lift all day. Sessions run ninety minutes because an hour is rarely enough to undo a year.',
      },
    ],
  },
  herbal: {
    category: 'wellness',
    theme: 'wellness',
    fiveWords: 'Herbal consultations, Caribbean tradition',
    details:
      'Herbal consultations drawing on Caribbean and Latin American traditions. We say plainly when something belongs with a doctor instead, and we say it early.',
    tags: 'herbalism, consultations, traditional, caribbean',
    variants: [
      {
        fiveWords: 'Herbal consultations and teas',
        details:
          'Herbal consultations and blended teas, meant to work alongside whatever your doctor already has you on rather than instead of it. Everything is labelled with what is actually in it.',
      },
    ],
  },
  movement: {
    category: 'wellness',
    theme: 'wellness',
    fiveWords: 'Movement and breathwork in the park',
    details:
      'Movement and breathwork classes in the park and in studio. First class is free and nobody is going to ask you to sign up for a year.',
    tags: 'movement, breathwork, classes, outdoors',
    variants: [
      {
        fiveWords: 'Breathwork and slow movement',
        details:
          'Breathwork and slow movement classes for people who have been told to exercise and hated every attempt so far. Mats provided, no mirrors on the walls.',
      },
    ],
  },
  counseling: {
    category: 'wellness',
    theme: 'wellness',
    fiveWords: 'Bilingual counseling, sliding scale',
    details:
      'Bilingual counseling for individuals and families, with sliding-scale spots kept open at all times. Evening and weekend hours are available.',
    tags: 'counseling, bilingual, sliding scale, families',
  },
  physio: {
    category: 'wellness',
    theme: 'wellness',
    fiveWords: 'Rehab for injuries that lingered',
    details:
      'Rehabilitation for the injuries people worked through instead of treating. Sessions are an hour and you leave with something to do between them.',
    tags: 'rehabilitation, physical therapy, injury, mobility',
    variants: [
      {
        fiveWords: 'Rehab for stubborn injuries',
        details:
          'One-on-one rehab for injuries that did not resolve on their own. You leave with exercises written down, not a printout of stick figures nobody follows.',
      },
    ],
  },

  // --- non-profit ---------------------------------------------------------
  mutualaid: {
    category: 'non_profit',
    theme: 'non-profit',
    fiveWords: 'Mutual aid, distributed monthly',
    details:
      'A volunteer-run mutual aid network distributing food, supplies and rent assistance. Everything we raise goes out within the month, and our books are public.',
    tags: 'mutual aid, food, rent assistance, volunteer run',
    variants: [
      {
        fiveWords: 'Groceries delivered, no questions asked',
        details:
          'Weekly grocery runs for neighbors who cannot get to a store, organised by a phone tree and a shared spreadsheet. There is no application and no means test.',
      },
      {
        fiveWords: 'A fund neighbors pay into',
        details:
          'A small emergency fund neighbors pay into and draw from — a car repair, a utility bill, a deposit. Requests are reviewed by the same people who contribute.',
      },
    ],
  },
  youth: {
    category: 'non_profit',
    theme: 'non-profit',
    fiveWords: 'After-school and summer programming',
    details:
      'After-school and summer programming for kids in neighborhoods with few options nearby. Transportation is included, because that is usually the reason families cannot attend.',
    tags: 'youth programs, after school, summer, free',
  },
  garden: {
    category: 'non_profit',
    theme: 'non-profit',
    fiveWords: 'Community gardens run by neighbors',
    details:
      'Community gardens and food distribution sites run with neighbors rather than for them. Plots are free and the waiting list moves faster than people expect.',
    tags: 'community garden, food access, volunteer, neighbors',
    variants: [
      {
        fiveWords: 'A community garden and seed library',
        details:
          'A community garden with beds anyone can claim for a season, and a seed library that runs on trust. Saturday work days end with whatever is ripe getting split up.',
      },
    ],
  },
  housing: {
    category: 'non_profit',
    theme: 'non-profit',
    fiveWords: 'Housing advocacy and tenant organizing',
    details:
      'Housing advocacy and tenant organizing, including know-your-rights clinics held in the buildings themselves. Everything we do is free to tenants.',
    tags: 'housing, tenants rights, advocacy, clinics',
    variants: [
      {
        fiveWords: 'Eviction defense and rent clinics',
        details:
          'Weekly clinics where tenants facing eviction can get help reading a notice, filing an answer and finding a lawyer. Volunteers include paralegals and two retired judges.',
      },
    ],
  },

  // --- services -----------------------------------------------------------
  notary: {
    category: 'services',
    theme: 'services',
    fiveWords: 'Document preparation and notary',
    details:
      'Document preparation and notary services. We are not attorneys and will say so before you ask, then point you to one when that is what you actually need.',
    tags: 'notary, documents, translations, apostille',
    variants: [
      {
        fiveWords: 'Translations, certified and stamped',
        details:
          'Certified translations of birth certificates, transcripts and court documents, plus the apostille when the receiving country wants one. Turnaround is two business days.',
      },
      {
        fiveWords: 'Mobile notary, evenings and weekends',
        details:
          'A mobile notary who comes to the hospital, the office or the kitchen table, including evenings and weekends. Closing packages and loan signings are the usual reason to call.',
      },
    ],
  },
  bookkeeping: {
    category: 'services',
    theme: 'services',
    fiveWords: 'Bookkeeping and tax prep, explained',
    details:
      'Bookkeeping and tax prep for small businesses, with everything explained in plain language before it is filed. We work year-round, not just in April.',
    tags: 'bookkeeping, taxes, small business, bilingual',
  },
  moving: {
    category: 'services',
    theme: 'services',
    fiveWords: 'Local moving with flat quotes',
    details:
      'Local moving and hauling with flat quotes given up front. We have moved enough walk-ups to know what the stairs add, so the number does not change on the day.',
    tags: 'moving, hauling, flat rate, local',
    variants: [
      {
        fiveWords: 'Two people, a truck, flat rate',
        details:
          'Local moves and hauling at a flat rate quoted after we see the place, so the number does not change on the day. We take the old mattress to the transfer station for you.',
      },
    ],
  },
  photo: {
    category: 'services',
    theme: 'services',
    fiveWords: 'Photo and video for small businesses',
    details:
      'Photography and video for small businesses, families and events. Packages include the raw files, which is the part most people find out about too late.',
    tags: 'photography, video, events, small business',
    variants: [
      {
        fiveWords: 'Portraits and documents, same day',
        details:
          'Portrait sittings, passport and visa photos, and document scanning, most of it finished the same day. Prints come from a lab rather than an office printer.',
      },
    ],
  },

  // --- products -----------------------------------------------------------
  coffee: {
    category: 'products',
    theme: 'products',
    fiveWords: 'Coffee roasted from direct trade',
    details:
      'We roast coffee sourced through direct relationships with growers, in batches small enough that the roast date on the bag still means something.',
    tags: 'coffee, roastery, direct trade, subscriptions',
    variants: [
      {
        fiveWords: 'Whole bean, roasted to order',
        details:
          'Whole bean coffee roasted the day it ships, in three roast levels and nothing else. Subscriptions can be paused from the same email that confirms them.',
      },
    ],
  },
  skincare: {
    category: 'products',
    theme: 'products',
    fiveWords: 'Skincare made for heat and humidity',
    details:
      'Skincare formulated for heat and humidity, made without the fillers that make everything feel heavier than it needs to be. Full ingredient lists on every label.',
    tags: 'skincare, small batch, humidity, fragrance free',
    variants: [
      {
        fiveWords: 'Small-batch balms and oils',
        details:
          'Balms, oils and salves made in small batches with short ingredient lists. Everything is unscented by default, because most people react to the fragrance rather than the oil.',
      },
    ],
  },
  plants: {
    category: 'products',
    theme: 'products',
    fiveWords: 'Plants that survive this climate',
    details:
      'A plant shop focused on species that actually thrive in this climate. We would rather sell you one plant that lives than three that do not.',
    tags: 'plants, native species, repotting, advice',
  },
  smallbatch: {
    category: 'products',
    theme: 'products',
    fiveWords: 'Small-batch goods from our own kitchen',
    details:
      'Small-batch goods produced in our own kitchen and workshop, sold at markets and here. Production follows what is in season rather than a calendar.',
    tags: 'small batch, markets, seasonal, handmade',
    variants: [
      {
        fiveWords: 'Preserves and hot sauce, in season',
        details:
          'Preserves, hot sauce and pickles made when the fruit is cheap and good rather than year round. When a flavor sells out it is gone until the next season.',
      },
    ],
  },
};

type Listing = {
  /** Current screenname, used to find the row. Never changes. */
  from: string;
  /** Final business name. */
  name: string;
  /** Final screenname. Equal to `from` when the listing is not renamed. */
  slug: string;
  type: keyof typeof ARCHETYPES;
  /**
   * Which copy variant to use, for archetypes several businesses share.
   * 0 (the default) is the archetype's base copy; 1 and up index
   * `Archetype.variants`. Branches of one business share a value.
   */
  v?: number;
};

/**
 * Every seeded listing and what it should be.
 *
 * Rows where `slug` differs from `from` are the de-duplicated ones: a brand
 * that had been split across several unrelated trades. The trailing noun is
 * kept so the listing still reads as the same kind of business.
 */
const LISTINGS: Listing[] = [
  // Adelante — was one brand running as three different charities.
  {
    from: 'adelante-foundation',
    name: 'Adelante Foundation',
    slug: 'adelante-foundation',
    type: 'mutualaid',
  },
  {
    from: 'adelante-fund',
    name: 'Esperanza Fund',
    slug: 'esperanza-fund',
    type: 'housing',
  },
  {
    from: 'adelante-project',
    name: 'Querencia Project',
    slug: 'querencia-project',
    type: 'youth',
  },

  // Aqua Vida — three wellness practices under one name.
  {
    from: 'aqua-vida-movement',
    name: 'Sereno Movement',
    slug: 'sereno-movement',
    type: 'movement',
  },
  {
    from: 'aqua-vida-studio',
    name: 'Manantial Studio',
    slug: 'manantial-studio',
    type: 'massage',
  },
  {
    from: 'aqua-vida-wellness',
    name: 'Aqua Vida Wellness',
    slug: 'aqua-vida-wellness',
    type: 'herbal',
  },

  {
    from: 'arepa-bakery',
    name: 'Arepa Bakery',
    slug: 'arepa-bakery',
    type: 'bakery',
  },
  {
    from: 'arepa-supper-club',
    name: 'Mofongo Supper Club',
    slug: 'mofongo-supper-club',
    type: 'supper-club',
  },

  {
    from: 'bahia-hall',
    name: 'Bahia Hall',
    slug: 'bahia-hall',
    type: 'warehouse',
  },
  {
    from: 'bajo-mundo-sound',
    name: 'Bajo Mundo Sound',
    slug: 'bajo-mundo-sound',
    type: 'recording',
  },
  {
    from: 'barrio-arts-lab',
    name: 'Barrio Arts Lab',
    slug: 'barrio-arts-lab',
    type: 'gallery',
  },
  {
    from: 'barrio-fits-workshop',
    name: 'Barrio Fits Workshop',
    slug: 'barrio-fits-workshop',
    type: 'streetwear',
  },

  {
    from: 'bienestar-studio',
    name: 'Sosiego Studio',
    slug: 'sosiego-studio',
    type: 'counseling',
  },
  {
    from: 'bienestar-therapy',
    name: 'Bienestar Therapy',
    slug: 'bienestar-therapy',
    type: 'physio',
  },

  {
    from: 'brickell-byte-studio',
    name: 'Brickell Byte Studio',
    slug: 'brickell-byte-studio',
    type: 'software',
  },
  {
    from: 'buen-camino-agency',
    name: 'Buen Camino Agency',
    slug: 'buen-camino-agency',
    type: 'notary',
  },

  // Cafecito Code — one brand sold as three separate tech shops.
  {
    from: 'cafecito-code-consulting',
    name: 'Cafecito Code Consulting',
    slug: 'cafecito-code-consulting',
    type: 'itsupport',
  },
  {
    from: 'cafecito-code-systems',
    name: 'Brujula Systems',
    slug: 'brujula-systems',
    type: 'software',
    v: 1,
  },
  {
    from: 'cafecito-code-works',
    name: 'Enlace Works',
    slug: 'enlace-works',
    type: 'web',
  },

  // Casa Abierta — a genuine two-location business, kept paired.
  {
    from: 'casa-abierta-event-space',
    name: 'Casa Abierta Event Space',
    slug: 'casa-abierta-event-space',
    type: 'courtyard',
  },
  {
    from: 'casa-abierta-event-space-kendall',
    name: 'Casa Abierta Event Space Kendall',
    slug: 'casa-abierta-event-space-kendall',
    type: 'courtyard',
  },

  // Ceiba — a ceramicist, a woodworker and a leatherworker sharing a name.
  {
    from: 'ceiba-ceramics',
    name: 'Ceiba Ceramics',
    slug: 'ceiba-ceramics',
    type: 'ceramics',
  },
  {
    from: 'ceiba-craft',
    name: 'Madera Craft',
    slug: 'madera-craft',
    type: 'woodwork',
  },
  {
    from: 'ceiba-workshop',
    name: 'Cuero Workshop',
    slug: 'cuero-workshop',
    type: 'leather',
  },

  {
    from: 'cielo-collective',
    name: 'Cielo Collective',
    slug: 'cielo-collective',
    type: 'printshop',
  },
  {
    from: 'clave-sound',
    name: 'Clave Sound',
    slug: 'clave-sound',
    type: 'producer',
  },

  {
    from: 'comunidad-coalition',
    name: 'Comunidad Coalition',
    slug: 'comunidad-coalition',
    type: 'garden',
  },
  {
    from: 'comunidad-project',
    name: 'Arraigo Project',
    slug: 'arraigo-project',
    type: 'mutualaid',
    v: 1,
  },

  {
    from: 'confianza-agency',
    name: 'Amparo Agency',
    slug: 'amparo-agency',
    type: 'notary',
    v: 1,
  },
  {
    from: 'confianza-partners',
    name: 'Cumbre Partners',
    slug: 'cumbre-partners',
    type: 'photo',
  },
  {
    from: 'confianza-services',
    name: 'Confianza Services',
    slug: 'confianza-services',
    type: 'bookkeeping',
  },

  {
    from: 'corriente-collective',
    name: 'Circuito Collective',
    slug: 'circuito-collective',
    type: 'codeclass',
  },
  {
    from: 'corriente-works',
    name: 'Corriente Works',
    slug: 'corriente-works',
    type: 'web',
    v: 1,
  },

  {
    from: 'cosecha-market',
    name: 'Cosecha Market',
    slug: 'cosecha-market',
    type: 'market',
  },

  {
    from: 'costa-dj-co-op',
    name: 'Guaracha DJ Co-op',
    slug: 'guaracha-dj-co-op',
    type: 'dj',
  },
  {
    from: 'costa-records',
    name: 'Costa Records',
    slug: 'costa-records',
    type: 'recording',
    v: 1,
  },

  // El Fogon — a cafe, a truck and a supper club under one name.
  {
    from: 'el-fogon-cafe',
    name: 'Ventanita Cafe',
    slug: 'ventanita-cafe',
    type: 'cafe',
  },
  {
    from: 'el-fogon-food-truck',
    name: 'El Fogon Food Truck',
    slug: 'el-fogon-food-truck',
    type: 'food-truck',
  },
  {
    from: 'el-fogon-supper-club',
    name: 'Sancocho Supper Club',
    slug: 'sancocho-supper-club',
    type: 'supper-club',
    v: 1,
  },

  // "Flor de Supply" reads as a truncation rather than a name.
  {
    from: 'flor-de-supply',
    name: 'Flor de Mayo Supply',
    slug: 'flor-de-mayo-supply',
    type: 'smallbatch',
  },

  {
    from: 'fuego-lento-craft',
    name: 'Fuego Lento Craft',
    slug: 'fuego-lento-craft',
    type: 'ceramics',
    v: 1,
  },
  {
    from: 'fuego-lento-goods',
    name: 'Artesa Goods',
    slug: 'artesa-goods',
    type: 'candles',
  },

  // Herrero means blacksmith; it had been described as a leather workshop.
  {
    from: 'herrero-workshop',
    name: 'Herrero Workshop',
    slug: 'herrero-workshop',
    type: 'metal',
  },

  {
    from: 'hilo-supply',
    name: 'Percal Supply',
    slug: 'percal-supply',
    type: 'streetwear',
    v: 1,
  },
  {
    from: 'hilo-threads',
    name: 'Hilo Threads',
    slug: 'hilo-threads',
    type: 'sewing',
  },
  {
    from: 'hilo-workshop',
    name: 'Aguja Workshop',
    slug: 'aguja-workshop',
    type: 'tailor',
  },

  {
    from: 'isla-verde-provisions',
    name: 'Isla Verde Provisions',
    slug: 'isla-verde-provisions',
    type: 'coffee',
  },
  {
    from: 'isla-verde-provisions-boca-raton',
    name: 'Isla Verde Provisions Boca Raton',
    slug: 'isla-verde-provisions-boca-raton',
    type: 'coffee',
  },
  {
    from: 'isla-verde-supply',
    name: 'Cayo Supply',
    slug: 'cayo-supply',
    type: 'plants',
  },
  {
    from: 'isla-verde-trading-co',
    name: 'Arrecife Trading Co',
    slug: 'arrecife-trading-co',
    type: 'skincare',
  },

  {
    from: 'la-croqueta-supper-club',
    name: 'La Croqueta Supper Club',
    slug: 'la-croqueta-supper-club',
    type: 'supper-club',
    v: 2,
  },

  {
    from: 'la-llave-services',
    name: 'La Llave Services',
    slug: 'la-llave-services',
    type: 'moving',
  },
  {
    from: 'la-llave-services-kendall',
    name: 'La Llave Services Kendall',
    slug: 'la-llave-services-kendall',
    type: 'moving',
  },

  {
    from: 'la-terraza-hall',
    name: 'Malecon Hall',
    slug: 'malecon-hall',
    type: 'eventspace',
  },
  {
    from: 'la-terraza-loft',
    name: 'La Terraza Loft',
    slug: 'la-terraza-loft',
    type: 'rooms',
  },
  {
    from: 'la-terraza-loft-delray-beach',
    name: 'La Terraza Loft Delray Beach',
    slug: 'la-terraza-loft-delray-beach',
    type: 'rooms',
  },

  {
    from: 'lechon-cafe',
    name: 'Colada Cafe',
    slug: 'colada-cafe',
    type: 'cafe',
    v: 1,
  },
  {
    from: 'lechon-cocina',
    name: 'Lechon Cocina',
    slug: 'lechon-cocina',
    type: 'cocina',
  },

  {
    from: 'mango-sticky-supper-club',
    name: 'Mango Sticky Supper Club',
    slug: 'mango-sticky-supper-club',
    type: 'supper-club',
    v: 3,
  },
  {
    from: 'manos-services',
    name: 'Manos Services',
    slug: 'manos-services',
    type: 'photo',
    v: 1,
  },

  // "Mar y" is another truncation — "Mar y Sol" is the name it wants to be.
  {
    from: 'mar-y-provisions',
    name: 'Mar y Sol Provisions',
    slug: 'mar-y-sol-provisions',
    type: 'skincare',
    v: 1,
  },
  {
    from: 'mar-y-trading-co',
    name: 'Ambar Trading Co',
    slug: 'ambar-trading-co',
    type: 'smallbatch',
    v: 1,
  },

  {
    from: 'marea-atelier',
    name: 'Marea Atelier',
    slug: 'marea-atelier',
    type: 'gallery',
    v: 1,
  },
  {
    from: 'marea-collective',
    name: 'Lienzo Collective',
    slug: 'lienzo-collective',
    type: 'mixedmedia',
  },

  {
    from: 'norte-group',
    name: 'Norte Group',
    slug: 'norte-group',
    type: 'notary',
    v: 2,
  },

  {
    from: 'palma-collective',
    name: 'Sendero Collective',
    slug: 'sendero-collective',
    type: 'itsupport',
    v: 1,
  },
  {
    from: 'palma-works',
    name: 'Palma Works',
    slug: 'palma-works',
    type: 'software',
    v: 2,
  },
  {
    from: 'palmera-collective',
    name: 'Palmera Collective',
    slug: 'palmera-collective',
    type: 'mural',
  },

  {
    from: 'puente-co',
    name: 'Puente Co',
    slug: 'puente-co',
    type: 'moving',
    v: 1,
  },

  {
    from: 'puerta-abierta-coalition',
    name: 'Abrigo Coalition',
    slug: 'abrigo-coalition',
    type: 'housing',
    v: 1,
  },
  {
    from: 'puerta-abierta-fund',
    name: 'Puerta Abierta Fund',
    slug: 'puerta-abierta-fund',
    type: 'mutualaid',
    v: 2,
  },

  {
    from: 'raiz-bodywork',
    name: 'Raiz Bodywork',
    slug: 'raiz-bodywork',
    type: 'massage',
    v: 1,
  },
  {
    from: 'raiz-studio',
    name: 'Alivio Studio',
    slug: 'alivio-studio',
    type: 'physio',
    v: 1,
  },
  {
    from: 'raiz-wellness',
    name: 'Hierba Wellness',
    slug: 'hierba-wellness',
    type: 'herbal',
    v: 1,
  },

  {
    from: 'respira-wellness',
    name: 'Respira Wellness',
    slug: 'respira-wellness',
    type: 'movement',
    v: 1,
  },
  {
    from: 'rumba-records',
    name: 'Rumba Records',
    slug: 'rumba-records',
    type: 'producer',
    v: 1,
  },

  {
    from: 'salon-tropical-courtyard',
    name: 'Flamboyan Courtyard',
    slug: 'flamboyan-courtyard',
    type: 'courtyard',
    v: 1,
  },
  {
    from: 'salon-tropical-hall',
    name: 'Salon Tropical Hall',
    slug: 'salon-tropical-hall',
    type: 'eventspace',
    v: 1,
  },
  {
    from: 'salon-tropical-loft',
    name: 'Azotea Loft',
    slug: 'azotea-loft',
    type: 'rooms',
    v: 1,
  },

  {
    from: 'semilla-goods',
    name: 'Semilla Goods',
    slug: 'semilla-goods',
    type: 'coffee',
    v: 1,
  },
  {
    from: 'sofrito-cafe',
    name: 'Sofrito Cafe',
    slug: 'sofrito-cafe',
    type: 'cafe',
    v: 2,
  },

  {
    from: 'solar-collective',
    name: 'Ocaso Collective',
    slug: 'ocaso-collective',
    type: 'mixedmedia',
    v: 1,
  },
  {
    from: 'solar-print-shop',
    name: 'Solar Print Shop',
    slug: 'solar-print-shop',
    type: 'printshop',
    v: 1,
  },

  {
    from: 'sonido-collective',
    name: 'Guiro Collective',
    slug: 'guiro-collective',
    type: 'booking',
  },
  {
    from: 'sonido-dj-co-op',
    name: 'Sonido DJ Co-op',
    slug: 'sonido-dj-co-op',
    type: 'dj',
    v: 1,
  },
  {
    from: 'sonido-dj-co-op-hollywood',
    name: 'Sonido DJ Co-op Hollywood',
    slug: 'sonido-dj-co-op-hollywood',
    type: 'dj',
    v: 1,
  },
  {
    from: 'sonido-rehearsal-room',
    name: 'Montuno Rehearsal Room',
    slug: 'montuno-rehearsal-room',
    type: 'rehearsal',
  },

  {
    from: 'sur-digital-labs',
    name: 'Sur Digital Labs',
    slug: 'sur-digital-labs',
    type: 'software',
    v: 3,
  },

  {
    from: 'taller-taller',
    name: 'Arcilla Taller',
    slug: 'arcilla-taller',
    type: 'ceramics',
    v: 2,
  },
  {
    from: 'taller-workshop',
    name: 'Taller Workshop',
    slug: 'taller-workshop',
    type: 'woodwork',
    v: 1,
  },

  {
    from: 'tejido-label',
    name: 'Tejido Label',
    slug: 'tejido-label',
    type: 'streetwear',
    v: 2,
  },

  // Telar means loom, which a forge is not. Yunque — anvil — matches the trade.
  {
    from: 'telar-forge',
    name: 'Yunque Forge',
    slug: 'yunque-forge',
    type: 'metal',
    v: 1,
  },

  {
    from: 'trenza-studio',
    name: 'Trenza Studio',
    slug: 'trenza-studio',
    type: 'tailor',
    v: 1,
  },
  {
    from: 'trenza-studio-aventura',
    name: 'Trenza Studio Aventura',
    slug: 'trenza-studio-aventura',
    type: 'tailor',
    v: 1,
  },
  {
    from: 'trenza-supply',
    name: 'Puntada Supply',
    slug: 'puntada-supply',
    type: 'sewing',
    v: 1,
  },
  {
    from: 'trenza-threads',
    name: 'Costura Threads',
    slug: 'costura-threads',
    type: 'streetwear',
    v: 3,
  },

  {
    from: 'tropico-print-shop',
    name: 'Tropico Print Shop',
    slug: 'tropico-print-shop',
    type: 'printshop',
    v: 2,
  },
  {
    from: 'tropico-print-shop-hialeah',
    name: 'Tropico Print Shop Hialeah',
    slug: 'tropico-print-shop-hialeah',
    type: 'printshop',
    v: 2,
  },

  {
    from: 'vecinos-alliance',
    name: 'Vecinos Alliance',
    slug: 'vecinos-alliance',
    type: 'garden',
    v: 1,
  },
  {
    from: 'vecinos-alliance-homestead',
    name: 'Vecinos Alliance Homestead',
    slug: 'vecinos-alliance-homestead',
    type: 'garden',
    v: 1,
  },
];

/**
 * Picks the three photos for a theme, rotated so listings sharing a theme do
 * not all lead with the same image. Mirrors seed-business-photos.ts.
 */
function photosFor(theme: string, seed: number): string[] {
  const files = [1, 2, 3].map((n) => `/img/directory/${theme}-0${n}.jpg`);
  const offset = seed % files.length;
  return files.map((_, i) => files[(offset + i) % files.length]);
}

/** Describes the target without ever printing the URL, which holds a password. */
function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return 'unparseable connection string';
  }
}

function isLocalTarget(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const urlIndex = args.indexOf('--postgres');
  const postgresUrl =
    urlIndex >= 0 ? args[urlIndex + 1] : process.env.POSTGRES_URL;

  if (!postgresUrl) {
    console.error(
      '  POSTGRES_URL is required. Pass --postgres <url> or set it in .env.local.'
    );
    process.exit(1);
  }

  // Name the database before touching it. A local and a production URL differ
  // by very little at a glance and the consequences do not.
  console.log(`  database: ${describeTarget(postgresUrl)}`);
  if (apply && isLocalTarget(postgresUrl)) {
    console.log('  note: this is the local dev database, not the live site');
  }

  const duplicateSlugs = LISTINGS.map((l) => l.slug).filter(
    (slug, i, all) => all.indexOf(slug) !== i
  );
  if (duplicateSlugs.length > 0) {
    console.error(`  duplicate slugs in table: ${duplicateSlugs.join(', ')}`);
    process.exit(1);
  }

  const client = postgres(postgresUrl);
  const db = drizzle(client, { schema });

  try {
    const rows = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        screenname: profiles.screenname,
        descriptions: profiles.descriptions,
        galleryImages: profiles.galleryImages,
        socials: profiles.socials,
      })
      .from(profiles);

    const bySlug = new Map(
      rows.filter((r) => r.screenname).map((r) => [r.screenname as string, r])
    );

    console.log(`  profiles: ${rows.length} total`);
    console.log(`  listings in table: ${LISTINGS.length}`);
    console.log('');

    // A listing is keyed by the screenname it had when this script was
    // written, but after a run the row answers to its new slug instead. Try
    // both so the script stays re-runnable and idempotent.
    const rowFor = (l: Listing) => bySlug.get(l.from) ?? bySlug.get(l.slug);

    // screenname is uniquely indexed, and the rows are updated one at a time.
    // A new slug that some other profile currently holds would collide part
    // way through and leave the table half rewritten, so check up front.
    // A slug held by the very row being renamed is fine — that is what a
    // second run of this script looks like once the rename has landed.
    const claimed = new Set(LISTINGS.map((l) => l.from));
    const collisions = LISTINGS.filter((l) => {
      if (l.slug === l.from) return false;
      const holder = bySlug.get(l.slug);
      if (!holder) return false;
      if (claimed.has(l.slug)) return false;
      return holder.id !== rowFor(l)?.id;
    });
    if (collisions.length > 0) {
      console.error(
        `  new slugs already taken: ${collisions.map((c) => c.slug).join(', ')}`
      );
      process.exit(1);
    }

    // A `v` past the end of an archetype's variants would silently fall back to
    // the base copy, which is the duplication this is meant to avoid.
    const badVariants = LISTINGS.filter(
      (l) => l.v != null && l.v > (ARCHETYPES[l.type].variants?.length ?? 0)
    );
    if (badVariants.length > 0) {
      console.error(
        `  variant out of range: ${badVariants
          .map((l) => `${l.slug} (${l.type} v${l.v})`)
          .join(', ')}`
      );
      process.exit(1);
    }

    // Two unrelated businesses landing on the same archetype and variant would
    // print the same paragraph, so surface it rather than wait for someone to
    // notice on the page. Branches of one business are expected to match.
    const copyUse = new Map<string, string[]>();
    for (const l of LISTINGS) {
      const key = `${l.type}:${l.v ?? 0}`;
      copyUse.set(key, [...(copyUse.get(key) ?? []), l.name]);
    }
    const shared = [...copyUse.entries()].filter(([, names]) => {
      if (names.length < 2) return false;
      // Branch rows are the shorter name plus a city, e.g. "Trenza Studio
      // Aventura", so treat a shared prefix as the same business.
      const base = [...names].sort((a, b) => a.length - b.length)[0];
      return !names.every((n) => n.startsWith(base));
    });

    let updated = 0;
    let renamed = 0;
    let socialsFixed = 0;
    const staleSocials: string[] = [];
    const absent: string[] = [];

    for (const [index, listing] of LISTINGS.entries()) {
      const row = rowFor(listing);
      if (!row) {
        absent.push(listing.from);
        continue;
      }

      const archetype = ARCHETYPES[listing.type];
      const variant =
        listing.v && listing.v > 0
          ? (archetype.variants?.[listing.v - 1] ?? archetype)
          : archetype;
      const previous = (row.descriptions ?? {}) as Record<string, unknown>;
      const oldName = row.name ?? '';

      // The old background carries a neighborhood and a founding year worth
      // keeping, so only the business name inside it is replaced.
      const oldBackground = String(previous.background ?? '');
      const background =
        oldName && oldBackground.includes(oldName)
          ? oldBackground.split(oldName).join(listing.name)
          : oldBackground;

      const photos = photosFor(archetype.theme, index);

      const isRename = listing.slug !== listing.from;
      // Count what this run actually changes, not what the listing table
      // describes — on a second run the rename has already landed.
      const renaming = row.screenname !== listing.slug;
      if (renaming) renamed += 1;

      // The seeded socials are derived from the old screenname, so a renamed
      // listing otherwise advertises the brand it used to be:
      // "Website: el-fogon-cafe.example.com" under the heading Ventanita Cafe.
      // Instagram and TikTok handles drop the hyphens, so both spellings go.
      const socials = { ...((row.socials ?? {}) as Record<string, unknown>) };
      if (isRename) {
        const fromFlat = listing.from.split('-').join('');
        const slugFlat = listing.slug.split('-').join('');
        for (const [key, value] of Object.entries(socials)) {
          if (typeof value !== 'string') continue;
          const next = value
            .split(listing.from)
            .join(listing.slug)
            .split(fromFlat)
            .join(slugFlat);
          if (next !== value) socialsFixed += 1;
          if (next.toLowerCase().includes(fromFlat)) {
            staleSocials.push(`${listing.name} ${key}: ${next}`);
          }
          socials[key] = next;
        }
      }

      console.log(
        `  ${(renaming ? `${oldName} -> ${listing.name}` : listing.name)
          .padEnd(46)
          .slice(0, 46)} ${archetype.category.padEnd(10)} ${listing.type}`
      );

      if (apply) {
        await db
          .update(profiles)
          .set({
            name: listing.name,
            screenname: listing.slug,
            categories: [archetype.category],
            descriptions: {
              ...previous,
              fiveWords: variant.fiveWords,
              details: variant.details,
              tags: archetype.tags,
              background,
            },
            galleryImages: {
              ...((row.galleryImages ?? {}) as Record<string, unknown>),
              gallery1CDN: photos[0],
              gallery2CDN: photos[1],
              gallery3CDN: photos[2],
            },
            primaryImageCdn: null,
            socials,
          })
          .where(eq(profiles.id, row.id));
      }
      updated += 1;
    }

    console.log('');
    for (const slug of absent) {
      console.warn(`  no profile found for "${slug}" — skipped`);
    }
    for (const [key, names] of shared) {
      console.warn(`  shared copy (${key}): ${names.join(', ')}`);
    }
    for (const stale of staleSocials) {
      console.warn(`  socials still mention the old name — ${stale}`);
    }

    if (apply) {
      console.log(
        `  updated ${updated} listings (${renamed} renamed, ${socialsFixed} social links rewritten)`
      );
    } else {
      console.log(
        `  dry run: ${updated} listings would change (${renamed} renamed, ${socialsFixed} social links rewritten)`
      );
      console.log('  re-run with --apply to write');
    }

    console.log('CONTENT:done');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
