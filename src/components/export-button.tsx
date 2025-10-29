'use client';

import { format } from 'date-fns';
import { Sheet } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { Expense } from '@/lib/types';
import { Button } from './ui/button';

interface ExportButtonProps {
  expenses: Expense[];
  currentDate: Date;
}

export function ExportButton({ expenses, currentDate }: ExportButtonProps) {
  const handleExport = () => {
    const dataToExport = expenses.map((expense) => ({
      Date: format(new Date(expense.date), 'yyyy-MM-dd'),
      Description: expense.description,
      Category: expense.category,
      'Paid By': expense.paidBy,
      Amount: expense.amount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
    XLSX.writeFile(
      workbook,
      `expenses-${format(currentDate, 'MMMM-yyyy')}.xlsx`
    );
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={expenses.length === 0}>
      <Sheet className="mr-2 h-4 w-4" />
      Export to Excel
    </Button>
  );
}
