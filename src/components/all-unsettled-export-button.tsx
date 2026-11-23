'use client';

import { format, parse } from 'date-fns';
import { Sheet } from 'lucide-react';
import * as XLSX from 'xlsx';

import type { Expense, Parent, CustomSplit, ParentNames } from '@/lib/types';
import { Button } from './ui/button';
import { getExpenseParentShare } from '@/lib/splits';

type UnsettledItem = {
  id: string;
  monthId: string;
  date: string;
  description: string;
  amount: number;
  paidBy: Parent | 'None';
  category: 'Child Support' | Expense['category'];
  type: 'expense' | 'child_support';
  parentNames: ParentNames;
  customSplits: CustomSplit[];
};

interface AllUnsettledExportButtonProps {
  items: UnsettledItem[];
  periodLabel: string;
  parentNames: ParentNames;
}

export function AllUnsettledExportButton({
  items,
  periodLabel,
  parentNames,
}: AllUnsettledExportButtonProps) {
  const getParentShare = (item: UnsettledItem, parent: Parent): number => {
    if (item.type === 'child_support') {
      return item.paidBy === parent ? item.amount : 0;
    }
    return getExpenseParentShare(item as Expense, parent, item.customSplits);
  };

  const handleExport = () => {
    const sortedItems = [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const dataToExport = sortedItems.map((item) => {
      const p1Share = getParentShare(item, 'Parent 1');
      const p2Share = getParentShare(item, 'Parent 2');

      return {
        'Month': format(parse(item.monthId, 'yyyy-MM', new Date()), 'MMMM yyyy'),
        'Date': format(new Date(item.date), 'yyyy-MM-dd'),
        'Description': item.description,
        'Category': item.category,
        'Initial Payer': item.paidBy === 'None' ? 'None' : parentNames[item.paidBy as Parent],
        'Initial Amount': item.amount,
        [`${parentNames['Parent 1']}'s Share`]: p1Share,
        [`${parentNames['Parent 2']}'s Share`]: p2Share,
        'Status': 'Unsettled',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Unsettled Items');
    XLSX.writeFile(
      workbook,
      `unsettled-items-report-${periodLabel}.xlsx`
    );
  };

  const isDisabled = items.length === 0;

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isDisabled}
      aria-label="Export to Excel"
      className="w-full sm:w-auto"
    >
      <Sheet className="h-4 w-4 mr-2" />
      Export to Excel
    </Button>
  );
}
