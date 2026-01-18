/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: prisma.profile.update({ data: { featured } })
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import users from '@/lib/model/users';

interface ResponseData {
  error?: string;
  msg?: string;
}

const validateForm = async (email: string, featured: string) => {
  // if (!validateEmail(email)) {
  //   return { error: "Email is invalid" };
  // }
  if (featured) {
    console.log('featured' + featured);
  }
  //await dbConnect();
  //const emailUser = await users.findOne({ email: email });
  return null;
};
const validateBool = (featured: string) => {
  let featuredBool;
  if (featured == 'true') {
    featuredBool = true;
  } else {
    featuredBool = false;
  }

  return featuredBool;
};

export async function PUT(request: NextRequest) {
  const body = await request.json();
  console.log(body);
  // validate if it is a POST

  // get and validate body variables
  const { email, featured } = body;
  console.log(email);
  console.log(featured);
  let featuredBool = validateBool(featured);

  const errorMessage = await validateForm(email, featured);
  if (errorMessage) {
    return NextResponse.json(errorMessage as ResponseData, { status: 400 });
  }

  // create new User on MongoDB

  console.log(email);
  console.log(featured);
  await users
    .findOneAndUpdate({ email: email }, { $set: { featured: featuredBool } })
    .then(() => {
      console.log('success');
      return NextResponse.json(
        {
          msg:
            'Successfuly edited user ' +
            { email } +
            ' to featured: ' +
            featuredBool,
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
