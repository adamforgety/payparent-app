import { AppData } from './types';
import { format } from 'date-fns';

const today = new Date();

export const initialData: AppData = {
  [format(today, 'yyyy-MM')]: {
    childSupport: {
      amount: 200,
      paidBy: 'Parent 1',
      status: 'Unpaid',
    },
    expenseSplit: {
      'Parent 1': 50,
      'Parent 2': 50,
    },
    expenses: [
      {
        id: 'dummy-expense-1',
        date: new Date().toISOString(),
        description: 'Soccer registration',
        amount: 150,
        paidBy: 'Parent 2',
        status: 'Unpaid',
        category: 'Activities'
      },
      {
        id: 'dummy-expense-2',
        date: new Date().toISOString(),
        description: 'School supplies',
        amount: 75,
        paidBy: 'Parent 1',
        status: 'Unpaid',
        category: 'Education'
      }
    ],
    parentNames: {
      'Parent 1': 'Alex',
      'Parent 2': 'Jordan',
    },
  },
};
