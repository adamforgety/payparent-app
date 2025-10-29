export interface Expense {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
}

export type Parent = 'Parent 1' | 'Parent 2';

export interface ChildSupport {
  amount: number;
  paidBy: Parent | 'None';
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
