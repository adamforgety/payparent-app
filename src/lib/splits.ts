import type { CustomSplit, ExpenseCategory, Parent } from './types';

export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  'Medical',
  'Child Care',
  'Education',
  'Activities',
  'Clothing',
  'Food',
  'Reimbursement',
  'Other',
];

export const CATEGORY_COLORS: { [key: string]: string } = {
  'Child Care': '#f59e0b',
  'Education': '#10b981',
  'Activities': '#3b82f6',
  'Medical': '#ec4899',
  'Clothing': '#8b5cf6',
  'Food': '#f97316',
  'Reimbursement': '#14b8a6', // Teal
  'Other': '#64748b',
};

const PALETTE = [
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Amber
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#3b82f6', // Blue
];

export function getCategoryColor(category: string): string {
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Returns all categories available in the app, combining standard defaults
 * with any custom categories assigned to split profiles.
 */
export function getAllCategories(customSplits?: CustomSplit[]): string[] {
  const set = new Set<string>(DEFAULT_CATEGORIES);
  if (customSplits) {
    for (const split of customSplits) {
      if (Array.isArray(split.categories)) {
        for (const cat of split.categories) {
          if (cat && typeof cat === 'string') {
            set.add(cat);
          }
        }
      }
    }
  }
  return Array.from(set);
}

/**
 * Determines whether an expense is a 100% reimbursement to the paying parent.
 * It returns true if the category is 'Reimbursement' or if its assigned split profile is flagged as reimbursement.
 */
export function isExpenseReimbursement(
  category: string,
  customSplits?: CustomSplit[]
): boolean {
  if (category === 'Reimbursement' || category === 'Reconciliation') return true;
  if (!customSplits || !Array.isArray(customSplits)) return false;
  const applicableSplit = customSplits.find(
    (s) => Array.isArray(s.categories) && s.categories.includes(category as any)
  );
  return applicableSplit?.isReimbursement === true;
}

/**
 * Calculates a parent's share of an expense.
 * For a reimbursement:
 *   - The paying parent's share is $0.
 *   - The non-paying parent's share is 100% of the amount.
 * For a standard split:
 *   - Based on percentage in the assigned split profile (or 50/50 fallback).
 */
export function getExpenseParentShare(
  expense: { category: string; amount: number; paidBy: Parent },
  parent: Parent,
  customSplits?: CustomSplit[]
): number {
  if (isExpenseReimbursement(expense.category, customSplits)) {
    return expense.paidBy === parent ? 0 : expense.amount;
  }
  const applicableSplit = customSplits?.find(
    (s) => Array.isArray(s.categories) && s.categories.includes(expense.category as any)
  );
  const percent = applicableSplit ? (applicableSplit.split[parent] ?? 50) / 100 : 0.5;
  return expense.amount * percent;
}

/**
 * Calculates how much the debtor parent owes for an expense.
 * Debtor only owes if the other parent was the initial upfront payer.
 * If it's a reimbursement, the debtor owes 100%.
 */
export function getExpenseOwedAmount(
  expense: { category: string; amount: number; paidBy: Parent },
  debtorParent: Parent,
  customSplits?: CustomSplit[]
): number {
  const creditorParent: Parent = debtorParent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
  if (expense.paidBy !== creditorParent) {
    return 0;
  }
  if (isExpenseReimbursement(expense.category, customSplits)) {
    return expense.amount;
  }
  const applicableSplit = customSplits?.find(
    (s) => Array.isArray(s.categories) && s.categories.includes(expense.category as any)
  );
  const percent = applicableSplit ? (applicableSplit.split[debtorParent] ?? 50) / 100 : 0.5;
  return expense.amount * percent;
}
