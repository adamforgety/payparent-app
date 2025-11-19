

'use client';

import { format } from 'date-fns';
import { Sheet } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { ChildSupport, Expense, CustomSplit, ParentNames, Parent } from '@/lib/types';
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
  
  const getParentShare = (transaction: Transaction, parent: Parent): number => {
    if (transaction.category === 'Child Support') {
        return transaction.paidBy === parent ? transaction.amount : 0;
    }

    const expense = transaction as (Expense & { customSplits: CustomSplit[] });
    if (expense.category === 'Reimbursement') {
        return expense.paidBy === parent ? 0 : expense.amount;
    }

    const applicableSplit = expense.customSplits.find(s => s.categories.includes(expense.category));
    const parentSplitPercent = applicableSplit ? applicableSplit.split[parent] / 100 : 0.5;

    return expense.amount * parentSplitPercent;
  };


  const handleExport = () => {
    const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const dataToExport = sortedTransactions
      .map((item) => {
        const parent1Share = getParentShare(item, 'Parent 1');
        const parent2Share = getParentShare(item, 'Parent 2');

        return {
          Date: format(new Date(item.date), 'yyyy-MM-dd'),
          Description: item.description,
          Category: item.category,
          'Initial Payer': item.paidBy === 'None' ? 'None' : parentNames[item.paidBy as Parent],
          'Initial Amount': item.amount,
          [`${parentNames['Parent 1']}'s Share`]: parent1Share,
          [`${parentNames['Parent 2']}'s Share`]: parent2Share,
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
