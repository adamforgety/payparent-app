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
  id: string; // yyyy-MM
  year: number;
  month: number; // 1-12
  childSupport: ChildSupport;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: ExpenseSplit;
  parentNames: ParentNames;
  expenses: Expense[];
}

// This represents the structure of the entire user document in Firestore
export interface AppData {
  id: string; // user UID
  months?: {
    [monthId: string]: MonthData; // key is yyyy-MM
  };
}
