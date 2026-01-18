/**
 * @deprecated OBSOLETE - Password-based registration replaced by Auth.js OAuth/magic link
 * See docs/DEPRECATED-ROUTES.md
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import users from '@/lib/model/users';
import bcrypt from 'bcrypt';

const validateEmail = (email: string): boolean => {
  const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return regEx.test(email);
};

const validateForm = async (
  username: string,
  email: string,
  password: string
) => {
  console.log(username, email, password);
  if (username.length < 3) {
    return { error: 'Username must have 3 or more characters' };
  }
  if (!validateEmail(email)) {
    return { error: 'Email is invalid' };
  }

  await dbConnect();
  const emailUser = await users.findOne({ email: email });

  if (emailUser) {
    return { error: 'Email already exists' };
  }

  if (password.length < 5) {
    return { error: 'Password must have 5 or more characters' };
  }

  return null;
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, email, password } = body;

  const errorMessage = await validateForm(username, email, password);
  if (errorMessage) {
    return NextResponse.json(errorMessage, { status: 400 });
  }

  // hash password
  const hashedPassword = await bcrypt.hash(password, 12);
  if (hashedPassword) {
    console.log(hashedPassword);

    // create new User on MongoDB
    const newUser = new users({
      username: username,
      email: email,
      hashedPassword: hashedPassword,
      dateJoined: new Date(),
      onboardingFormComplete: false,
      featured: false,
    });

    try {
      await newUser.save();
      return NextResponse.json({
        msg: 'Successfuly created new User: ' + newUser,
      });
    } catch (err) {
      return NextResponse.json(
        { error: "Error on '/api/register': " + err },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Failed to hash password' },
    { status: 500 }
  );
}
