import Stripe from 'stripe';
import type { UserDoc, SubscriptionStatus } from '@/lib/types';
import { differenceInDays, addDays, parseISO, isAfter } from 'date-fns';

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia' as any,
      appInfo: {
        name: 'PayParent',
        version: '1.0.0',
      },
    })
  : null;

export const STRIPE_PRICING = {
  monthly: {
    id: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_mock',
    name: 'Monthly Household Plan',
    price: '$3.99/mo',
    amount: 399,
  },
  yearly: {
    id: process.env.STRIPE_PRICE_YEARLY || 'price_yearly_mock',
    name: 'Annual Household Plan',
    price: '$29/yr',
    amount: 2900,
    savings: 'Save 39%',
  },
};

export interface HouseholdSubscriptionInfo {
  isActive: boolean;
  isTrial: boolean;
  status: SubscriptionStatus;
  plan?: 'monthly' | 'yearly';
  daysRemaining: number;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Computes household subscription state from the data owner's profile.
 * Every new user gets an automatic 14-day trial without entering a credit card.
 */
export function getHouseholdSubscriptionInfo(ownerDoc: UserDoc | null): HouseholdSubscriptionInfo {
  if (!ownerDoc) {
    return {
      isActive: true,
      isTrial: true,
      status: 'trialing',
      daysRemaining: 14,
    };
  }

  const sub = ownerDoc.subscription;

  // 1. If user has an active Stripe subscription
  if (sub?.status === 'active') {
    return {
      isActive: true,
      isTrial: false,
      status: 'active',
      plan: sub.plan || 'monthly',
      daysRemaining: 0,
      currentPeriodEnd: sub.currentPeriodEnd || undefined,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
    };
  }

  // 2. Determine trial expiration date (14 days after account creation or custom trialEndsAt)
  let trialEndDate: Date;
  if (sub?.trialEndsAt) {
    trialEndDate = parseISO(sub.trialEndsAt);
  } else if (ownerDoc.createdAt) {
    trialEndDate = addDays(parseISO(ownerDoc.createdAt), 14);
  } else {
    // Default fallback to 14 days from now if not explicitly set
    trialEndDate = addDays(new Date(), 14);
  }

  const now = new Date();
  const daysRemaining = Math.max(0, differenceInDays(trialEndDate, now));
  const isTrialActive = isAfter(trialEndDate, now);

  if (isTrialActive) {
    return {
      isActive: true,
      isTrial: true,
      status: 'trialing',
      daysRemaining,
      trialEndsAt: trialEndDate.toISOString(),
    };
  }

  // 3. Trial has expired and no active subscription
  return {
    isActive: false,
    isTrial: false,
    status: sub?.status === 'canceled' ? 'canceled' : 'past_due',
    daysRemaining: 0,
    trialEndsAt: trialEndDate.toISOString(),
  };
}
