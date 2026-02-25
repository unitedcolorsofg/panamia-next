// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { profiles } from '@/lib/schema';
import { ProfileDescriptions } from '@/lib/interfaces';

interface ResponseData {
  error?: string;
  success?: boolean;
  msg?: string;
  data?: any[];
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const session = await auth();

  if (!session) {
    return NextResponse.json({
      success: false,
      error: 'No user session available',
    });
  }
  const eMail = session.user?.email;
  if (!eMail) {
    return NextResponse.json(
      { success: false, error: 'No valid email' },
      { status: 200 }
    );
  }

  const {
    email,
    name,
    slug,
    details,
    background,
    five_words,
    socials,
    phone_number,
    tags,
  } = body;
  console.log('phone_number', phone_number);

  try {
    // Build descriptions JSONB
    const descriptions: ProfileDescriptions = {
      details: details || null,
      background: background || null,
      fiveWords: five_words || null,
      tags: tags || null,
    };

    const [newProfile] = await db
      .insert(profiles)
      .values({
        name,
        email,
        active: true,
        descriptions: descriptions as any,
        socials: socials || null,
        phoneNumber: phone_number || null,
      })
      .returning();

    return NextResponse.json(
      { msg: 'Successfully created new Profile: ' + newProfile.id },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Error on '/api/importProfile': " + err.message },
      { status: 400 }
    );
  }
}
