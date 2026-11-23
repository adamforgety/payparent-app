import type { AppData } from './types';
import { format } from 'date-fns';

const today = new Date();
const monthId = format(today, 'yyyy-MM');

const initialMonthlyPayer = () => {
    const payers: { [month: number]: 'None' } = {};
    for (let i = 1; i <= 12; i++) {
        payers[i] = 'None';
    }
    return payers;
};

// The initial structure for the `appData` object.
export const initialData: AppData = {
  months: {
    [monthId]: {
      id: monthId,
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      childSupport: {
        amount: 0,
        paidBy: 'None', // Kept for backward compatibility if needed, but new logic uses monthlyPayer
        monthlyPayer: initialMonthlyPayer(),
        status: 'Unsettled', // This status will be managed on a per-month basis in the UI
      },
      parentNames: {
        'Parent 1': 'Parent 1',
        'Parent 2': 'Parent 2',
      },
      expenses: [],
      customSplits: [
        {
          id: 'default-split',
          name: 'Default',
          split: { 'Parent 1': 50, 'Parent 2': 50 },
          categories: ['Education', 'Activities', 'Clothing', 'Food', 'Other'],
          isReimbursement: false,
        },
        {
          id: 'medical-childcare-split',
          name: 'Medical & Child Care',
          split: { 'Parent 1': 50, 'Parent 2': 50 },
          categories: ['Medical', 'Child Care'],
          isReimbursement: false,
        },
        {
          id: 'reimbursement-split',
          name: '100% Reimbursed',
          split: { 'Parent 1': 0, 'Parent 2': 0 },
          categories: ['Reimbursement'],
          isReimbursement: true,
        },
      ],
    },
  },
};
