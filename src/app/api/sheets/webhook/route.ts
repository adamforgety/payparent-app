import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase/server';
import { extractSpreadsheetId, twoWaySyncWithSheet } from '@/lib/sheets';
import type { UserDoc, ParentNames } from '@/lib/types';

/**
 * Webhook endpoint triggered by Google Apps Script onChange / onEdit events.
 * Payload: { sheetId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sheetId: rawSheetId } = body;

    const cleanSheetId = extractSpreadsheetId(rawSheetId || '');
    if (!cleanSheetId) {
      return NextResponse.json({ error: 'Missing or invalid sheetId' }, { status: 400 });
    }

    const { firestore } = initializeFirebase();
    if (!firestore) {
      return NextResponse.json({ error: 'Firestore is not initialized' }, { status: 500 });
    }

    // Find the user document that has this sheetId configured
    const usersSnapshot = await firestore
      .collection('users')
      .where('googleSheetConfig.sheetId', '==', cleanSheetId)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json(
        { error: 'No PayParent account found associated with this Google Sheet ID.' },
        { status: 404 }
      );
    }

    const userDocRef = usersSnapshot.docs[0].ref;
    const userData = usersSnapshot.docs[0].data() as UserDoc;

    let parentNames: ParentNames = { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' };
    const monthKeys = Object.keys(userData.appData?.months || {}).sort();
    if (monthKeys.length > 0) {
      const latestMonth = userData.appData.months[monthKeys[monthKeys.length - 1]];
      if (latestMonth?.parentNames) {
        parentNames = latestMonth.parentNames;
      }
    }

    const syncResult = await twoWaySyncWithSheet(
      cleanSheetId,
      userData.appData,
      parentNames
    );

    await userDocRef.set(
      {
        appData: syncResult.updatedAppData,
        googleSheetConfig: {
          sheetId: cleanSheetId,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'connected',
        },
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Webhook sync completed successfully',
      importedToApp: syncResult.importedToApp,
      exportedToSheet: syncResult.exportedToSheet,
    });
  } catch (error: any) {
    console.error('Webhook sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook sync failed' },
      { status: 500 }
    );
  }
}
