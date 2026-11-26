'use client';

import { useState } from 'react';
import { Sheet, RefreshCw, Check, Copy, ExternalLink, HelpCircle, AlertCircle, ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useAppContext } from '@/context/app-context';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { extractSpreadsheetId } from '@/lib/sheet-utils';
import { formatDistanceToNow, parseISO } from 'date-fns';

export function GoogleSheetSyncCard() {
  const { toast } = useToast();
  const { user } = useFirebase();
  const { currentUserDoc, dataOwnerId } = useAppContext();

  const savedSheetId = currentUserDoc?.googleSheetConfig?.sheetId || '';
  const lastSynced = currentUserDoc?.googleSheetConfig?.lastSyncedAt;
  const syncStatus = currentUserDoc?.googleSheetConfig?.syncStatus || 'not_configured';

  const [sheetInput, setSheetInput] = useState(savedSheetId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);

  // Recommended service account email placeholder (or environment variable if exposed)
  const serviceAccountEmail =
    process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    'payparent-sync@studio-4986545832-761cd.iam.gserviceaccount.com';

  const cleanSheetId = extractSpreadsheetId(sheetInput);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(serviceAccountEmail);
    setIsCopied(true);
    toast({
      title: 'Email Copied',
      description: 'Service account email copied to clipboard.',
    });
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleCopyCode = () => {
    const webhookUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/api/sheets/webhook`
      : 'https://studio-4986545832-761cd.web.app/api/sheets/webhook';

    const scriptCode = `/**
 * Automatically notifies PayParent whenever this sheet is edited.
 * Paste this in Extensions > Apps Script and save!
 */
function onEdit(e) {
  var sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var url = "${webhookUrl}";
  
  try {
    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ sheetId: sheetId }),
      muteHttpExceptions: true
    });
  } catch(err) {
    Logger.log("PayParent sync error: " + err);
  }
}`;

    navigator.clipboard.writeText(scriptCode);
    setIsCodeCopied(true);
    toast({
      title: 'Apps Script Code Copied',
      description: 'Paste this into Extensions > Apps Script in your Google Sheet.',
    });
    setTimeout(() => setIsCodeCopied(false), 2500);
  };

  const handleSyncNow = async () => {
    const effectiveSheetId = cleanSheetId || savedSheetId;
    if (!effectiveSheetId) {
      toast({
        title: 'Sheet ID Required',
        description: 'Please paste your Google Sheet ID or URL first.',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.uid) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to sync.',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);

    try {
      const response = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          sheetId: effectiveSheetId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync with Google Sheet');
      }

      toast({
        title: 'Google Sheet Synced!',
        description: `Imported ${data.importedToApp} new, exported ${data.exportedToSheet} to Sheet, reconciled ${data.statusUpdated} statuses.`,
      });
    } catch (err: any) {
      console.error('Sync failed:', err);
      toast({
        title: 'Sync Failed',
        description: err.message || 'Make sure your Sheet is shared with the service account as Editor.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sheet className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>Google Sheet Sync</CardTitle>
                {syncStatus === 'connected' ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    Not Connected
                  </Badge>
                )}
              </div>
              <CardDescription>
                Synchronize your live expenses two-way with your Google Sheet so you and your co-parent stay aligned.
              </CardDescription>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="gap-2 font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Step 1: Sheet URL/ID Input */}
        <div className="space-y-2">
          <Label htmlFor="googleSheetUrl" className="text-xs font-semibold text-muted-foreground uppercase">
            Google Sheet URL or ID
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="googleSheetUrl"
              placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
              className="font-medium text-sm"
            />
            {cleanSheetId && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="shrink-0 gap-1.5"
              >
                <a
                  href={`https://docs.google.com/spreadsheets/d/${cleanSheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Sheet
                </a>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            You can paste the entire address bar URL from your browser or just the sheet ID.
          </p>
        </div>

        {/* Step 2: Share Sheet Instructions */}
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
              1
            </span>
            <span>Share your Google Sheet with this Service Account:</span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg border border-border bg-background p-2.5">
            <code className="text-xs font-mono text-foreground break-all">
              {serviceAccountEmail}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyEmail}
              className="gap-1.5 shrink-0 text-xs h-8"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {isCopied ? 'Copied' : 'Copy Email'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            In your Google Sheet, click the green <strong>Share</strong> button (top right), paste the email above, and grant it <strong>Editor</strong> access so PayParent can read and record expenses.
          </p>
        </div>

        {/* Step 3: Real-Time Auto Sync Guide (Apps Script) */}
        <Accordion type="single" collapsible className="w-full border rounded-xl px-4 py-1">
          <AccordionItem value="realtime-sync" className="border-none">
            <AccordionTrigger className="text-xs font-semibold py-2 hover:no-underline">
              <span className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                Want Instant Real-Time Sync when your ex edits the Google Sheet?
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 text-xs text-muted-foreground">
              <p>
                By default, you can click <strong>&quot;Sync Now&quot;</strong> anytime to sync both directions. If you want the app to update automatically within seconds whenever your ex adds or edits a row in Google Sheets, add this tiny script:
              </p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>In your Google Sheet, click <strong>Extensions</strong> ➔ <strong>Apps Script</strong>.</li>
                <li>Delete any placeholder code and paste the script below:</li>
              </ol>
              <div className="relative rounded-lg bg-muted p-3 font-mono text-[11px] overflow-x-auto">
                <pre>{`function onEdit(e) {
  var sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  UrlFetchApp.fetch("${typeof window !== 'undefined' ? window.location.origin : 'https://studio-4986545832-761cd.web.app'}/api/sheets/webhook", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ sheetId: sheetId }),
    muteHttpExceptions: true
  });
}`}</pre>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCode}
                  className="absolute top-2 right-2 h-7 text-xs gap-1"
                >
                  {isCodeCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {isCodeCopied ? 'Copied' : 'Copy Script'}
                </Button>
              </div>
              <p>
                Click <strong>Save</strong> (disk icon). That&apos;s it! Every edit in the sheet will automatically trigger a sync.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>

      <CardFooter className="bg-muted/20 border-t border-border/60 py-3 text-xs text-muted-foreground flex items-center justify-between">
        <div>
          {lastSynced ? (
            <span>
              Last synced: <strong>{formatDistanceToNow(parseISO(lastSynced), { addSuffix: true })}</strong>
            </span>
          ) : (
            <span>Not synced yet. Click &quot;Sync Now&quot; to begin.</span>
          )}
        </div>
        <span className="text-[11px]">Two-way reconciliation</span>
      </CardFooter>
    </Card>
  );
}
