import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Privacy Policy - PayParent',
  description: 'PayParent Privacy Policy: 100% private financial tracking for cooperative co-parents.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Logo />
          <Link href="/login">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to App
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold mb-3">
            <ShieldCheck className="h-3.5 w-3.5" /> Privacy-First Architecture
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: November 2026</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="rounded-xl border p-4 bg-card">
            <Lock className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-semibold text-sm">Zero Bank Connectivity</h3>
            <p className="text-xs text-muted-foreground mt-1">
              We never ask for, connect to, or store your bank logins, account numbers, or debit/credit card info.
            </p>
          </div>
          <div className="rounded-xl border p-4 bg-card">
            <EyeOff className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-semibold text-sm">No Advertising or Data Sale</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Your data is never sold to third-party data brokers, marketers, or advertisers. Period.
            </p>
          </div>
          <div className="rounded-xl border p-4 bg-card">
            <Trash2 className="h-5 w-5 text-primary mb-2" />
            <h3 className="font-semibold text-sm">Full Data Ownership</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Export your entire expense history to Excel anytime, or delete your account whenever you choose.
            </p>
          </div>
        </div>

        <section className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. What Information We Collect</h2>
            <p>
              PayParent is intentionally designed as a manual financial ledger. We only collect the minimal information necessary to deliver our service:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account Credentials:</strong> Your email address and an encrypted password hash to secure your login.</li>
              <li><strong>Co-Parent Linking Identifiers:</strong> A unique user code used solely to connect your account to your co-parent.</li>
              <li><strong>Expense Records:</strong> Date, description, amount, category, payer, settlement status, and any receipt photos you choose to attach.</li>
              <li><strong>Child Support & Custom Split Rules:</strong> Percentages and amounts you configure to calculate shared obligations.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. How Your Information Is Shared</h2>
            <p>
              Your expense entries and configurations are shared <strong>exclusively with your verified linked co-parent</strong>. 
              No other user, co-parenting party, or unauthorized third party can read your ledger.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Payment & Billing Information</h2>
            <p>
              Subscription payments are processed directly by <strong>Stripe</strong>. PayParent never sees, receives, or stores your credit card numbers or banking information. Stripe handles all billing securely in accordance with PCI-DSS Level 1 compliance.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Data Retention and Deletion</h2>
            <p>
              You retain full ownership of your data. You may unlink your co-parent or export your complete transaction history to Excel at any time through the in-app export tools. If you choose to delete your account, your user profile and stored data will be permanently removed.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Contact</h2>
            <p>
              If you have any questions regarding this Privacy Policy or your data, please contact our support team at <a href="mailto:support@payparent.app" className="text-primary hover:underline">support@payparent.app</a>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
