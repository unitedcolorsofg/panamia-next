/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: Add onboardingComplete field to Profile model
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import users from '@/lib/model/users';

interface ResponseData {
  error?: string;
  msg?: string;
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  console.log(body);
  // validate if it is a POST

  // get and validate body variables
  const { email } = body;

  // create new User on MongoDB

  console.log(email);

  await users
    .findOneAndUpdate(
      { email: email },
      { $set: { onboardingFormComplete: true } },
      { returnNewDocument: true }
    )
    .then(() => {
      console.log('success');
      return NextResponse.json(
        {
          msg:
            'Successfuly edited user ' +
            { email } +
            ' to onboardingformcomplete: ' +
            true,
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
