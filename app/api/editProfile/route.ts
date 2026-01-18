/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: prisma.profile.update()
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import users from '@/lib/model/users';

const validateEmail = (email: string): boolean => {
  const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return regEx.test(email);
};

const validateForm = async (username: string, email: string, bio: string) => {
  if (username.length < 3) {
    return { error: 'Username must have 3 or more characters' };
  }
  if (!validateEmail(email)) {
    return { error: 'Email is invalid' };
  }
  if (bio) {
    //console.log(bio);
  }

  const emailUser = await users.findOne({ email: email });

  await dbConnect();

  return null;
};

export async function PUT(request: NextRequest) {
  const body = await request.json();
  console.log(body);

  const {
    username,
    name,
    email,
    pronouns,
    bio,
    instagram,
    twitter,
    link1,
    link2,
    category,
    featured,
    location,
    avatar,
    bannerImage,
  } = body;

  const errorMessage = await validateForm(username, email, bio);

  if (errorMessage) {
    return NextResponse.json(errorMessage, { status: 400 });
  }

  // create new User on MongoDB
  const newUser = {
    username: username,
    name: name,
    email: email,
    pronouns: pronouns,
    bio: bio,
    instagramHandle: instagram,
    twitterHandle: twitter,
    link1: link1,
    link2: link2,
    category: category,
    featured: featured,
    location: location,
    avatar: avatar,
    bannerImage: bannerImage,
  };
  console.log(newUser);

  try {
    await users.findOneAndUpdate(
      { email: email },
      { $set: newUser },
      { returnNewDocument: true }
    );
    console.log('success');
    return NextResponse.json({
      msg: 'Successfuly edited profile ' + newUser,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error on '/api/editProfile': " + err },
      { status: 400 }
    );
  }
}
