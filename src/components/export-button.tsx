
'use client';

import { format, startOfMonth } from 'date-fns';
import { Sheet } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { ChildSupport, Expense, CustomSplit, ParentNames, Parent } from '@/lib/types';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { DropdownMenuItem } from './ui/dropdown-menu';

interface ExportButtonProps {
  expenses: Expense[];
  childSupport: ChildSupport;
  currentDate: Date;
  parentNames: ParentNames;
  customSplits: CustomSplit[];
  className?: string;
  asChild?: boolean;
}

export function ExportButton({
  expenses,
  childSupport,
  currentDate,
  parentNames,
  customSplits,
  className,
  asChild = false,
}: ExportButtonProps) {
  const getParentShare = (item: Expense | (typeof childSupportItem), parent: Parent): number => {
    if (item.category === 'Child Support') {
      return 0; // Child support is a direct transfer, not a shared cost.
    }

    const expense = item as Expense;
    if (expense.category === 'Reimbursement') {
      return expense.paidBy === parent ? 0 : expense.amount;
    }

    const applicableSplit = customSplits.find(s => s.categories.includes(expense.category));
    const parentSplitPercent = applicableSplit ? applicableSplit.split[parent] / 100 : 0.5;

    return expense.amount * parentSplitPercent;
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
        [`${parentNames['Parent 1']}'s Share`]: p1Share,
        [`${parentNames['Parent 2']}'s Share`]: p2Share,
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
        className={className}
      >
        <Sheet className="h-4 w-4 mr-2" />
        Export
      </Button>
  );
}
