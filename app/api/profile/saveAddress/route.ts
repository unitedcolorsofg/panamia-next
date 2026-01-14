// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureProfile } from '@/lib/server/profile';

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

  // Use userId for profile lookup, with email fallback for unclaimed profiles
  const existingProfile = await ensureProfile(
    session.user.id,
    session.user.email
  );
  if (existingProfile) {
    if (primary_address.lat && primary_address.lng) {
      // https://www.mongodb.com/docs/manual/geospatial-queries/#std-label-geospatial-geojson
      // MongoDB requires Longitude then Latitude in float
      existingProfile.set(
        'geo',
        {
          type: 'Point',
          coordinates: [
            parseFloat(primary_address.lng),
            parseFloat(primary_address.lat),
          ],
        },
        { strict: false }
      );
    }
    existingProfile.primary_address = primary_address;
    existingProfile.counties = counties;
    try {
      existingProfile.save();
    } catch (e) {
      if (e instanceof Error) {
        console.log(e.message);
        return NextResponse.json(
          { success: false, error: e.message },
          { status: 500 }
        );
      }
    }
    return NextResponse.json(
      { success: true, data: existingProfile },
      { status: 200 }
    );
  }
  return NextResponse.json({ success: false, error: 'Could not find pofile' });
}
