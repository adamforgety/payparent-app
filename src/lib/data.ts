import { AppData } from './types';
import { format } from 'date-fns';

const today = new Date();

export const initialData: AppData = {
  [format(today, 'yyyy-MM')]: {
    childSupport: {
      amount: 0,
      paidBy: 'None',
      status: 'Unpaid',
    },
    expenseSplit: {
      'Parent 1': 50,
      'Parent 2': 50,
    },
    expenses: [],
    parentNames: {
      'Parent 1': 'Parent 1',
      'Parent 2': 'Parent 2',
    },
  },
};
