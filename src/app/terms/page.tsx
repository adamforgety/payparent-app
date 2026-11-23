import Link from 'next/link';
import { Logo } from '@/components/logo';
import { ArrowLeft, FileText, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Terms of Service - PayParent',
  description: 'Terms of Service for PayParent co-parenting expense tracking.',
};

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            <FileText className="h-3.5 w-3.5" /> Terms of Service
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mt-2">Effective Date: November 2026</p>
        </div>

        <section className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Description of Service</h2>
            <p>
              PayParent is a software tool created to assist cooperative co-parents in logging shared child expenses, calculating child support obligations, and tracking settlements. PayParent is designed as an organized digital ledger to replace shared spreadsheets.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-amber-900 dark:text-amber-200">
            <h2 className="text-base font-semibold">2. Not Legal, Tax, or Financial Advice</h2>
            <p className="text-xs leading-relaxed mt-1">
              PayParent is not a law firm, accounting firm, or court mediator. Calculations, summaries, and AI-assisted insights provided within the application are strictly informational tools based on user-entered values. They do not constitute formal legal judgments, enforceable court orders, or certified financial advice.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Household Subscriptions & Billing</h2>
            <p>
              PayParent offers subscription plans on a monthly or annual basis:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Free Trial:</strong> New accounts receive a 14-day free trial without requiring credit card information.</li>
              <li><strong>Single Household Coverage:</strong> A single paid subscription covers the entire household. When an account links with a co-parent, the co-parent is not required to purchase a separate subscription.</li>
              <li><strong>Cancellation:</strong> You may cancel your subscription at any time with 1 click via the customer billing portal. Access continues through the end of your current billing period.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. User Responsibilities & Conduct</h2>
            <p>
              You agree to use PayParent in good faith for personal co-parenting record-keeping. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, PayParent shall not be liable for any indirect, incidental, or consequential damages resulting from errors in user-entered data, disputes between co-parenting parties, or temporary service interruptions.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Contact Us</h2>
            <p>
              For inquiries regarding these Terms, contact us at <a href="mailto:support@payparent.app" className="text-primary hover:underline">support@payparent.app</a>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
