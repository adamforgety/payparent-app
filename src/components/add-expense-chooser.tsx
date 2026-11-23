
'use client';

import { useState } from 'react';
import { Plus, Upload, Banknote } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AddExpenseDialog } from '@/components/add-expense-dialog';
import { ImportExpensesDialog } from '@/components/import-expenses-dialog';
import { format } from 'date-fns';
import type { AppData, ParentNames } from '@/lib/types';
import { useAppContext } from '@/context/app-context';

interface AddExpenseChooserProps {
  parentNames: ParentNames;
  currentDate: Date;
  appData: AppData;
}

export function AddExpenseChooser({ parentNames, currentDate, appData }: AddExpenseChooserProps) {
  const { addExpense, addImportedExpenses } = useAppContext();
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isSingleOpen, setIsSingleOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const openDialog = (setter: (isOpen: boolean) => void) => {
    setIsChooserOpen(false);
    setter(true);
  };
  
  return (
    <>
      <Dialog open={isChooserOpen} onOpenChange={setIsChooserOpen}>
        <DialogTrigger asChild>
          <button className="bottom-nav-add-button">
            <Plus className="h-6 w-6" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an Expense</DialogTitle>
            <DialogDescription>How would you like to add an expense?</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 pt-4">
            <Button variant="outline" onClick={() => openDialog(setIsSingleOpen)} className="h-20 flex-col gap-2">
              <Banknote className="h-6 w-6 text-primary" />
              <span>Add Single Expense</span>
            </Button>
            <Button variant="outline" onClick={() => openDialog(setIsImportOpen)} className="h-20 flex-col gap-2">
              <Upload className="h-6 w-6 text-primary" />
              <span>Bulk Import from File</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <AddExpenseDialog
        open={isSingleOpen}
        onOpenChange={setIsSingleOpen}
        onAddExpense={addExpense}
        parentNames={parentNames}
        currentDate={currentDate}
        customSplits={appData?.months?.[format(currentDate, 'yyyy-MM')]?.customSplits}
      />

      <ImportExpensesDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={addImportedExpenses}
        parentNames={parentNames}
        appData={appData}
      />
    </>
  );
}
