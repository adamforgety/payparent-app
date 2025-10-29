import { AppData } from './types';
import { format, subMonths } from 'date-fns';

const today = new Date();
const lastMonth = subMonths(today, 1);
const twoMonthsAgo = subMonths(today, 2);

export const initialData: AppData = {
  [format(today, 'yyyy-MM')]: {
    childSupport: {
      amount: 500,
      paidBy: 'Parent 2',
    },
    expenseSplit: {
      'Parent 1': 50,
      'Parent 2': 50,
    },
    expenses: [
      { id: 'exp1', date: new Date().toISOString(), description: 'School Uniform', amount: 150.75, paidBy: 'Parent 1', category: 'Clothing' },
      { id: 'exp2', date: new Date().toISOString(), description: 'Soccer Club Fees', amount: 75, paidBy: 'Parent 2', category: 'Activities' },
      { id: 'exp3', date: new Date().toISOString(), description: 'Groceries (Week 1)', amount: 220.50, paidBy: 'Parent 1', category: 'Food' },
      { id: 'exp4', date: new Date().toISOString(), description: 'Dentist Appointment', amount: 125, paidBy: 'Parent 2', category: 'Medical' },
    ],
  },
  [format(lastMonth, 'yyyy-MM')]: {
    childSupport: {
      amount: 500,
      paidBy: 'Parent 2',
    },
    expenseSplit: {
      'Parent 1': 60,
      'Parent 2': 40,
    },
    expenses: [
      { id: 'exp5', date: new Date(new Date(lastMonth).setDate(5)).toISOString(), description: 'Birthday Gift for Friend', amount: 25, paidBy: 'Parent 1', category: 'Other' },
      { id: 'exp6', date: new Date(new Date(lastMonth).setDate(15)).toISOString(), description: 'Field Trip to Museum', amount: 40, paidBy: 'Parent 1', category: 'Education' },
      { id: 'exp7', date: new Date(new Date(lastMonth).setDate(22)).toISOString(), description: 'New Shoes', amount: 65, paidBy: 'Parent 2', category: 'Clothing' },
    ],
  },
  [format(twoMonthsAgo, 'yyyy-MM')]: {
    childSupport: {
      amount: 450,
      paidBy: 'Parent 2',
    },
    expenseSplit: {
      'Parent 1': 50,
      'Parent 2': 50,
    },
    expenses: [
       { id: 'exp8', date: new Date(new Date(twoMonthsAgo).setDate(10)).toISOString(), description: 'Art Supplies', amount: 55.40, paidBy: 'Parent 1', category: 'Education' },
       { id: 'exp9', date: new Date(new Date(twoMonthsAgo).setDate(18)).toISOString(), description: 'Book Fair', amount: 32.00, paidBy: 'Parent 2', category: 'Education' },
    ]
  }
};
