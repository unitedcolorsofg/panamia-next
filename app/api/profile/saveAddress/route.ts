// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getActiveProfile } from '@/lib/server/active-profile';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: 'No user session available',
    });
  }

  const { primary_address, counties, online_only } = body;

  // The profile being acted as - their own, or a business listing they administer
  const existingProfile = await getActiveProfile(session.user.id);

  if (!existingProfile) {
    return NextResponse.json({
      success: false,
      error: 'Could not find profile',
    });
  }

  // Build update data
  const updateData: Partial<typeof profiles.$inferInsert> = {
    counties: counties || null,
  };

  // Guarded on the type rather than coerced, so a caller that omits the field
  // leaves it alone instead of silently switching the listing to physical.
  if (typeof online_only === 'boolean') {
    updateData.onlineOnly = online_only;
  }

  // Map primary_address to flattened address fields.
  //
  // Two shapes reach this endpoint: the address form posts street1/street2/
  // city/state/zipcode/hours, while other callers use line1/locality/region/
  // postalCode. Only street2 and city previously lined up, so saving the form
  // wrote NULL over street, state and zip every time.
  //
  // Columns are also written only when the payload actually carries them.
  // Assigning unconditionally nulled out every field the sender omitted —
  // addressName and addressCountry appear on no form at all, so any save
  // silently erased them.
  if (primary_address) {
    const field = (...keys: string[]): string | null | undefined => {
      for (const key of keys) {
        const value = primary_address[key];
        if (value !== undefined) {
          return typeof value === 'string' && value.trim() === ''
            ? null
            : value;
        }
      }
      return undefined;
    };

    const assign = (
      column: keyof typeof profiles.$inferInsert,
      value: string | null | undefined
    ) => {
      if (value !== undefined) {
        (updateData as Record<string, unknown>)[column] = value;
      }
    };

    assign('addressName', field('name'));
    assign('addressLine1', field('street1', 'line1'));
    assign('addressLine2', field('street2', 'line2'));
    assign('addressLocality', field('city', 'locality'));
    assign('addressRegion', field('state', 'region'));
    assign('addressPostalCode', field('zipcode', 'postalCode'));
    assign('addressCountry', field('country'));
    assign('addressHours', field('hours'));

    // Set geo coordinates if available
    if (primary_address.lat && primary_address.lng) {
      updateData.addressLat = String(parseFloat(primary_address.lat));
      updateData.addressLng = String(parseFloat(primary_address.lng));
    }
  }

  try {
    const [updatedProfile] = await db
      .update(profiles)
      .set(updateData)
      .where(eq(profiles.id, existingProfile.id))
      .returning();

    return NextResponse.json(
      { success: true, data: updatedProfile },
      { status: 200 }
    );
  } catch (e) {
    if (e instanceof Error) {
      console.log(e.message);
      return NextResponse.json(
        { success: false, error: e.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Unknown error' },
      { status: 500 }
    );
  }
}
