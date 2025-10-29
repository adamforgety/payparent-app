'use client';

import { format, startOfMonth } from 'date-fns';
import { Sheet } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { ChildSupport, Expense, ParentNames } from '@/lib/types';
import { Button } from './ui/button';

interface ExportButtonProps {
  expenses: Expense[];
  childSupport: ChildSupport;
  currentDate: Date;
  parentNames: ParentNames;
}

export function ExportButton({
  expenses,
  childSupport,
  currentDate,
  parentNames,
}: ExportButtonProps) {
  const handleExport = () => {
    const childSupportAsExpense: Omit<Expense, 'id' | 'status'> | null =
      childSupport.amount > 0 && childSupport.paidBy !== 'None'
        ? {
            date: startOfMonth(currentDate).toISOString(),
            description: 'Child Support',
            amount: childSupport.amount,
            paidBy: childSupport.paidBy,
            category: 'Child Support',
          }
        : null;
        
    const allItems = [...(childSupportAsExpense ? [childSupportAsExpense] : []), ...expenses];


    const dataToExport = allItems.map((item) => ({
      Date: format(new Date(item.date), 'yyyy-MM-dd'),
      Description: item.description,
      Category: item.category,
      'Paid By': item.paidBy === 'None' ? 'None' : parentNames[item.paidBy],
      Amount: item.amount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    XLSX.writeFile(
      workbook,
      `transactions-${format(currentDate, 'MMMM-yyyy')}.xlsx`
    );
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={expenses.length === 0 && childSupport.amount === 0}
    >
      <Sheet className="mr-2 h-4 w-4" />
      Export to Excel
    </Button>
  );
}
