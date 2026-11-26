/**
 * Client-safe utilities for Google Sheets integration
 */

/**
 * Checks if a string is a Google Apps Script Web App URL.
 * Example: https://script.google.com/macros/s/AKfycby.../exec
 */
export function isAppsScriptUrl(urlOrId: string): boolean {
  if (!urlOrId) return false;
  return urlOrId.includes('script.google.com/macros/s/') || urlOrId.includes('/macros/s/');
}

/**
 * Extracts a Google Spreadsheet ID from a full Google Sheets URL or returns the bare ID.
 * Example URL: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
 */
export function extractSpreadsheetId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  if (isAppsScriptUrl(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}
