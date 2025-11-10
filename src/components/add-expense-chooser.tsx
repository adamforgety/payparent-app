'use client';

import { useState } from 'react';
import { Plus, Upload, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AddExpenseDialog } from '@/components/add-expense-dialog';
import { ImportExpensesDialog } from '@/components/import-expenses-dialog';
import type { AppData, Expense, ParentNames } from '@/lib/types';

interface AddExpenseChooserProps {
  onAddExpense: (expense: Omit<Expense, 'id' | 'year' | 'month'>) => void;
  onImportExpenses: (
    expenses: Omit<Expense, 'id' | 'year' | 'month'>[]
  ) => { [monthId: string]: number };
  parentNames: ParentNames;
  currentDate: Date;
  appData: AppData;
}

export function AddExpenseChooser({
  onAddExpense,
  onImportExpenses,
  parentNames,
  currentDate,
  appData,
}: AddExpenseChooserProps) {
  const [isChooserOpen, setIsChooserOpen] = useState(false);

  return (
    <Dialog open={isChooserOpen} onOpenChange={setIsChooserOpen}>
      <DialogTrigger asChild>
        <button className="bottom-nav-add-button">
          <Plus className="h-6 w-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Expenses</DialogTitle>
          <DialogDescription>
            Choose how you want to add new expenses.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          {/* This component will manage its own open state */}
          <AddExpenseDialog
            onAddExpense={onAddExpense}
            parentNames={parentNames}
            currentDate={currentDate}
          >
            <Button
              variant="outline"
              className="h-24 w-full flex-col gap-2"
              onClick={() => setIsChooserOpen(false)}
            >
              <FilePlus className="h-6 w-6" />
              <span>Add Single Expense</span>
            </Button>
          </AddExpenseDialog>

          {/* This component will also manage its own open state */}
          <ImportExpensesDialog
            onImport={onImportExpenses}
            parentNames={parentNames}
            appData={appData}
          >
            <Button
              variant="outline"
              className="h-24 w-full flex-col gap-2"
              onClick={() => setIsChooserOpen(false)}
            >
              <Upload className="h-6 w-6" />
              <span>Bulk Import</span>
            </Button>
          </ImportExpensesDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
