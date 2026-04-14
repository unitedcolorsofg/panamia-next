import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { venues, profiles } from '@/lib/schema';
import type {
  VenueType,
  VenueEnvironment,
  VenueUsage,
  VenueOwnership,
  AdaAccessibility,
  ParkingOptions,
  RentalModel,
} from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateSlug } from '@/lib/events/slug';
import { createId } from '@paralleldrive/cuid2';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VENUE_TYPES: VenueType[] = [
  'bar_restaurant',
  'library_civic',
  'park_outdoor_public',
  'private_residence',
  'religious_community_hall',
  'coworking_office',
  'gallery_museum',
  'theater_performance',
  'studio_practice',
  'classroom_school',
  'beach_waterfront',
  'hotel_ballroom',
  'warehouse_industrial',
  'rooftop',
  'other',
];
const VENUE_ENVIRONMENTS: VenueEnvironment[] = ['indoor', 'outdoor', 'mixed'];
const VENUE_USAGES: VenueUsage[] = ['single_purpose', 'mixed_use'];
const VENUE_OWNERSHIPS: VenueOwnership[] = [
  'private',
  'public',
  'nonprofit',
  'unknown',
];
const ADA_VALUES: AdaAccessibility[] = ['yes', 'partial', 'none', 'unknown'];
const PARKING_VALUES: ParkingOptions[] = [
  'none',
  'street',
  'lot',
  'garage',
  'valet',
  'limited_garage',
  'good_luck',
];
const RENTAL_MODELS: RentalModel[] = [
  'free',
  'hourly',
  'flat',
  'tickets',
  'request_quote',
  'revenue_share',
  'other',
];
const AV_TAGS = new Set([
  'wifi',
  'power_outlets',
  'projector',
  'screen',
  'microphones',
  'pa_system',
  'stage_lighting',
  'livestream_cam',
  'hdmi_input',
  'usb_c_input',
  'chairs_provided',
  'tables_provided',
  'stage_area',
  'none_byod',
]);

function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return null;
  return v;
}

function sanitizeStringList(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => sanitizeUrl(v))
    .filter((v): v is string => v !== null)
    .slice(0, max);
}

function sanitizeAvTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v === 'string' && AV_TAGS.has(v)) seen.add(v);
  }
  return Array.from(seen);
}

interface ContactShape {
  name?: string;
  phone?: string;
  email?: string;
  role?: string;
}
function sanitizeContact(value: unknown): ContactShape | null {
  if (!value || typeof value !== 'object') return null;
  const src = value as Record<string, unknown>;
  const out: ContactShape = {};
  for (const key of ['name', 'phone', 'email', 'role'] as const) {
    const v = src[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, 200);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizeSafety(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof src.exitCount === 'number' && src.exitCount >= 0) {
    out.exitCount = Math.floor(src.exitCount);
  }
  for (const key of [
    'aedOnSite',
    'firstAidKit',
    'fireExtinguishersAccessible',
    'severeWeatherShelter',
    'securityStaffed',
  ]) {
    if (typeof src[key] === 'boolean') out[key] = src[key];
  }
  for (const key of ['evacuationPlanUrl', 'safetyPlanUrl']) {
    const u = sanitizeUrl(src[key]);
    if (u) out[key] = u;
  }
  if (typeof src.notes === 'string' && src.notes.trim()) {
    out.notes = src.notes.trim().slice(0, 2000);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizeRentalPricing(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = { currency: 'USD' };
  for (const key of ['hourlyRate', 'flatRate', 'minimumHours']) {
    const v = src[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = v;
  }
  if (typeof src.currency === 'string' && /^[A-Z]{3}$/.test(src.currency)) {
    out.currency = src.currency;
  }
  if (typeof src.notes === 'string' && src.notes.trim()) {
    out.notes = src.notes.trim().slice(0, 1000);
  }
  return Object.keys(out).length > 1 || out.notes ? out : null;
}

// ---------------------------------------------------------------------------
// GET /api/venues
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const searchParams = (request.nextUrl ?? new URL(request.url)).searchParams;
    const city = searchParams.get('city');
    const status = searchParams.get('status') || 'active';
    const venueTypeFilter = searchParams.get('venue_type');
    const envFilter = searchParams.get('environment');
    const usageFilter = searchParams.get('usage');
    const isFreeFilter = searchParams.get('is_free');
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const session = await auth();
    const isAdmin = session?.user?.isAdmin || false;

    // Non-admins can only see active venues
    const effectiveStatus = isAdmin ? status : 'active';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [eq(venues.status, effectiveStatus as any)];
    if (city) conditions.push(eq(venues.city, city));
    if (venueTypeFilter && VENUE_TYPES.includes(venueTypeFilter as VenueType)) {
      conditions.push(eq(venues.venueType, venueTypeFilter as VenueType));
    }
    if (
      envFilter &&
      VENUE_ENVIRONMENTS.includes(envFilter as VenueEnvironment)
    ) {
      conditions.push(
        eq(venues.venueEnvironment, envFilter as VenueEnvironment)
      );
    }
    if (usageFilter && VENUE_USAGES.includes(usageFilter as VenueUsage)) {
      conditions.push(eq(venues.venueUsage, usageFilter as VenueUsage));
    }
    if (isFreeFilter === 'true' || isFreeFilter === 'false') {
      conditions.push(eq(venues.isFree, isFreeFilter === 'true'));
    }

    const whereClause =
      conditions.length > 1 ? and(...conditions) : conditions[0];

    const [venueRows, countResult] = await Promise.all([
      db.query.venues.findMany({
        where: () => whereClause,
        orderBy: (t, { asc }) => [asc(t.city), asc(t.name)],
        offset,
        limit,
        columns: {
          id: true,
          slug: true,
          name: true,
          address: true,
          city: true,
          state: true,
          country: true,
          capacity: true,
          fireCapacity: true,
          venueType: true,
          venueEnvironment: true,
          venueUsage: true,
          isFree: true,
          rentalModel: true,
          status: true,
          website: true,
        },
      }),
      db
        .select({ count: sql<string>`count(*)` })
        .from(venues)
        .where(whereClause),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        venues: venueRows,
        total: Number(countResult[0].count),
        hasMore: offset + venueRows.length < Number(countResult[0].count),
      },
    });
  } catch (error) {
    console.error('Error listing venues:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list venues' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/venues
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!session.user.panaVerified) {
      return NextResponse.json(
        { success: false, error: 'panaVerified required' },
        { status: 403 }
      );
    }

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Required
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    const state = typeof body.state === 'string' ? body.state.trim() : '';
    const fireCapRaw = body.fireCapacity;
    const fireCapacity =
      typeof fireCapRaw === 'number'
        ? Math.floor(fireCapRaw)
        : typeof fireCapRaw === 'string' && fireCapRaw.trim()
          ? parseInt(fireCapRaw, 10)
          : NaN;

    if (!name || !address || !city || !state) {
      return NextResponse.json(
        {
          success: false,
          error: 'name, address, city, and state are required',
        },
        { status: 400 }
      );
    }
    if (!Number.isFinite(fireCapacity) || fireCapacity <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'fireCapacity is required and must be a positive integer',
        },
        { status: 400 }
      );
    }

    // Optional enums
    const venueTypeVal = VENUE_TYPES.includes(body.venueType)
      ? (body.venueType as VenueType)
      : null;
    const environmentVal = VENUE_ENVIRONMENTS.includes(body.venueEnvironment)
      ? (body.venueEnvironment as VenueEnvironment)
      : null;
    const usageVal = VENUE_USAGES.includes(body.venueUsage)
      ? (body.venueUsage as VenueUsage)
      : null;
    const ownershipVal = VENUE_OWNERSHIPS.includes(body.venueOwnership)
      ? (body.venueOwnership as VenueOwnership)
      : 'unknown';
    const adaVal = ADA_VALUES.includes(body.adaAccessibility)
      ? (body.adaAccessibility as AdaAccessibility)
      : 'unknown';
    const parkingVal = PARKING_VALUES.includes(body.parkingOptions)
      ? (body.parkingOptions as ParkingOptions)
      : 'none';
    const rentalModelVal = RENTAL_MODELS.includes(body.rentalModel)
      ? (body.rentalModel as RentalModel)
      : null;

    const country =
      typeof body.country === 'string' && body.country.trim()
        ? body.country.trim().toUpperCase().slice(0, 2)
        : 'US';
    const postalCode =
      typeof body.postalCode === 'string' && body.postalCode.trim()
        ? body.postalCode.trim().slice(0, 20)
        : null;
    const capacity =
      typeof body.capacity === 'number' && body.capacity > 0
        ? Math.floor(body.capacity)
        : typeof body.capacity === 'string' && body.capacity.trim()
          ? parseInt(body.capacity, 10) || null
          : null;

    const parcelControlNumber =
      typeof body.parcelControlNumber === 'string' &&
      body.parcelControlNumber.trim()
        ? body.parcelControlNumber.trim().slice(0, 50)
        : null;
    const parcelUnit =
      typeof body.parcelUnit === 'string' && body.parcelUnit.trim()
        ? body.parcelUnit.trim().slice(0, 50)
        : null;

    // PCN dedup check
    if (parcelControlNumber) {
      const conflict = await db.query.venues.findFirst({
        where: and(
          eq(venues.parcelControlNumber, parcelControlNumber),
          parcelUnit
            ? eq(venues.parcelUnit, parcelUnit)
            : sql`${venues.parcelUnit} IS NULL`
        ),
        columns: { id: true, slug: true, name: true, status: true },
      });
      if (conflict) {
        return NextResponse.json(
          {
            success: false,
            error: 'A venue with this parcel control number already exists',
            code: 'PARCEL_DUPLICATE',
            existing: conflict,
          },
          { status: 409 }
        );
      }
    }

    const isFree = body.isFree === true || rentalModelVal === 'free';
    const hasLiquorLicense = body.hasLiquorLicense === true;
    const houseRules =
      typeof body.houseRules === 'string' && body.houseRules.trim()
        ? body.houseRules.trim().slice(0, 4000)
        : null;
    const parkingInstructions =
      typeof body.parkingInstructions === 'string' &&
      body.parkingInstructions.trim()
        ? body.parkingInstructions.trim().slice(0, 1000)
        : null;
    const accessibilityNotes =
      typeof body.accessibilityNotes === 'string' &&
      body.accessibilityNotes.trim()
        ? body.accessibilityNotes.trim().slice(0, 2000)
        : null;
    const website = sanitizeUrl(body.website);
    const buildingPlansUrl = sanitizeUrl(body.buildingPlansUrl);
    const supportingDocsUrls = sanitizeStringList(body.supportingDocsUrls);
    const avInfrastructure = sanitizeAvTags(body.avInfrastructure);
    const bookingInstructions =
      typeof body.bookingInstructions === 'string' &&
      body.bookingInstructions.trim()
        ? body.bookingInstructions.trim().slice(0, 2000)
        : null;
    const insuranceCoiUrl = sanitizeUrl(body.insuranceCoiUrl);
    const insuranceCoiExpiresAt =
      typeof body.insuranceCoiExpiresAt === 'string' &&
      body.insuranceCoiExpiresAt
        ? new Date(body.insuranceCoiExpiresAt)
        : null;
    const insuranceNotes =
      typeof body.insuranceNotes === 'string' && body.insuranceNotes.trim()
        ? body.insuranceNotes.trim().slice(0, 1000)
        : null;

    const ownerContact = sanitizeContact(body.ownerContact);
    const safetyContact = sanitizeContact(body.safetyContact);
    const safety = sanitizeSafety(body.safety);
    const rentalPricing = sanitizeRentalPricing(body.rentalPricing);

    const slug = generateSlug(name);
    const now = new Date();

    const [newVenue] = await db
      .insert(venues)
      .values({
        id: createId(),
        createdAt: now,
        updatedAt: now,
        slug,
        name,
        address,
        city,
        state: state.toUpperCase().slice(0, 2),
        country,
        postalCode,
        capacity,
        fireCapacity,
        parcelControlNumber,
        parcelUnit,
        venueType: venueTypeVal,
        venueEnvironment: environmentVal,
        venueUsage: usageVal,
        venueOwnership: ownershipVal,
        adaAccessibility: adaVal,
        parkingOptions: parkingVal,
        parkingInstructions,
        hasLiquorLicense,
        houseRules,
        ownerContact,
        avInfrastructure,
        safety,
        buildingPlansUrl,
        supportingDocsUrls,
        isFree,
        rentalModel: rentalModelVal,
        rentalPricing,
        bookingInstructions,
        insuranceCoiUrl,
        insuranceCoiExpiresAt:
          insuranceCoiExpiresAt && !isNaN(insuranceCoiExpiresAt.valueOf())
            ? insuranceCoiExpiresAt
            : null,
        insuranceNotes,
        operatorProfileId: profile.id,
        status: 'pending_review',
        safetyContact,
        accessibilityNotes,
        photos: [],
        website,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: { id: newVenue.id, slug: newVenue.slug, status: newVenue.status },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating venue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create venue' },
      { status: 500 }
    );
  }
}
