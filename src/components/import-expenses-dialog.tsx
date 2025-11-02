'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';
import { Upload, Download } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Expense, Parent, ExpenseCategory, ParentNames } from '@/lib/types';
import { format } from 'date-fns';

const ACCEPTED_FILE_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

const importSchema = z.object({
  file: z
    .any()
    .refine((files) => files?.length === 1, 'An Excel file is required.')
    .refine(
      (files) => ACCEPTED_FILE_TYPES.includes(files?.[0]?.type),
      '.xlsx and .xls files are accepted.'
    ),
});

type FormValues = z.infer<typeof importSchema>;

interface ImportExpensesDialogProps {
  onImport: (expenses: Omit<Expense, 'id' | 'year' | 'month'>[]) => void;
  parentNames: ParentNames;
}

const ALL_CATEGORIES: ExpenseCategory[] = [
  'Medical',
  'Education',
  'Child Care',
  'Activities',
  'Clothing',
  'Food',
  'Reimbursement',
  'Other',
];

export function ImportExpensesDialog({ onImport, parentNames }: ImportExpensesDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(importSchema),
  });
  
  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        Date: format(new Date(), 'yyyy-MM-dd'),
        Description: 'Sample: School Books',
        Category: 'Education',
        'Paid By': parentNames['Parent 1'],
        Amount: 75.50,
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
    XLSX.writeFile(workbook, 'Expense_Import_Template.xlsx');
  };

  const onSubmit = async (values: FormValues) => {
    const file = values.file[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const parent1NameLower = parentNames['Parent 1'].toLowerCase();
        const parent2NameLower = parentNames['Parent 2'].toLowerCase();

        const importedExpenses: Omit<Expense, 'id' | 'year' | 'month'>[] = jsonData
          .map((row) => {
            // Normalize header keys (lowercase and remove special characters)
            const normalizedRow: {[key: string]: any} = {};
            for (const key in row) {
              normalizedRow[key.toLowerCase().replace(/[^a-z0-9]/gi, '')] = row[key];
            }

            const { date, description, category, paidby, amount } = normalizedRow;

            // --- Data Validation ---
            if (!date || !description || !amount) {
              return null; // Skip row if essential data is missing
            }

            let parsedDate = new Date(date);
            // XLSX can parse dates as numbers (days since 1900), convert if needed
            if (typeof date === 'number') {
                parsedDate = new Date(Date.UTC(0, 0, date - 1));
            }
            if (isNaN(parsedDate.getTime())) return null;

            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount) || parsedAmount <= 0) return null;

            let paidByParent: Parent | null = null;
            if (typeof paidby === 'string') {
              const paidByLower = paidby.toLowerCase();
              if (paidByLower === parent1NameLower) {
                paidByParent = 'Parent 1';
              } else if (paidByLower === parent2NameLower) {
                paidByParent = 'Parent 2';
              }
            }
            if (!paidByParent) return null; // Skip if payer doesn't match

            let expenseCategory: ExpenseCategory = 'Other';
            if (category && ALL_CATEGORIES.some(c => c.toLowerCase() === category.toLowerCase())) {
                expenseCategory = ALL_CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase())!;
            }
            
            return {
              date: parsedDate.toISOString(),
              description: String(description),
              amount: parsedAmount,
              paidBy: paidByParent,
              category: expenseCategory,
              status: 'Unsettled',
              receiptUrl: null,
              receiptFilename: null,
            };
          })
          .filter((exp): exp is Omit<Expense, 'id'|'year'|'month'> => exp !== null);
          
        if (importedExpenses.length > 0) {
            onImport(importedExpenses);
        } else {
            toast({
                variant: 'destructive',
                title: 'Import Failed',
                description: 'No valid expenses found in the file. Please check the format and data.',
            });
        }

        form.reset();
        setIsOpen(false);
      } catch (error) {
        console.error('Import error:', error);
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'Could not read or process the file. Please ensure it is a valid Excel file.',
        });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Expenses from Excel</DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx or .xls). The file must have columns for:
            <span className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Date</span>,
            <span className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Description</span>,
            <span className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Category</span>,
            <span className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Paid By</span>, and
            <span className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Amount</span>.
          </DialogDescription>
          <div className="text-sm text-muted-foreground pt-2">
            <p className='mb-2'>The <span className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Paid By</span> column must match one of the current parent names: "{parentNames['Parent 1']}" or "{parentNames['Parent 2']}". Invalid rows will be skipped.</p>
            <p className="mb-2">You only need to add the total amount paid; the system will automatically calculate the appropriate percentage distribution based on your settings.</p>
             <Button variant="link" onClick={handleDownloadTemplate} className="p-0 h-auto font-normal">
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Excel File</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept={ACCEPTED_FILE_TYPES.join(',')}
                      onChange={(e) => field.onChange(e.target.files)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Import Expenses</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
