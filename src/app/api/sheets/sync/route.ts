import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase/server';
import { extractSpreadsheetId, isAppsScriptUrl, twoWaySyncWithSheet } from '@/lib/sheets';
import type { UserDoc, ParentNames, AppData } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      dataOwnerId: clientDataOwnerId,
      sheetId: rawSheetId,
      currentAppData: clientAppData,
      parentNames: clientParentNames,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const effectiveDataOwnerId = clientDataOwnerId || userId;
    let appDataToSync: AppData = clientAppData;
    let parentNames: ParentNames = clientParentNames || { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' };
    let cleanSheetTarget = rawSheetId ? (isAppsScriptUrl(rawSheetId) ? rawSheetId.trim() : extractSpreadsheetId(rawSheetId)) : '';

    // If client didn't supply appData, attempt to read from Firestore (production / ADC)
    if (!appDataToSync) {
      try {
        const { firestore } = initializeFirebase();
        if (firestore) {
          const userDocSnap = await firestore.collection('users').doc(effectiveDataOwnerId).get();
          if (userDocSnap.exists) {
            const userData = userDocSnap.data() as UserDoc;
            appDataToSync = userData.appData || { months: {} };
            if (!cleanSheetTarget && userData.googleSheetConfig?.sheetId) {
              cleanSheetTarget = userData.googleSheetConfig.sheetId;
            }
          }
        }
      } catch (fsErr) {
        console.warn('Could not read user document from server Firestore:', fsErr);
      }
    }

    if (!cleanSheetTarget) {
      return NextResponse.json(
        { error: 'No Google Sheet URL, Sheet ID, or Apps Script Web App URL provided.' },
        { status: 400 }
      );
    }

    if (!appDataToSync) {
      appDataToSync = { months: {} };
    }

    // 4. Perform the two-way sync
    const syncResult = await twoWaySyncWithSheet(
      cleanSheetTarget,
      appDataToSync,
      parentNames
    );

    // 5. Attempt to persist to Firestore on server if admin SDK is working
    try {
      const { firestore } = initializeFirebase();
      if (firestore) {
        await firestore.collection('users').doc(effectiveDataOwnerId).set(
          {
            appData: syncResult.updatedAppData,
            googleSheetConfig: {
              sheetId: cleanSheetTarget,
              sheetUrl: rawSheetId,
              lastSyncedAt: new Date().toISOString(),
              syncStatus: 'connected',
              errorMessage: null,
            },
          },
          { merge: true }
        );
      }
    } catch (persistErr) {
      // In local dev without service account, this is expected; client SDK will persist
      console.log('Server-side Firestore persistence skipped (local dev). Client will persist.');
    }

    return NextResponse.json({
      success: true,
      message: syncResult.message,
      importedToApp: syncResult.importedToApp,
      exportedToSheet: syncResult.exportedToSheet,
      statusUpdated: syncResult.statusUpdated,
      totalSheetRows: syncResult.totalSheetRows,
      totalAppExpenses: syncResult.totalAppExpenses,
      updatedAppData: syncResult.updatedAppData,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error during Google Sheets sync:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to sync with Google Sheet',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
