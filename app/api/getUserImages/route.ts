/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: Vercel Blobs for image storage + Profile model
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import image from '@/lib/model/images';

const getUserImages = async (id: string) => {
  await dbConnect();
  const Images = await image.find({ userId: id });
  return Images;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing userId query parameter' },
      { status: 400 }
    );
  }

  try {
    const images = await getUserImages(userId);
    return NextResponse.json(images, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=180000',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Error on '/api/getUserImages': " + err },
      { status: 400 }
    );
  }
}
