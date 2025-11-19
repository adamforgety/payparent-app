
export type ExpenseCategory =
  | 'Medical'
  | 'Education'
  | 'Child Care'
  | 'Activities'
  | 'Clothing'
  | 'Food'
  | 'Reimbursement'
  | 'Other';

export type PaymentStatus = 'Unsettled' | 'Settled';

export interface Expense {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
  paidBy: Parent;
  category: ExpenseCategory;
  status: PaymentStatus;
  year: number;
  month: number;
  receiptUrl?: string | null;
  receiptFilename?: string | null;
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

export interface CustomSplit {
  id: string;
  name: string;
  split: ExpenseSplit;
  categories: ExpenseCategory[];
}


export interface MonthData {
  id: string; // yyyy-MM
  year: number;
  month: number; // 1-12
  childSupport: ChildSupport;
  parentNames: ParentNames;
  expenses: Expense[];
  customSplits: CustomSplit[];
}

export interface AppData {
  months: {
    [monthId: string]: MonthData;
  };
}

// This is the definitive structure for the /users/{userId} document
export interface UserDoc {
  id: string;
  email: string | null;
  // All app-specific data is nested here
  appData: AppData;
  coParentId: string | null;
  dataOwnerId: string;
}
