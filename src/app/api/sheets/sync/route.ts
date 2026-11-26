import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase/server';
import { extractSpreadsheetId, twoWaySyncWithSheet } from '@/lib/sheets';
import type { UserDoc, ParentNames } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, sheetId: rawSheetId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { firestore } = initializeFirebase();
    if (!firestore) {
      return NextResponse.json({ error: 'Firestore is not initialized' }, { status: 500 });
    }

    // 1. Fetch user doc to get dataOwnerId
    const userDocRef = firestore.collection('users').doc(userId);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDocSnap.data() as UserDoc;
    const dataOwnerId = userData.dataOwnerId || userId;

    // 2. Fetch the data owner doc (where appData is stored)
    const dataOwnerRef = firestore.collection('users').doc(dataOwnerId);
    const dataOwnerSnap = await dataOwnerRef.get();

    if (!dataOwnerSnap.exists) {
      return NextResponse.json({ error: 'Data owner not found' }, { status: 404 });
    }

    const dataOwnerData = dataOwnerSnap.data() as UserDoc;

    // 3. Resolve the sheet ID (from request payload or saved user config)
    const inputSheetId = rawSheetId || dataOwnerData.googleSheetConfig?.sheetId;
    const cleanSheetId = extractSpreadsheetId(inputSheetId || '');

    if (!cleanSheetId) {
      return NextResponse.json(
        { error: 'No Google Sheet ID provided or configured. Please enter your Sheet ID or URL.' },
        { status: 400 }
      );
    }

    // Determine parent names from most recent month
    let parentNames: ParentNames = { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' };
    const monthKeys = Object.keys(dataOwnerData.appData?.months || {}).sort();
    if (monthKeys.length > 0) {
      const latestMonth = dataOwnerData.appData.months[monthKeys[monthKeys.length - 1]];
      if (latestMonth?.parentNames) {
        parentNames = latestMonth.parentNames;
      }
    }

    // 4. Perform the two-way sync
    const syncResult = await twoWaySyncWithSheet(
      cleanSheetId,
      dataOwnerData.appData,
      parentNames
    );

    // 5. Persist the synchronized appData and configuration to Firestore
    await dataOwnerRef.set(
      {
        appData: syncResult.updatedAppData,
        googleSheetConfig: {
          sheetId: cleanSheetId,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'connected',
          errorMessage: null,
        },
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: syncResult.message,
      importedToApp: syncResult.importedToApp,
      exportedToSheet: syncResult.exportedToSheet,
      statusUpdated: syncResult.statusUpdated,
      totalSheetRows: syncResult.totalSheetRows,
      totalAppExpenses: syncResult.totalAppExpenses,
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
