import { google } from 'googleapis';
import { format, parse, isValid } from 'date-fns';
import type { AppData, Expense, ExpenseCategory, Parent, ParentNames, PaymentStatus } from './types';
import { extractSpreadsheetId, isAppsScriptUrl } from './sheet-utils';

export { extractSpreadsheetId, isAppsScriptUrl };

/**
 * Gets an authenticated Google Sheets API client using a Service Account if configured.
 * Safely returns null if credentials are not configured in the environment.
 */
export function getGoogleSheetsClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (serviceAccountEmail && privateKey) {
    try {
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return google.sheets({ version: 'v4', auth });
    } catch (err) {
      console.warn('Failed to initialize JWT auth for Google Sheets:', err);
    }
  }

  // Only attempt Application Default Credentials if explicitly configured
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCLOUD_PROJECT) {
    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return google.sheets({ version: 'v4', auth });
    } catch (err) {
      console.warn('Failed to initialize GoogleAuth for Google Sheets:', err);
    }
  }

  return null;
}

export interface ParsedSheetRow {
  rowIndex: number;
  dateStr: string;
  isoDate: string;
  year: number;
  month: number;
  monthId: string;
  description: string;
  category: ExpenseCategory;
  paidBy: Parent;
  status: PaymentStatus;
  amount: number;
}

/**
 * Helper to parse a date from a Google Sheet cell.
 * Handles Excel serial numbers, ISO strings (YYYY-MM-DD), and US dates (MM/DD/YYYY).
 */
export function parseSheetDate(raw: any): { isoDate: string; year: number; month: number; monthId: string } | null {
  if (raw === null || raw === undefined || raw === '') return null;

  let d: Date | null = null;

  // Handle Excel serial date number (e.g. 45590)
  if (typeof raw === 'number' || (!isNaN(Number(raw)) && !String(raw).includes('-') && !String(raw).includes('/'))) {
    const serial = Number(raw);
    if (serial > 10000) {
      d = new Date((serial - 25569) * 86400 * 1000);
    }
  }

  // Handle string dates
  if (!d) {
    const str = String(raw).trim();
    // Try YYYY-MM-DD
    const isoParsed = parse(str, 'yyyy-MM-dd', new Date());
    if (isValid(isoParsed)) {
      d = isoParsed;
    } else {
      // Try M/d/yyyy
      const usParsed = parse(str, 'M/d/yyyy', new Date());
      if (isValid(usParsed)) {
        d = usParsed;
      } else {
        const fallback = new Date(str);
        if (isValid(fallback)) {
          d = fallback;
        }
      }
    }
  }

  if (!d || isNaN(d.getTime())) return null;

  const yr = d.getFullYear();
  const mo = d.getMonth() + 1;
  const monthId = `${yr}-${String(mo).padStart(2, '0')}`;
  const isoDate = format(d, 'yyyy-MM-dd');

  return { isoDate, year: yr, month: mo, monthId };
}

/**
 * Parses a 2D matrix of row values into structured ParsedSheetRow items.
 */
export function parseRawRowMatrix(
  rows: any[][],
  parentNames: ParentNames,
  startRowIndex: number = 1
): ParsedSheetRow[] {
  const parsedRows: ParsedSheetRow[] = [];
  const p1Name = (parentNames['Parent 1'] || 'Parent 1').toLowerCase().trim();
  const p2Name = (parentNames['Parent 2'] || 'Parent 2').toLowerCase().trim();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + startRowIndex;

    if (!row || !Array.isArray(row) || row.length === 0) continue;

    const [rawDate, rawDesc, rawCategory, rawPaidBy, rawStatus, rawAmount] = row;

    // Skip header row if it looks like column titles
    if (
      i < 3 &&
      typeof rawDate === 'string' &&
      (rawDate.toLowerCase().includes('date') || String(rawDesc || '').toLowerCase().includes('description'))
    ) {
      continue;
    }

    if (!rawDate && !rawDesc && !rawAmount) continue;

    const parsedDate = parseSheetDate(rawDate);
    if (!parsedDate) continue;

    const amount =
      typeof rawAmount === 'number'
        ? rawAmount
        : parseFloat(String(rawAmount || '0').replace(/[^0-9.-]+/g, ''));
    if (isNaN(amount) || amount <= 0) continue;

    const description = String(rawDesc || '').trim() || 'Expense';
    const category = (String(rawCategory || 'Other').trim() || 'Other') as ExpenseCategory;

    const paidByStr = String(rawPaidBy || '').toLowerCase().trim();
    let paidBy: Parent = 'Parent 1';
    if (
      paidByStr === p2Name ||
      paidByStr.includes('parent 2') ||
      paidByStr.includes('khylee') ||
      paidByStr.includes('mom')
    ) {
      paidBy = 'Parent 2';
    } else if (
      paidByStr === p1Name ||
      paidByStr.includes('parent 1') ||
      paidByStr.includes('adam') ||
      paidByStr.includes('dad')
    ) {
      paidBy = 'Parent 1';
    }

    const statusStr = String(rawStatus || '').toLowerCase().trim();
    const status: PaymentStatus =
      statusStr.includes('settled') && !statusStr.includes('unsettled')
        ? 'Settled'
        : 'Unsettled';

    parsedRows.push({
      rowIndex,
      dateStr: String(rawDate),
      isoDate: parsedDate.isoDate,
      year: parsedDate.year,
      month: parsedDate.month,
      monthId: parsedDate.monthId,
      description,
      category,
      paidBy,
      status,
      amount: Math.round(amount * 100) / 100,
    });
  }

  return parsedRows;
}

/**
 * Reads all expense rows from either:
 * 1. An Apps Script Web App URL (GET request)
 * 2. Google Sheets API v4 (if Service Account is configured)
 * 3. GViz Public/Link-Shared Sheet endpoint
 */
export async function readExpensesFromSheet(
  sheetUrlOrId: string,
  parentNames: ParentNames
): Promise<{ rows: ParsedSheetRow[]; source: 'appscript' | 'api' | 'gviz' }> {
  const trimmed = (sheetUrlOrId || '').trim();

  // Mode 1: Google Apps Script Web App
  if (isAppsScriptUrl(trimmed)) {
    try {
      const urlWithParam = trimmed.includes('?')
        ? (trimmed.includes('api=') ? trimmed : `${trimmed}&api=sync`)
        : `${trimmed}?api=sync`;

      const res = await fetch(urlWithParam, { redirect: 'follow' });
      if (!res.ok) {
        throw new Error(`Apps Script responded with HTTP ${res.status}`);
      }
      const data = await res.json();

      // Check if returned data from getDashboardDataDirect()
      if (Array.isArray(data.transactions)) {
        const p1Name = (parentNames['Parent 1'] || 'Adam').toLowerCase().trim();
        const p2Name = (parentNames['Parent 2'] || 'Khylee').toLowerCase().trim();

        const rows: ParsedSheetRow[] = data.transactions.map((t: any) => {
          const yr = Number(t.year) || new Date(t.isoDate).getFullYear();
          const mo = typeof t.month === 'number' ? t.month + 1 : new Date(t.isoDate).getMonth() + 1;
          const monthId = `${yr}-${String(mo).padStart(2, '0')}`;

          const payerStr = String(t.payer || '').toLowerCase().trim();
          const paidBy: Parent =
            payerStr === p2Name || payerStr.includes('khylee') || payerStr.includes('parent 2')
              ? 'Parent 2'
              : 'Parent 1';

          const statusStr = String(t.status || '').toLowerCase().trim();
          const status: PaymentStatus =
            statusStr.includes('settled') && !statusStr.includes('unsettled')
              ? 'Settled'
              : 'Unsettled';

          return {
            rowIndex: Number(t.rowIndex),
            dateStr: String(t.isoDate),
            isoDate: String(t.isoDate),
            year: yr,
            month: mo,
            monthId,
            description: String(t.description || ''),
            category: (t.category || 'Other') as ExpenseCategory,
            paidBy,
            status,
            amount: Number(t.amount) || 0,
          };
        });
        return { rows, source: 'appscript' };
      }

      const rawRows = Array.isArray(data.rows) ? data.rows : Array.isArray(data) ? data : [];
      const rows = parseRawRowMatrix(rawRows, parentNames, 1);
      return { rows, source: 'appscript' };
    } catch (err: any) {
      throw new Error(`Failed to read from Apps Script Web App: ${err.message}`);
    }
  }

  const cleanSheetId = extractSpreadsheetId(trimmed);
  if (!cleanSheetId) {
    throw new Error('Please enter a valid Google Sheet URL, Sheet ID, or Apps Script Web App URL.');
  }

  // Mode 2: Google Sheets API with Service Account
  const sheets = getGoogleSheetsClient();
  if (sheets) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: cleanSheetId,
        range: 'Expenses!A3:F',
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      });
      const rows = parseRawRowMatrix(response.data.values || [], parentNames, 3);
      return { rows, source: 'api' };
    } catch (apiErr: any) {
      console.warn('Google Sheets API call failed:', apiErr.message);
    }
  }

  // Mode 3: GViz Public Link-Shared Sheet fallback
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/gviz/tq?tqx=out:json&sheet=Expenses`;
    const res = await fetch(gvizUrl);
    if (res.ok) {
      const text = await res.text();
      if (text.includes('google.visualization.Query.setResponse')) {
        const jsonStr = text.replace(/^[^{]*\(/, '').replace(/\);?$/, '');
        const gvizData = JSON.parse(jsonStr);
        if (gvizData.table && Array.isArray(gvizData.table.rows)) {
          const rawRows = gvizData.table.rows.map((r: any) =>
            (r.c || []).map((cell: any) => (cell ? cell.v : ''))
          );
          const rows = parseRawRowMatrix(rawRows, parentNames, 2);
          return { rows, source: 'gviz' };
        }
      }
    }
  } catch (gvizErr) {
    console.warn('GViz fetch failed:', gvizErr);
  }

  // If all modes failed, provide a clear, helpful error message
  throw new Error(
    'Unable to connect to Google Sheet. Your sheet is private and no service account credentials were found in .env.\n\n' +
    '💡 Quickest solution: In your Google Sheet, open Extensions > Apps Script, paste the Web App script (copy it from the card below), click Deploy > New deployment > Web app, and paste your Web App URL here — it connects instantly with zero Google Cloud setup!'
  );
}

/**
 * Appends one or more expenses to the Google Sheet.
 */
export async function appendExpensesToSheet(
  sheetUrlOrId: string,
  expenses: Expense[],
  parentNames: ParentNames
): Promise<number> {
  if (expenses.length === 0) return 0;
  const trimmed = (sheetUrlOrId || '').trim();

  const rowsToAppend = expenses.map((exp) => {
    const parentDisplayName = parentNames[exp.paidBy] || exp.paidBy;
    const dateFormatted = format(new Date(exp.date), 'M/d/yyyy');

    return [
      dateFormatted,
      exp.description,
      exp.category,
      parentDisplayName,
      exp.status,
      exp.amount,
    ];
  });

  // Mode 1: Apps Script Web App
  if (isAppsScriptUrl(trimmed)) {
    try {
      const res = await fetch(trimmed, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'append', rows: rowsToAppend }),
      });
      if (res.ok) {
        return rowsToAppend.length;
      }
    } catch (err) {
      console.error('Error appending to Apps Script:', err);
    }
    return 0;
  }

  // Mode 2: Google Sheets API
  const cleanSheetId = extractSpreadsheetId(trimmed);
  const sheets = getGoogleSheetsClient();
  if (sheets && cleanSheetId) {
    try {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: cleanSheetId,
        range: 'Expenses!A:F',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: rowsToAppend },
      });
      return response.data.updates?.updatedRows || rowsToAppend.length;
    } catch (err) {
      console.error('Error appending via Sheets API:', err);
    }
  }

  return 0;
}

/**
 * Updates the status cell (Column E) of a specific row in the Google Sheet.
 */
export async function updateExpenseStatusInSheet(
  sheetUrlOrId: string,
  rowIndex: number,
  status: PaymentStatus
): Promise<boolean> {
  const trimmed = (sheetUrlOrId || '').trim();

  // Mode 1: Apps Script Web App
  if (isAppsScriptUrl(trimmed)) {
    try {
      await fetch(trimmed, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', updates: [{ rowIndex, status }] }),
      });
      return true;
    } catch (err) {
      console.error('Error updating status in Apps Script:', err);
      return false;
    }
  }

  // Mode 2: Google Sheets API
  const cleanSheetId = extractSpreadsheetId(trimmed);
  const sheets = getGoogleSheetsClient();
  if (sheets && cleanSheetId) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSheetId,
        range: `Expenses!E${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[status]] },
      });
      return true;
    } catch (err) {
      console.error('Error updating status via Sheets API:', err);
      return false;
    }
  }

  return false;
}

/**
 * Determines if a Google Sheet row and a PayParent expense represent the same transaction.
 * Accounts for slight naming variations, formatting differences, and minor date offsets.
 */
export function isFuzzyExpenseMatch(
  sheetRow: { isoDate: string; description: string; amount: number; paidBy: Parent; category?: string },
  appExpense: { date: string; description: string; amount: number; paidBy: Parent; category?: string }
): boolean {
  // 1. Amount must be identical (within 1 cent)
  if (Math.abs(sheetRow.amount - appExpense.amount) >= 0.01) {
    return false;
  }

  // 2. Payer must match
  if (sheetRow.paidBy !== appExpense.paidBy) {
    return false;
  }

  // 3. Date proximity
  const sheetDate = new Date(sheetRow.isoDate);
  const appDate = new Date(appExpense.date);

  let diffDays = 0;
  if (!isNaN(sheetDate.getTime()) && !isNaN(appDate.getTime())) {
    const sYr = sheetDate.getFullYear();
    const sMo = sheetDate.getMonth();
    const aYr = appDate.getFullYear();
    const aMo = appDate.getMonth();

    const diffTime = Math.abs(sheetDate.getTime() - appDate.getTime());
    diffDays = diffTime / (1000 * 60 * 60 * 24);

    // If more than 10 days apart and different months, not the same transaction
    if (diffDays > 10 && (sYr !== aYr || sMo !== aMo)) {
      return false;
    }
  }

  // Normalize descriptions
  const normalize = (str: string) =>
    (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const sDesc = normalize(sheetRow.description);
  const aDesc = normalize(appExpense.description);

  // Exact description match
  if (sDesc === aDesc) {
    return true;
  }

  // One description contains the other (e.g. "target" & "target clothes", "cvs" & "cvs pharmacy", "costco" & "costco wholesale")
  if (sDesc.length >= 3 && aDesc.length >= 3) {
    if (sDesc.includes(aDesc) || aDesc.includes(sDesc)) {
      return true;
    }
  }

  // Common keyword overlap
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'at', 'in', 'of', 'to', 'a', 'an', 'co', 'inc', 'llc', 'or', 'on', 'by']);
  const sWords = sDesc.split(' ').filter((w) => w.length >= 3 && !stopWords.has(w));
  const aWords = aDesc.split(' ').filter((w) => w.length >= 3 && !stopWords.has(w));

  const hasCommonWord = sWords.some((w) => aWords.includes(w));
  if (hasCommonWord) {
    return true;
  }

  // Prefix matching on words (e.g. "cloth" in "clothing" vs "clothes", "pediatr" in "pediatrician" vs "pediatric")
  for (const sw of sWords) {
    for (const aw of aWords) {
      if (sw.length >= 4 && aw.length >= 4) {
        const minLen = Math.min(sw.length, aw.length, 5);
        if (sw.substring(0, minLen) === aw.substring(0, minLen)) {
          return true;
        }
      }
    }
  }

  // If in the exact same month, same payer, exact same amount, and within 3 days:
  if (diffDays <= 3) {
    return true;
  }

  return false;
}

/**
 * Deduplicates an array of expenses in a month, merging accidental duplicates.
 */
export function deduplicateMonthExpenses(expenses: Expense[]): Expense[] {
  if (!Array.isArray(expenses) || expenses.length <= 1) return expenses || [];

  const deduplicated: Expense[] = [];
  const handledIds = new Set<string>();

  for (let i = 0; i < expenses.length; i++) {
    const current = expenses[i];
    if (handledIds.has(current.id)) continue;

    let duplicateIndex = -1;
    for (let j = i + 1; j < expenses.length; j++) {
      const other = expenses[j];
      if (handledIds.has(other.id)) continue;

      const currentIso = current.date ? format(new Date(current.date), 'yyyy-MM-dd') : '';
      if (
        isFuzzyExpenseMatch(
          {
            isoDate: currentIso,
            description: current.description,
            amount: current.amount,
            paidBy: current.paidBy,
            category: current.category,
          },
          other
        )
      ) {
        duplicateIndex = j;
        break;
      }
    }

    if (duplicateIndex !== -1) {
      const other = expenses[duplicateIndex];
      handledIds.add(other.id);

      // Merge the pair: prefer non-sheet ID as base, but transfer sheetRowIndex and status
      const isCurrentSheet = current.id.startsWith('sheet-');
      const isOtherSheet = other.id.startsWith('sheet-');

      let primary = current;
      let secondary = other;

      if (isCurrentSheet && !isOtherSheet) {
        primary = other;
        secondary = current;
      }

      if (!primary.sheetRowIndex && secondary.sheetRowIndex) {
        primary.sheetRowIndex = secondary.sheetRowIndex;
      }

      if (secondary.status === 'Settled' || primary.status === 'Settled') {
        primary.status = 'Settled';
      }

      if (!primary.receiptUrl && secondary.receiptUrl) {
        primary.receiptUrl = secondary.receiptUrl;
        primary.receiptFilename = secondary.receiptFilename;
      }

      deduplicated.push(primary);
    } else {
      deduplicated.push(current);
    }

    handledIds.add(current.id);
  }

  return deduplicated;
}

export interface SyncResult {
  success: boolean;
  importedToApp: number;
  exportedToSheet: number;
  statusUpdated: number;
  totalSheetRows: number;
  totalAppExpenses: number;
  updatedAppData: AppData;
  message: string;
}

/**
 * Performs a comprehensive two-way sync between the Google Sheet and PayParent AppData:
 * 1. Reads all rows from Google Sheet (via Web App, Sheets API, or link-shared sheet).
 * 2. Compares with all expenses in PayParent AppData.
 * 3. Imports new rows from Sheet -> AppData.
 * 4. Appends app-only expenses -> Sheet.
 * 5. Syncs settlement status if changed.
 */
export async function twoWaySyncWithSheet(
  sheetUrlOrId: string,
  currentAppData: AppData,
  parentNames: ParentNames
): Promise<SyncResult> {
  const trimmed = (sheetUrlOrId || '').trim();
  if (!trimmed) {
    throw new Error('Please enter a Google Sheet URL, Sheet ID, or Apps Script Web App URL.');
  }

  // 1. Read all rows from the Sheet
  const { rows: sheetRows, source } = await readExpensesFromSheet(trimmed, parentNames);

  // Clone AppData so we can update it cleanly
  const updatedAppData: AppData = JSON.parse(JSON.stringify(currentAppData || { months: {} }));
  if (!updatedAppData.months) updatedAppData.months = {};

  const isChildSupport = (item: { category?: string; description?: string }) => {
    const cat = (item.category || '').toLowerCase().trim();
    const desc = (item.description || '').toLowerCase().trim();
    return cat === 'child support' || desc.includes('child support');
  };

  // Clean up any existing duplicate Child Support expenses and merge accidental duplicates
  for (const [mId, mData] of Object.entries(updatedAppData.months)) {
    if (Array.isArray(mData.expenses)) {
      mData.expenses = mData.expenses.filter((exp) => !isChildSupport(exp));
      mData.expenses = deduplicateMonthExpenses(mData.expenses);
    }
  }

  let importedToApp = 0;
  let exportedToSheet = 0;
  let statusUpdated = 0;

  // Flatten all existing app expenses
  const existingAppExpenses: { expense: Expense; monthId: string }[] = [];
  for (const [mId, mData] of Object.entries(updatedAppData.months)) {
    if (Array.isArray(mData.expenses)) {
      for (const exp of mData.expenses) {
        existingAppExpenses.push({ expense: exp, monthId: mId });
      }
    }
  }

  const matchedAppExpenseIds = new Set<string>();
  const rowsToUpdateInSheet: { rowIndex: number; status: PaymentStatus }[] = [];

  // 2. Process Sheet rows -> AppData
  for (const sheetRow of sheetRows) {
    const mId = sheetRow.monthId;

    if (!updatedAppData.months[mId]) {
      updatedAppData.months[mId] = {
        id: mId,
        year: sheetRow.year,
        month: sheetRow.month,
        childSupport: {
          amount: 0,
          paidBy: 'None',
          monthlyPayer: { 1: 'None', 2: 'None', 3: 'None', 4: 'None', 5: 'None', 6: 'None', 7: 'None', 8: 'None', 9: 'None', 10: 'None', 11: 'None', 12: 'None' },
          status: 'Unsettled',
        },
        parentNames,
        expenses: [],
        customSplits: [],
      };
    }

    // SPECIAL HANDLING FOR CHILD SUPPORT:
    // In PayParent, Child Support is tracked directly in monthData.childSupport, NOT in expenses[].
    // If the sheet auto-adds a Child Support row, we sync its amount/status to childSupport and DO NOT add it to expenses[].
    if (isChildSupport(sheetRow)) {
      const currentCs = updatedAppData.months[mId].childSupport;
      const csMonth = sheetRow.month;

      if (currentCs) {
        if (sheetRow.status !== currentCs.status) {
          if (sheetRow.status === 'Settled' && currentCs.status === 'Unsettled') {
            currentCs.status = 'Settled';
            statusUpdated++;
          } else if (currentCs.status === 'Settled' && sheetRow.status === 'Unsettled') {
            rowsToUpdateInSheet.push({ rowIndex: sheetRow.rowIndex, status: 'Settled' });
            statusUpdated++;
          }
        }

        currentCs.amount = sheetRow.amount;
        currentCs.paidBy = sheetRow.paidBy;
        if (!currentCs.monthlyPayer) currentCs.monthlyPayer = {};
        currentCs.monthlyPayer[csMonth] = sheetRow.paidBy;
      }
      continue;
    }

    // Regular expense matching using intelligent fuzzy match
    const matched = existingAppExpenses.find(
      (item) =>
        item.monthId === mId &&
        !matchedAppExpenseIds.has(item.expense.id) &&
        isFuzzyExpenseMatch(sheetRow, item.expense)
    );

    if (matched) {
      matchedAppExpenseIds.add(matched.expense.id);

      if (sheetRow.status !== matched.expense.status) {
        if (sheetRow.status === 'Settled' && matched.expense.status === 'Unsettled') {
          matched.expense.status = 'Settled';
          statusUpdated++;
        } else if (matched.expense.status === 'Settled' && sheetRow.status === 'Unsettled') {
          rowsToUpdateInSheet.push({ rowIndex: sheetRow.rowIndex, status: 'Settled' });
          statusUpdated++;
        }
      }

      matched.expense.sheetRowIndex = sheetRow.rowIndex;
    } else {
      // Check if this sheet row is a duplicate of an ALREADY MATCHED expense in this month
      const alreadyMatchedInSheet = existingAppExpenses.find(
        (item) =>
          item.monthId === mId &&
          matchedAppExpenseIds.has(item.expense.id) &&
          isFuzzyExpenseMatch(sheetRow, item.expense)
      );

      if (alreadyMatchedInSheet) {
        // Skip importing duplicate rows from the Google Sheet
        continue;
      }

      const newExpense: Expense = {
        id: `sheet-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        date: new Date(sheetRow.isoDate).toISOString(),
        description: sheetRow.description,
        amount: sheetRow.amount,
        paidBy: sheetRow.paidBy,
        category: sheetRow.category,
        status: sheetRow.status,
        year: sheetRow.year,
        month: sheetRow.month,
        sheetRowIndex: sheetRow.rowIndex,
      };

      updatedAppData.months[mId].expenses.push(newExpense);
      existingAppExpenses.push({ expense: newExpense, monthId: mId });
      matchedAppExpenseIds.add(newExpense.id);
      importedToApp++;
    }
  }

  // 3. Process App expenses that do not exist in the Sheet -> export them to the Sheet
  const appExpensesToExport: Expense[] = [];
  for (const item of existingAppExpenses) {
    if (
      !matchedAppExpenseIds.has(item.expense.id) &&
      !item.expense.id.startsWith('sheet-') &&
      !isChildSupport(item.expense)
    ) {
      appExpensesToExport.push(item.expense);
    }
  }

  if (appExpensesToExport.length > 0) {
    exportedToSheet = await appendExpensesToSheet(trimmed, appExpensesToExport, parentNames);
  }

  // 4. Update any mismatched statuses in the Sheet
  for (const rowUpdate of rowsToUpdateInSheet) {
    await updateExpenseStatusInSheet(trimmed, rowUpdate.rowIndex, rowUpdate.status);
  }

  let note = '';
  if (source === 'gviz' && appExpensesToExport.length > 0) {
    note = ' (Note: Sheet is connected via view link. Use Apps Script Web App for 2-way writes.)';
  }

  const message = `Sync complete! Imported ${importedToApp} from Sheet, exported ${exportedToSheet} to Sheet, reconciled ${statusUpdated} statuses.${note}`;

  return {
    success: true,
    importedToApp,
    exportedToSheet,
    statusUpdated,
    totalSheetRows: sheetRows.length,
    totalAppExpenses: existingAppExpenses.length + importedToApp,
    updatedAppData,
    message,
  };
}
