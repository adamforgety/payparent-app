

export type ExpenseCategory =
  | 'Medical'
  | 'Education'
  | 'Child Care'
  | 'Activities'
  | 'Clothing'
  | 'Food'
  | 'Reimbursement'
  | 'Other'
  | (string & {});

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
  paidBy: Parent | 'None'; // Legacy/Fallback
  monthlyPayer: { [month: number]: Parent | 'None' }; // e.g. { 1: 'Parent 1', 2: 'Parent 1', ... 12: 'None' }
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
  isReimbursement?: boolean;
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

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

export interface SubscriptionData {
  status: SubscriptionStatus;
  plan?: 'monthly' | 'yearly';
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
}

// This is the definitive structure for the /users/{userId} document
export interface UserDoc {
  id: string;
  email: string | null;
  // All app-specific data is nested here
  appData: AppData;
  coParentId: string | null;
  dataOwnerId: string;
  createdAt?: string;
  subscription?: SubscriptionData;
}
