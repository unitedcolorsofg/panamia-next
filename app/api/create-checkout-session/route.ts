import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: NextRequest) {
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

    const origin = request.headers.get('origin') || 'https://panamia.club';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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

    return NextResponse.json({ sessionId: session.id }, { status: 200 });
  } catch (err) {
    const error = err as any;
    return NextResponse.json(
      { message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
