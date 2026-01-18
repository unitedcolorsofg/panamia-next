/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: Vercel Blobs for storage + prisma.profile.update()
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import users from '@/lib/model/users';

interface ResponseData {
  error?: string;
  msg?: string;
}

const validateEmail = (email: string): boolean => {
  const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return regEx.test(email);
};

const validateForm = async (email: string, featured: string) => {
  if (!validateEmail(email)) {
    return { error: 'Email is invalid' };
  }
  if (featured) {
    console.log('featured' + featured);
  }
  const emailUser = await users.findOne({ email: email });

  await dbConnect();

  return null;
};

export async function PUT(request: NextRequest) {
  const body = await request.json();
  console.log(body);
  // validate if it is a POST

  // get and validate body variables
  const { email, bannerImage } = body;

  const errorMessage = await validateForm(email, bannerImage);
  if (errorMessage) {
    return NextResponse.json(errorMessage as ResponseData, { status: 400 });
  }

  console.log(email);
  console.log(bannerImage);
  await users
    .findOneAndUpdate(
      { email: email },
      { $set: { bannerImage: bannerImage } },
      { returnNewDocument: true }
    )
    .then(() => {
      console.log('success');
      NextResponse.json(
        {
          msg:
            'Successfuly edited user ' +
            { email } +
            ' to bannerImage: ' +
            bannerImage,
        },
        { status: 200 }
      );
    })
    .catch((err: string) =>
      NextResponse.json(
        { error: "Error on '/api/editFeature': " + err },
        { status: 400 }
      )
    );
}
