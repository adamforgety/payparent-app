'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle2, Sparkles, Loader2, ShieldCheck, HeartHandshake } from 'lucide-react';
import { useAppContext } from '@/context/app-context';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { STRIPE_PRICING } from '@/lib/stripe';

export function SubscriptionCard() {
  const { user } = useFirebase();
  const { subscriptionInfo, dataOwnerId, coParentData, currentUserDoc } = useAppContext();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState(false);

  const isDataOwner = !dataOwnerId || dataOwnerId === user?.uid;

  const handleCheckout = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          userId: user.uid,
          email: user.email,
          dataOwnerId: dataOwnerId || user.uid,
        }),
      });

      const data = await res.json();

      if (data.url) {
        if (data.simulated) {
          toast({
            title: 'Test Mode Simulated',
            description: data.message,
          });
        }
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to start checkout');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Checkout Error',
        description: err.message || 'Could not initiate checkout.',
      });
      setIsLoading(false);
    }
  };

  const handleManage = async () => {
    setIsLoading(true);

    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentUserDoc?.subscription?.stripeCustomerId,
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to open billing portal');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Billing Portal Error',
        description: err.message || 'Could not open billing portal.',
      });
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Household Plan</CardTitle>
              <CardDescription>
                One subscription covers both parents. The co-parent joins completely free.
              </CardDescription>
            </div>
          </div>
          <div>
            {subscriptionInfo.status === 'active' ? (
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Active Subscription
              </Badge>
            ) : subscriptionInfo.isTrial ? (
              <Badge variant="secondary" className="font-medium gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                {subscriptionInfo.daysRemaining} Days Free Trial Left
              </Badge>
            ) : (
              <Badge variant="destructive">Trial Ended</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!isDataOwner ? (
          <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
            <HeartHandshake className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Covered by Co-Parent</p>
              <p className="text-muted-foreground mt-0.5">
                Your account is currently shared with{' '}
                <span className="font-medium text-foreground">{coParentData?.email || 'your co-parent'}</span> under their
                household data plan. No separate payment is required from you.
              </p>
            </div>
          </div>
        ) : subscriptionInfo.status === 'active' ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {subscriptionInfo.plan === 'yearly' ? 'Annual Household Plan' : 'Monthly Household Plan'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Full shared ledger access, Excel reports, receipt logging, and live co-parent sync.
                </p>
              </div>
              <Button variant="outline" onClick={handleManage} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Manage Billing
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Annual Plan */}
              <div
                onClick={() => setSelectedPlan('yearly')}
                className={`cursor-pointer rounded-xl border p-4 transition-all relative ${
                  selectedPlan === 'yearly'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] font-bold">
                    SAVE 39%
                  </Badge>
                </div>
                <div className="font-semibold text-foreground">Annual Plan</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{STRIPE_PRICING.yearly.price}</span>
                  <span className="text-xs text-muted-foreground">billed once a year</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Best value for long-term co-parenting harmony.
                </p>
              </div>

              {/* Monthly Plan */}
              <div
                onClick={() => setSelectedPlan('monthly')}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedPlan === 'monthly'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="font-semibold text-foreground">Monthly Plan</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{STRIPE_PRICING.monthly.price}</span>
                  <span className="text-xs text-muted-foreground">month-to-month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Flexible billing. Cancel or pause anytime in 1 click.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Never connects to your bank. 100% private financial logging.</span>
              </div>
              <Button onClick={handleCheckout} disabled={isLoading} className="w-full sm:w-auto">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {subscriptionInfo.isTrial ? 'Upgrade Household Plan' : 'Subscribe to Continue'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
