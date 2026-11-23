import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { initializeFirebase } from '@/firebase/server';

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ received: true, note: 'Stripe not configured' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing webhook signature or secret' }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: any;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  const { firestore } = initializeFirebase();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const dataOwnerId = session.metadata?.dataOwnerId || session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const plan = session.metadata?.plan || 'monthly';

        if (dataOwnerId && firestore) {
          await firestore.collection('users').doc(dataOwnerId).set(
            {
              subscription: {
                status: 'active',
                plan,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
              },
            },
            { merge: true }
          );
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const status = subscription.status === 'active' ? 'active' : 'canceled';
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;

        if (firestore) {
          const snapshot = await firestore
            .collection('users')
            .where('subscription.stripeCustomerId', '==', customerId)
            .limit(1)
            .get();

          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            await userDoc.ref.set(
              {
                subscription: {
                  status,
                  currentPeriodEnd,
                  cancelAtPeriodEnd,
                },
              },
              { merge: true }
            );
          }
        }
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error handling Stripe webhook event:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
