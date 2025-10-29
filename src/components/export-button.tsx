'use client';

import { format, startOfMonth } from 'date-fns';
import { Sheet } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { ChildSupport, Expense, ParentNames } from '@/lib/types';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { DropdownMenuItem } from './ui/dropdown-menu';

interface ExportButtonProps {
  expenses: Expense[];
  childSupport: ChildSupport;
  currentDate: Date;
  parentNames: ParentNames;
  asChild?: boolean;
}

export function ExportButton({
  expenses,
  childSupport,
  currentDate,
  parentNames,
  asChild = false,
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
  
  const isDisabled = expenses.length === 0 && childSupport.amount === 0;

  if (asChild) {
    return (
      <DropdownMenuItem onSelect={handleExport} disabled={isDisabled}>
        <Sheet className="mr-2 h-4 w-4" />
        Export to Excel
      </DropdownMenuItem>
    );
  }

  return (
     <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleExport}
            disabled={isDisabled}
            aria-label="Export to Excel"
          >
            <Sheet className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export to Excel</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
