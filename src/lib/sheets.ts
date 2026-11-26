import { google } from 'googleapis';
import { format, parse, isValid } from 'date-fns';
import type { AppData, Expense, ExpenseCategory, Parent, ParentNames, PaymentStatus, MonthData } from './types';
import { extractSpreadsheetId } from './sheet-utils';

export { extractSpreadsheetId };

/**
 * Gets an authenticated Google Sheets API client using a Service Account.
 */
export function getGoogleSheetsClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  let auth: any;

  if (serviceAccountEmail && privateKey) {
    auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } else {
    // Fall back to Google Application Default Credentials (e.g. Firebase App Hosting or GOOGLE_APPLICATION_CREDENTIALS)
    auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  return google.sheets({ version: 'v4', auth });
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
 * Reads all expense rows from the Google Sheet (tab "Expenses", starting from row 3).
 * Columns expected:
 * A: Date
 * B: Description
 * C: Category
 * D: Paid By (mapped against parentNames)
 * E: Status ("Unsettled" or "Settled")
 * F: Amount
 */
export async function readExpensesFromSheet(
  sheetId: string,
  parentNames: ParentNames
): Promise<ParsedSheetRow[]> {
  const sheets = getGoogleSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Expenses!A3:F',
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const rows = response.data.values || [];
  const parsedRows: ParsedSheetRow[] = [];

  const p1Name = (parentNames['Parent 1'] || 'Parent 1').toLowerCase().trim();
  const p2Name = (parentNames['Parent 2'] || 'Parent 2').toLowerCase().trim();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 3; // 1-indexed, starting from row 3

    if (!row || row.length === 0) continue;

    const [rawDate, rawDesc, rawCategory, rawPaidBy, rawStatus, rawAmount] = row;

    // Skip empty rows
    if (!rawDate && !rawDesc && !rawAmount) continue;

    const parsedDate = parseSheetDate(rawDate);
    if (!parsedDate) continue;

    const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount || '0').replace(/[^0-9.-]+/g, ''));
    if (isNaN(amount) || amount <= 0) continue;

    const description = String(rawDesc || '').trim() || 'Expense';
    const category = (String(rawCategory || 'Other').trim() || 'Other') as ExpenseCategory;

    // Map paidBy to 'Parent 1' or 'Parent 2'
    const paidByStr = String(rawPaidBy || '').toLowerCase().trim();
    let paidBy: Parent = 'Parent 1';
    if (paidByStr === p2Name || paidByStr.includes('parent 2') || paidByStr.includes('khylee') || paidByStr.includes('mom')) {
      paidBy = 'Parent 2';
    } else if (paidByStr === p1Name || paidByStr.includes('parent 1') || paidByStr.includes('adam') || paidByStr.includes('dad')) {
      paidBy = 'Parent 1';
    }

    const statusStr = String(rawStatus || '').toLowerCase().trim();
    const status: PaymentStatus = statusStr.includes('settled') && !statusStr.includes('unsettled')
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
 * Appends one or more expenses to the Google Sheet (tab "Expenses").
 */
export async function appendExpensesToSheet(
  sheetId: string,
  expenses: Expense[],
  parentNames: ParentNames
): Promise<number> {
  if (expenses.length === 0) return 0;

  const sheets = getGoogleSheetsClient();

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

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Expenses!A:F',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rowsToAppend,
    },
  });

  return response.data.updates?.updatedRows || rowsToAppend.length;
}

/**
 * Updates the status cell (Column E) of a specific row in the Google Sheet.
 */
export async function updateExpenseStatusInSheet(
  sheetId: string,
  rowIndex: number,
  status: PaymentStatus
): Promise<boolean> {
  const sheets = getGoogleSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Expenses!E${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[status]],
    },
  });

  return true;
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
 * 1. Reads all rows from Google Sheet.
 * 2. Compares with all expenses in PayParent AppData.
 * 3. Imports new rows from Sheet -> AppData.
 * 4. Appends app-only expenses -> Sheet.
 * 5. Syncs settlement status if changed.
 */
export async function twoWaySyncWithSheet(
  sheetId: string,
  currentAppData: AppData,
  parentNames: ParentNames
): Promise<SyncResult> {
  const cleanSheetId = extractSpreadsheetId(sheetId);
  if (!cleanSheetId) {
    throw new Error('Invalid or missing Google Spreadsheet ID');
  }

  // 1. Read all rows from the Sheet
  const sheetRows = await readExpensesFromSheet(cleanSheetId, parentNames);

  // Clone AppData so we can update it cleanly
  const updatedAppData: AppData = JSON.parse(JSON.stringify(currentAppData || { months: {} }));
  if (!updatedAppData.months) updatedAppData.months = {};

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

  // Helper to match expenses (fuzzy match by date, description, amount, paidBy)
  const isMatch = (sheet: ParsedSheetRow, app: Expense): boolean => {
    const sheetDateStr = sheet.isoDate;
    const appDateStr = app.date ? format(new Date(app.date), 'yyyy-MM-dd') : '';

    const sameDate = sheetDateStr === appDateStr;
    const sameAmount = Math.abs(sheet.amount - app.amount) < 0.01;
    const samePayer = sheet.paidBy === app.paidBy;
    const sameDesc = sheet.description.toLowerCase().trim() === app.description.toLowerCase().trim();

    return sameDate && sameAmount && samePayer && sameDesc;
  };

  const matchedAppExpenseIds = new Set<string>();
  const rowsToUpdateInSheet: { rowIndex: number; status: PaymentStatus }[] = [];

  // 2. Process Sheet rows -> AppData
  for (const sheetRow of sheetRows) {
    const matched = existingAppExpenses.find(
      (item) => !matchedAppExpenseIds.has(item.expense.id) && isMatch(sheetRow, item.expense)
    );

    if (matched) {
      matchedAppExpenseIds.add(matched.expense.id);

      // Reconcile status if they differ
      if (sheetRow.status !== matched.expense.status) {
        // If sheet is Settled, mark app Settled; if app is Settled, mark sheet Settled
        if (sheetRow.status === 'Settled' && matched.expense.status === 'Unsettled') {
          matched.expense.status = 'Settled';
          statusUpdated++;
        } else if (matched.expense.status === 'Settled' && sheetRow.status === 'Unsettled') {
          rowsToUpdateInSheet.push({ rowIndex: sheetRow.rowIndex, status: 'Settled' });
          statusUpdated++;
        }
      }

      // Store sheet row index on app expense for fast future updates
      matched.expense.sheetRowIndex = sheetRow.rowIndex;
    } else {
      // New expense from Sheet (e.g. entered by Ex)! Add to AppData
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
      importedToApp++;
    }
  }

  // 3. Process App expenses that do not exist in the Sheet -> export them to the Sheet
  const appExpensesToExport: Expense[] = [];
  for (const item of existingAppExpenses) {
    if (!matchedAppExpenseIds.has(item.expense.id) && !item.expense.id.startsWith('sheet-')) {
      appExpensesToExport.push(item.expense);
    }
  }

  if (appExpensesToExport.length > 0) {
    exportedToSheet = await appendExpensesToSheet(cleanSheetId, appExpensesToExport, parentNames);
  }

  // 4. Update any mismatched statuses in the Sheet
  for (const rowUpdate of rowsToUpdateInSheet) {
    await updateExpenseStatusInSheet(cleanSheetId, rowUpdate.rowIndex, rowUpdate.status);
  }

  const message = `Sync complete! Imported ${importedToApp} from Sheet, exported ${exportedToSheet} to Sheet, reconciled ${statusUpdated} statuses.`;

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
