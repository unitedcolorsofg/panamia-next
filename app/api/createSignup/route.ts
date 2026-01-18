// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';

import { getPrisma } from '@/lib/prisma';
import BrevoApi from '@/lib/brevo_api';
import { splitName } from '@/lib/standardized';

interface ResponseData {
  error?: string;
  msg?: string;
}

const validateEmail = (email: string): boolean => {
  const regEx = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  return regEx.test(email);
};

const callBrevo_createContact = async (email: string, name: string) => {
  const prisma = await getPrisma();
  const existingContact = await prisma.brevoContact.findUnique({
    where: { email },
  });
  if (existingContact) {
    return false; // skip since already created/updated in Brevo
  }

  const brevo = new BrevoApi();
  if (brevo.ready) {
    const [firstName, lastName] = splitName(name);
    const attributes = {
      FIRSTNAME: firstName,
      LASTNAME: lastName,
    };
    const list_ids: number[] = [];
    if (brevo.config.lists.addedByWebsite) {
      list_ids.push(parseInt(brevo.config.lists.addedByWebsite));
    }
    if (brevo.config.lists.webformNewsletter) {
      list_ids.push(parseInt(brevo.config.lists.webformNewsletter));
    }
    const brevoResponse = await brevo.createOrUpdateContact(
      email,
      attributes,
      list_ids
    );
    await prisma.brevoContact.create({
      data: {
        email,
        brevoId: brevoResponse.id,
        listIds: list_ids,
      },
    });
  }
};

const callBrevo_sendAdminNoticeEmail = async (
  name: string,
  email: string,
  signup_type: string
) => {
  const brevo = new BrevoApi();
  const template_id = brevo.config.templates.adminSignupConfirmation;
  if (template_id) {
    const params = {
      name: name,
      email: email,
      signup_type: signup_type,
    };
    const response = await brevo.sendTemplateEmail(
      parseInt(template_id),
      params
    );
    // TODO: Confirm 201 response from Brevo
  }
};

export async function POST(request: NextRequest) {
  const body = await request.json();

  // get and validate body variables
  const { name, email, signup_type } = body;

  if (!validateEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' });
  }

  const prisma = await getPrisma();
  const existingSignup = await prisma.newsletterSignup.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existingSignup) {
    return NextResponse.json(
      { error: 'You are already registered.' },
      { status: 200 }
    );
  }

  try {
    const newSignup = await prisma.newsletterSignup.create({
      data: {
        name: name,
        email: email.toLowerCase(),
        signupType: signup_type,
      },
    });

    await Promise.allSettled([
      callBrevo_createContact(email, name),
      callBrevo_sendAdminNoticeEmail(name, email, signup_type),
    ]);

    return NextResponse.json({
      msg: 'Successfully created new Signup',
      success: true,
    });
  } catch (error) {
    return NextResponse.json({
      error: "Error on '/api/createSignup': " + error,
    });
  }
}
