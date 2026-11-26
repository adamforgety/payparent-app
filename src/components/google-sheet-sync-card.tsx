'use client';

import { useState } from 'react';
import { Sheet, RefreshCw, Check, Copy, ExternalLink, HelpCircle, Sparkles, ShieldCheck, Zap } from 'lucide-react';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useAppContext } from '@/context/app-context';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { extractSpreadsheetId, isAppsScriptUrl } from '@/lib/sheet-utils';
import { saveUserData } from '@/lib/data-service';
import { doc, setDoc } from 'firebase/firestore';
import { formatDistanceToNow, parseISO } from 'date-fns';

export function GoogleSheetSyncCard() {
  const { toast } = useToast();
  const { user, firestore } = useFirebase();
  const { currentUserDoc, dataOwnerId, appData } = useAppContext();

  const savedSheetId = currentUserDoc?.googleSheetConfig?.sheetId || '';
  const lastSynced = currentUserDoc?.googleSheetConfig?.lastSyncedAt;
  const syncStatus = currentUserDoc?.googleSheetConfig?.syncStatus || 'not_configured';

  const [sheetInput, setSheetInput] = useState(savedSheetId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);

  const serviceAccountEmail =
    process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    'payparent-sync@studio-4986545832-761cd.iam.gserviceaccount.com';

  const isScript = isAppsScriptUrl(sheetInput);
  const cleanSheetId = isScript ? '' : extractSpreadsheetId(sheetInput);

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
    const webhookUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/sheets/webhook`
        : 'https://studio-4986545832-761cd.web.app/api/sheets/webhook';

    const scriptCode = `/**
 * PayParent 2-Way Live Sync
 * 
 * Instructions:
 * 1. In your Google Sheet, open Extensions > Apps Script
 * 2. Delete existing code in Code.gs and paste this script
 * 3. Click "Deploy" > "New deployment"
 * 4. Select type: "Web app"
 * 5. Description: "PayParent Sync"
 * 6. Execute as: "Me"
 * 7. Who has access: "Anyone"
 * 8. Click "Deploy", copy the Web App URL, and paste it into PayParent!
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Expenses") || ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    sheetName: sheet.getName(),
    rows: data
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Expenses") || ss.getSheets()[0];
    
    // Action: Append rows
    if (payload.action === "append" && Array.isArray(payload.rows)) {
      payload.rows.forEach(function(row) {
        sheet.appendRow(row);
      });
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        appendedCount: payload.rows.length
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Action: Update status
    if (payload.action === "updateStatus" && Array.isArray(payload.updates)) {
      payload.updates.forEach(function(u) {
        if (u.rowIndex && u.status) {
          sheet.getRange(u.rowIndex, 5).setValue(u.status);
        }
      });
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        updatedCount: payload.updates.length
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      error: "Unknown action"
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Optional: Instant realtime webhook trigger when anyone edits the sheet
 */
function onEdit(e) {
  var webhookUrl = "${webhookUrl}";
  var sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ sheetId: sheetId }),
      muteHttpExceptions: true
    });
  } catch(err) {}
}`;

    navigator.clipboard.writeText(scriptCode);
    setIsCodeCopied(true);
    toast({
      title: 'Apps Script Code Copied!',
      description: 'Paste into Extensions > Apps Script and deploy as Web App.',
    });
    setTimeout(() => setIsCodeCopied(false), 2500);
  };

  const handleSyncNow = async () => {
    const effectiveSheetTarget = sheetInput.trim() || savedSheetId;
    if (!effectiveSheetTarget) {
      toast({
        title: 'Input Required',
        description: 'Please paste your Google Sheet URL or Apps Script Web App URL.',
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
      // Find current parent names from appData
      let parentNames = { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' };
      if (appData?.months) {
        const monthKeys = Object.keys(appData.months).sort();
        if (monthKeys.length > 0) {
          const latest = appData.months[monthKeys[monthKeys.length - 1]];
          if (latest?.parentNames) {
            parentNames = latest.parentNames;
          }
        }
      }

      const response = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          dataOwnerId: dataOwnerId || user.uid,
          sheetId: effectiveSheetTarget,
          currentAppData: appData,
          parentNames,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync with Google Sheet');
      }

      // Persist the synced data to Firestore using the authenticated client SDK
      const ownerId = dataOwnerId || user.uid;
      if (data.updatedAppData && firestore && ownerId) {
        await saveUserData(firestore, ownerId, data.updatedAppData);

        const userRef = doc(firestore, 'users', ownerId);
        await setDoc(
          userRef,
          {
            googleSheetConfig: {
              sheetId: effectiveSheetTarget,
              sheetUrl: effectiveSheetTarget,
              lastSyncedAt: data.lastSyncedAt || new Date().toISOString(),
              syncStatus: 'connected',
              errorMessage: null,
            },
          },
          { merge: true }
        );
      }

      toast({
        title: 'Google Sheet Synced!',
        description: `Imported ${data.importedToApp} new, exported ${data.exportedToSheet} to Sheet, reconciled ${data.statusUpdated} statuses.`,
      });
    } catch (err: any) {
      console.error('Sync failed:', err);
      toast({
        title: 'Sync Failed',
        description: err.message || 'Check your Google Sheet URL or Apps Script Web App deployment.',
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
                <CardTitle>Google Sheet Live Sync</CardTitle>
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
        {/* Step 1: Sheet or Apps Script URL Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="googleSheetUrl" className="text-xs font-semibold text-muted-foreground uppercase">
              Google Sheet URL or Apps Script Web App URL
            </Label>
            {isScript && (
              <Badge variant="secondary" className="text-[11px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 gap-1">
                <Zap className="h-3 w-3" />
                Apps Script Web App
              </Badge>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="googleSheetUrl"
              placeholder="Paste Apps Script Web App URL or Google Sheet URL"
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
            Paste your <strong>Apps Script Web App URL</strong> (recommended) or your <strong>Google Sheet address</strong>.
          </p>
        </div>

        {/* Option 1: Apps Script (Recommended - No Cloud Setup) */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                ★
              </span>
              <span>Recommended: Connect in 1 Minute via Apps Script (Zero Cloud Setup)</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyCode}
              className="gap-1.5 text-xs h-7 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            >
              {isCodeCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {isCodeCopied ? 'Code Copied!' : 'Copy Apps Script Code'}
            </Button>
          </div>

          <ol className="list-decimal pl-5 space-y-1.5 text-xs text-muted-foreground">
            <li>In your Google Sheet, click <strong>Extensions</strong> ➔ <strong>Apps Script</strong>.</li>
            <li>Delete any code in <code>Code.gs</code> and paste the copied script.</li>
            <li>Click <strong>Deploy</strong> ➔ <strong>New deployment</strong>, select <strong>Web app</strong> (Execute as: <em>Me</em>, Access: <em>Anyone</em>).</li>
            <li>Click <strong>Deploy</strong>, copy the Web App URL, and paste it into the box above!</li>
          </ol>
        </div>

        {/* Option 2: Service Account (For Direct Google Sheets API) */}
        <Accordion type="single" collapsible className="w-full border rounded-xl px-4 py-1">
          <AccordionItem value="service-account" className="border-none">
            <AccordionTrigger className="text-xs font-semibold py-2 hover:no-underline">
              <span className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Alternative: Connect directly via Google Service Account
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2 text-xs text-muted-foreground">
              <p>
                If you prefer connecting via Google Cloud Service Account instead of an Apps Script Web App, share your Google Sheet with:
              </p>
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
              <p>
                In your Google Sheet, click the green <strong>Share</strong> button, paste the email above, and grant it <strong>Editor</strong> access.
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
