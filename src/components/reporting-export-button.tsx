'use client';

import { format } from 'date-fns';
import { Sheet } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { Expense, ParentNames, ChildSupport, ExpenseSplit, MedicalExpenseSplit, Parent } from '@/lib/types';
import { Button } from './ui/button';

type EnrichedExpense = Expense & { 
  parentNames: ParentNames;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
};

type EnrichedChildSupport = ChildSupport & {
  id: string;
  date: string;
  description: string;
  category: 'Child Support';
  parentNames: ParentNames;
}

type Transaction = EnrichedExpense | EnrichedChildSupport;


interface ReportingExportButtonProps {
  transactions: Transaction[];
  periodLabel: string;
  parentNames: ParentNames;
}

export function ReportingExportButton({
  transactions,
  periodLabel,
  parentNames
}: ReportingExportButtonProps) {
  const handleExport = () => {
    const dataToExport = transactions
      .map((item) => {
        let parent1Share = 0;
        let parent2Share = 0;

        if (item.category === 'Child Support') {
          if (item.paidBy === 'Parent 1') {
            parent1Share = item.amount;
          } else if (item.paidBy === 'Parent 2') {
            parent2Share = item.amount;
          }
        } else {
          const expense = item as EnrichedExpense;
          if (expense.category === 'Reimbursement') {
            if (expense.paidBy === 'Parent 1') {
              parent2Share = expense.amount;
            } else {
              parent1Share = expense.amount;
            }
          } else {
            const split = expense.category === 'Medical' || expense.category === 'Child Care' ? expense.medicalExpenseSplit : expense.expenseSplit;
            parent1Share = expense.amount * (split['Parent 1'] / 100);
            parent2Share = expense.amount * (split['Parent 2'] / 100);
          }
        }

        return {
          Date: format(new Date(item.date), 'yyyy-MM-dd'),
          Description: item.description,
          Category: item.category,
          'Paid By': item.paidBy === 'None' ? 'None' : parentNames[item.paidBy as Parent],
          Amount: item.amount,
          [`${parentNames['Parent 1']}'s Share`]: parent1Share.toFixed(2),
          [`${parentNames['Parent 2']}'s Share`]: parent2Share.toFixed(2),
        };
      });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    XLSX.writeFile(
      workbook,
      `transactions-report-${periodLabel}.xlsx`
    );
  };

  const isDisabled = transactions.length === 0;

  return (
      <Button
        variant="outline"
        onClick={handleExport}
        disabled={isDisabled}
        aria-label="Export to Excel"
      >
        <Sheet className="h-4 w-4 mr-2" />
        Export to Excel
      </Button>
  );
}
