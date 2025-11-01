import type { AppData } from './types';
import { format } from 'date-fns';

const today = new Date();
const monthId = format(today, 'yyyy-MM');

export const initialData: AppData = {
  id: 'new-user', // This will be replaced by the user's UID
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
      expenseSplit: {
        'Parent 1': 50,
        'Parent 2': 50,
      },
      medicalExpenseSplit: {
        'Parent 1': 50,
        'Parent 2': 50,
      },
      parentNames: {
        'Parent 1': 'Parent 1',
        'Parent 2': 'Parent 2',
      },
      expenses: [],
    },
  },
};

    