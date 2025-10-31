import type { AppData } from './types';
import { format } from 'date-fns';

const today = new Date();
const monthId = format(today, 'yyyy-MM');

export const initialData: AppData = {
  id: 'local-user',
  months: {
    [monthId]: {
      id: monthId,
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      childSupport: {
        amount: 500,
        paidBy: 'Parent 2',
        status: 'Unpaid',
      },
      expenseSplit: {
        'Parent 1': 50,
        'Parent 2': 50,
      },
      medicalExpenseSplit: {
        'Parent 1': 60,
        'Parent 2': 40,
      },
      parentNames: {
        'Parent 1': 'Jane Doe',
        'Parent 2': 'John Smith',
      },
      expenses: [
        {
          id: '1',
          date: new Date().toISOString(),
          description: 'School Books',
          amount: 75.5,
          paidBy: 'Parent 1',
          category: 'Education',
          status: 'Unpaid',
          year: today.getFullYear(),
          month: today.getMonth() + 1,
        },
        {
          id: '2',
          date: new Date().toISOString(),
          description: 'Doctor Visit',
          amount: 150,
          paidBy: 'Parent 2',
          category: 'Medical',
          status: 'Unpaid',
          year: today.getFullYear(),
          month: today.getMonth() + 1,
        },
      ],
    },
  },
};
