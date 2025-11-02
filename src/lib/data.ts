import type { AppData } from './types';
import { format } from 'date-fns';

const today = new Date();
const monthId = format(today, 'yyyy-MM');

// Note: The top-level `id` and `username` properties on AppData are deprecated
// and will be removed in a future version. They are managed within the UserDoc.
export const initialData: Omit<AppData, 'id' | 'username'> = {
  username: 'default_user', // This will be replaced by the actual username at creation.
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
