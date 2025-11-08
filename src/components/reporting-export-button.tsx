

'use client';

import { format } from 'date-fns';
import { Sheet } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { ParentNames, Parent } from '@/lib/types';
import { Button } from './ui/button';
import type { Transaction } from './reporting-page';

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
  
  const getPaidAmount = (transaction: Transaction, parent: Parent) => {
      if (transaction.status !== 'Settled') return 0;
  
      if (transaction.category === 'Child Support') {
          return transaction.paidBy === parent ? transaction.amount : 0;
      }
  
      const expense = transaction as any; // Cast to access medical/expense splits
      if (expense.category === 'Reimbursement') {
        return expense.paidBy === parent ? -expense.amount : expense.amount;
      }

      const split = expense.category === 'Medical' || expense.category === 'Child Care' ? expense.medicalExpenseSplit : expense.expenseSplit;
      return expense.amount * (split[parent] / 100);
  };

  const handleExport = () => {
    const dataToExport = transactions
      .map((item) => {
        const parent1Paid = getPaidAmount(item, 'Parent 1');
        const parent2Paid = getPaidAmount(item, 'Parent 2');

        return {
          Date: format(new Date(item.date), 'yyyy-MM-dd'),
          Description: item.description,
          Category: item.category,
          'Initially Paid By': item.paidBy === 'None' ? 'None' : parentNames[item.paidBy as Parent],
          'Initial Amount': item.amount,
          [`${parentNames['Parent 1']} Settlement`]: parent1Paid.toFixed(2),
          [`${parentNames['Parent 2']} Settlement`]: parent2Paid.toFixed(2),
          Status: item.status,
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
