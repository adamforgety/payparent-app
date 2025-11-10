
'use client';

import { format, startOfMonth } from 'date-fns';
import { Sheet } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { ChildSupport, Expense, ExpenseSplit, MedicalExpenseSplit, ParentNames, Parent } from '@/lib/types';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { DropdownMenuItem } from './ui/dropdown-menu';

interface ExportButtonProps {
  expenses: Expense[];
  childSupport: ChildSupport;
  currentDate: Date;
  parentNames: ParentNames;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
  asChild?: boolean;
}

export function ExportButton({
  expenses,
  childSupport,
  currentDate,
  parentNames,
  expenseSplit,
  medicalExpenseSplit,
  asChild = false,
}: ExportButtonProps) {
  const getParentShare = (item: Expense | (typeof childSupportItem), parent: Parent): number => {
    if (item.category === 'Child Support') {
      const csItem = item as typeof childSupportItem;
      return csItem.paidBy === parent ? csItem.amount : 0;
    }

    const expense = item as Expense;
    if (expense.category === 'Reimbursement' || expense.category === 'Credit') {
      return expense.paidBy === parent ? 0 : expense.amount;
    }

    const split =
      expense.category === 'Medical' || expense.category === 'Child Care'
        ? medicalExpenseSplit
        : expenseSplit;

    return expense.amount * (split[parent] / 100);
  };
  
  const childSupportItem =
    childSupport.amount > 0 && childSupport.paidBy !== 'None'
      ? {
          id: 'child-support',
          date: startOfMonth(currentDate).toISOString(),
          description: 'Child Support',
          amount: childSupport.amount,
          paidBy: childSupport.paidBy,
          category: 'Child Support' as const,
          status: childSupport.status,
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1,
        }
      : null;

  const handleExport = () => {
    const allItems: (Expense | (typeof childSupportItem))[] = [
      ...(childSupportItem ? [childSupportItem] : []),
      ...expenses,
    ];

    const dataToExport = allItems.map((item) => {
      const p1Share = getParentShare(item, 'Parent 1');
      const p2Share = getParentShare(item, 'Parent 2');

      return {
        Date: format(new Date(item.date), 'yyyy-MM-dd'),
        Description: item.description,
        Category: item.category,
        'Initial Payer': item.paidBy === 'None' ? 'None' : parentNames[item.paidBy as Parent],
        'Initial Amount': item.amount,
        [`${parentNames['Parent 1']}'s Share`]: p1Share.toFixed(2),
        [`${parentNames['Parent 2']}'s Share`]: p2Share.toFixed(2),
        Status: item.status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    XLSX.writeFile(
      workbook,
      `transactions-${format(currentDate, 'MMMM-yyyy')}.xlsx`
    );
  };

  const isDisabled = expenses.length === 0 && (childSupport.amount === 0);

  if (asChild) {
    return (
      <DropdownMenuItem onSelect={handleExport} disabled={isDisabled}>
        <Sheet className="mr-2 h-4 w-4" />
        Export to Excel
      </DropdownMenuItem>
    );
  }

  return (
      <Button
        variant="outline"
        onClick={handleExport}
        disabled={isDisabled}
        aria-label="Export to Excel"
      >
        <Sheet className="h-4 w-4 mr-2" />
        Export
      </Button>
  );
}
