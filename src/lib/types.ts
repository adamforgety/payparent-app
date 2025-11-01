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
  receiptUrl?: string;
  receiptFilename?: string;
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
export interface MedicalExpenseSplit {
  'Parent 1': number;
  'Parent 2': number;
}


export interface MonthData {
  id: string; // yyyy-MM
  year: number;
  month: number; // 1-12
  childSupport: ChildSupport;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  parentNames: ParentNames;
  expenses: Expense[];
}

export interface AppData {
  id: string;
  months: {
    [monthId: string]: MonthData;
  };
}

// Add this to your types
export interface UserDoc {
  id: string;
  appData: AppData;
}
