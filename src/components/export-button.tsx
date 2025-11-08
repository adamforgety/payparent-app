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
  const handleExport = () => {
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

    const allItems: (Expense | (typeof childSupportItem))[] = [
      ...(childSupportItem ? [childSupportItem] : []),
      ...expenses,
    ];

    const dataToExport = allItems.map((item) => {
      let parent1Owes = 0;
      let parent2Owes = 0;

      if (item.category === 'Child Support') {
        if (item.paidBy === 'Parent 1') {
          parent1Owes = item.amount;
        } else if (item.paidBy === 'Parent 2') {
          parent2Owes = item.amount;
        }
      } else {
        let p1Share = 0;
        let p2Share = 0;

        if (item.category === 'Reimbursement' || item.category === 'Credit') {
          p1Share = item.paidBy === 'Parent 1' ? 0 : item.amount;
          p2Share = item.paidBy === 'Parent 2' ? 0 : item.amount;
        } else {
          const split = item.category === 'Medical' || item.category === 'Child Care' ? medicalExpenseSplit : expenseSplit;
          p1Share = item.amount * (split['Parent 1'] / 100);
          p2Share = item.amount * (split['Parent 2'] / 100);
        }

        const p1Paid = item.paidBy === 'Parent 1' ? item.amount : 0;
        const p2Paid = item.paidBy === 'Parent 2' ? item.amount : 0;

        parent1Owes = p1Share - p1Paid;
        parent2Owes = p2Share - p2Paid;
      }

      return {
        Date: format(new Date(item.date), 'yyyy-MM-dd'),
        Description: item.description,
        Category: item.category,
        'Initially Paid By': item.paidBy === 'None' ? 'None' : parentNames[item.paidBy],
        Amount: item.amount,
        [`${parentNames['Parent 1']} Owes`]: parent1Owes.toFixed(2),
        [`${parentNames['Parent 2']} Owes`]: parent2Owes.toFixed(2),
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
