export type ExpenseCategory =
  | 'Medical'
  | 'Education'
  | 'Child Care'
  | 'Activities'
  | 'Clothing'
  | 'Food'
  | 'Other';

export type PaymentStatus = 'Unpaid' | 'Pending' | 'Paid';

export interface Expense {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
  paidBy: Parent;
  category: ExpenseCategory;
  status: PaymentStatus;
}

export type Parent = 'Parent 1' | 'Parent 2';

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
  childSupport: ChildSupport;
  expenseSplit: ExpenseSplit;
  expenses: Expense[];
}

export interface AppData {
  [monthYear: string]: MonthData;
}
