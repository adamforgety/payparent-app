export type ExpenseCategory =
  | 'Medical'
  | 'Education'
  | 'Child Care'
  | 'Activities'
  | 'Clothing'
  | 'Food'
  | 'Child Support'
  | 'Other';

export type PaymentStatus = 'Unpaid' | 'Paid';

export interface Expense {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
  paidBy: Parent;
  category: ExpenseCategory;
  status: PaymentStatus;
  // New fields for monthly filtering
  year: number;
  month: number;
}

export type Parent = 'Parent 1' | 'Parent 2';

export interface ParentNames {
  'Parent 1': string;
  'Parent 2': string;
}

export interface ChildSupport {
  amount: number;
  paidBy: Parent | 'None';
  status: PaymentStatus;
}

export interface ExpenseSplit {
  'Parent 1': number;
  'Parent 2': number;
}

export interface MonthData {
  id: string; // Document ID from Firestore
  year: number;
  month: number; // 1-12
  childSupport: ChildSupport;
  expenseSplit: ExpenseSplit;
  parentNames: ParentNames;
}

export interface AppData {
  [monthYear: string]: MonthData;
}
