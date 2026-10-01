import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe lazily to avoid build-time env issues
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  try {
    const body = await request.json();
    const {
      amount,
      isRecurring,
      customerEmail,
      comment,
      dedicate,
      monthlyTier,
    } = body;
    const tier = monthlyTier ? monthlyTier : 0;
    const dedicated_to = dedicate ? dedicate : '';

    const origin = request.headers.get('origin') || 'https://pana.social';

    const session = await stripe.checkout.sessions.create({
      // Apple Pay and Google Pay ride along with `card`. Stripe models them as
      // card wallets rather than separate payment method types -- an Apple Pay
      // charge comes back as a `card` PaymentMethod with `card.wallet.type` set
      // -- so there is no `apple_pay` value to add here. Hosted Checkout offers
      // the wallet on its own whenever the device supports it, which is what
      // satisfies the "offer Apple Pay support" half of guideline 3.2.1(vi).
      payment_method_types: ['card'],
      // Labels the Checkout button "Donate" instead of "Pay". Not cosmetic:
      // guideline 3.2.1(vi) only lets *approved* nonprofits raise money inside
      // an app, so the flow has to read as a donation rather than a purchase.
      // Valid in `payment` and `subscription` mode, the only two this route
      // creates. See the nonprofit section of docs/MOBILE-ROADMAP.md.
      submit_type: 'donate',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Donation',
            },
            unit_amount: amount,
            recurring: isRecurring ? { interval: 'month' } : undefined,
          },
          quantity: 1,
        },
      ],
      mode: isRecurring ? 'subscription' : 'payment',
      success_url: `${origin}/donation/confirmation?tier=${tier}&amt=${amount}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/donate`,
      customer_email: customerEmail,
      metadata: {
        comment: comment,
        dedicated_to: dedicated_to,
        membership: tier,
      },
    });

    return NextResponse.json(
      { url: session.url, sessionId: session.id },
      { status: 200 }
    );
  } catch (err) {
    const error = err as { message?: string; statusCode?: number };
    return NextResponse.json(
      { message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
