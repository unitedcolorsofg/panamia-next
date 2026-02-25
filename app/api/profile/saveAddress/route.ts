// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: 'No user session available',
    });
  }

  const { primary_address, counties } = body;

  // Find user's profile
  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
  });

  if (!existingProfile) {
    return NextResponse.json({
      success: false,
      error: 'Could not find profile',
    });
  }

  // Build update data
  const updateData: any = {
    counties: counties || null,
  };

  // Map primary_address to flattened address fields
  if (primary_address) {
    updateData.addressName = primary_address.name || null;
    updateData.addressLine1 = primary_address.line1 || null;
    updateData.addressLine2 = primary_address.line2 || null;
    updateData.addressLocality =
      primary_address.city || primary_address.locality || null;
    updateData.addressRegion = primary_address.region || null;
    updateData.addressPostalCode = primary_address.postalCode || null;
    updateData.addressCountry = primary_address.country || null;

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
