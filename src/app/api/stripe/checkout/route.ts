import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICING } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan = 'monthly', userId, email, dataOwnerId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const host = req.headers.get('origin') || 'http://localhost:3000';
    const successUrl = `${host}/?session_id={CHECKOUT_SESSION_ID}&upgraded=true`;
    const cancelUrl = `${host}/`;

    // If Stripe keys are not yet provided in .env, return a simulated successful response
    if (!stripe) {
      return NextResponse.json({
        simulated: true,
        message: 'Stripe keys not configured in environment. In live mode, this redirects to Stripe Checkout.',
        url: `${host}/?upgraded=simulated`,
      });
    }

    const priceId = plan === 'yearly' ? STRIPE_PRICING.yearly.id : STRIPE_PRICING.monthly.id;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email || undefined,
      client_reference_id: userId,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          userId,
          dataOwnerId: dataOwnerId || userId,
          plan,
        },
      },
      metadata: {
        userId,
        dataOwnerId: dataOwnerId || userId,
        plan,
      },
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
