import type { AppData } from './types';
import { format } from 'date-fns';

const today = new Date();
const monthId = format(today, 'yyyy-MM');

// The initial structure for the `appData` object.
export const initialData: AppData = {
  months: {
    [monthId]: {
      id: monthId,
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      childSupport: {
        amount: 0,
        paidBy: 'None',
        status: 'Unsettled',
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
        },
        {
          id: 'medical-childcare-split',
          name: 'Medical & Child Care',
          split: { 'Parent 1': 50, 'Parent 2': 50 },
          categories: ['Medical', 'Child Care'],
        },
      ],
    },
  },
};
