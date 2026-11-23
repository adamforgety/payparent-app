import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId } = body;

    const host = req.headers.get('origin') || 'http://localhost:3000';
    const returnUrl = `${host}/`;

    if (!stripe) {
      return NextResponse.json({
        simulated: true,
        message: 'Stripe keys not configured. In live mode, this opens the Stripe Billing Portal.',
        url: returnUrl,
      });
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'No active Stripe customer ID found for this account.' },
        { status: 400 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('Stripe Portal Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
