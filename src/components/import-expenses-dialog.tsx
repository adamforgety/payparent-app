'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';
import { Upload, Download, ArrowLeft } from 'lucide-react';

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

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

type ParsedExpense = Omit<Expense, 'id' | 'year' | 'month'>;

type FailedImport = {
    rowNumber: number;
    data: {
        date: string;
        description: string;
        category: string;
        paidBy: string;
        amount: string;
    };
    errors: {
        date?: string;
        description?: string;
        category?: string;
        paidBy?: string;
        amount?: string;
        general?: string;
    };
};


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
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [successfulImports, setSuccessfulImports] = useState<ParsedExpense[]>([]);
  const [failedImports, setFailedImports] = useState<FailedImport[]>([]);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(importSchema),
  });

  const resetState = () => {
    form.reset();
    setStep('upload');
    setSuccessfulImports([]);
    setFailedImports([]);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    setIsOpen(open);
  }
  
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

  const onFileParse = async (values: FormValues) => {
    const file = values.file[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        const parent1NameLower = parentNames['Parent 1'].toLowerCase();
        const parent2NameLower = parentNames['Parent 2'].toLowerCase();
        
        const successes: ParsedExpense[] = [];
        const failures: FailedImport[] = [];
        const seen = new Set<string>();


        jsonData.forEach((row, index) => {
            const normalizedRow: {[key: string]: any} = {};
            for (const key in row) {
              normalizedRow[key.toLowerCase().replace(/[^a-z0-9]/gi, '')] = row[key];
            }

            const { date, description, category, paidby, amount } = normalizedRow;
            const errors: FailedImport['errors'] = {};

            // --- Data Validation ---
            if (!date) errors.date = 'Missing';
            if (!description) errors.description = 'Missing';
            if (!amount) errors.amount = 'Missing';
            if (!paidby) errors.paidBy = 'Missing';
            
            let parsedDate = new Date(date);
            if (date) {
                if (typeof date === 'number') {
                    // Excel date serial number
                    parsedDate = new Date(Date.UTC(0, 0, date - 1));
                }
                if (isNaN(parsedDate.getTime())) {
                    errors.date = 'Invalid Date';
                }
            }

            let amountAsString = String(amount || '').trim();
            if (amountAsString.startsWith('$')) {
              amountAsString = amountAsString.substring(1).trim();
            }
            if (amount && !/^\s*(\d+(\.\d{1,2})?)\s*$/.test(amountAsString)) {
               errors.amount = 'Invalid Number';
            }
            
            let paidByParent: Parent | null = null;
            if (paidby) {
                if (typeof paidby === 'string') {
                    const paidByLower = paidby.toLowerCase();
                    if (paidByLower === parent1NameLower) {
                        paidByParent = 'Parent 1';
                    } else if (paidByLower === parent2NameLower) {
                        paidByParent = 'Parent 2';
                    }
                }
                if (!paidByParent) {
                    errors.paidBy = 'Unrecognized Payer';
                }
            }
            
            if (Object.keys(errors).length > 0) {
              failures.push({
                rowNumber: index + 2,
                data: {
                  date: date ?? '',
                  description: description ?? '',
                  category: category ?? '',
                  paidBy: paidby ?? '',
                  amount: String(amount ?? ''),
                },
                errors,
              });
              return;
            }
            
            const parsedAmount = parseFloat(amountAsString);
            let expenseCategory: ExpenseCategory = 'Other';
            if (category) {
              const matchedCategory = ALL_CATEGORIES.find(c => c.toLowerCase() === String(category).toLowerCase());
              if (matchedCategory) {
                expenseCategory = matchedCategory;
              }
            }

            const expenseObject: ParsedExpense = {
              date: parsedDate.toISOString(),
              description: String(description),
              amount: parsedAmount,
              paidBy: paidByParent!,
              category: expenseCategory,
              status: 'Unsettled',
              receiptUrl: null,
              receiptFilename: null,
            };

            const uniqueKey = `${expenseObject.date}-${expenseObject.description}-${expenseObject.amount}-${expenseObject.paidBy}`;
            if (seen.has(uniqueKey)) {
                 failures.push({
                    rowNumber: index + 2,
                    data: {
                        date: date,
                        description: description,
                        category: category,
                        paidBy: paidby,
                        amount: String(amount),
                    },
                    errors: { general: 'Duplicate row in file' },
                });
                return;
            }

            seen.add(uniqueKey);
            successes.push(expenseObject);
          });
          
        setSuccessfulImports(successes);
        setFailedImports(failures);
        setStep('preview');

      } catch (error) {
        console.error('Import error:', error);
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'Could not read or process the file. Please ensure it is a valid Excel file.',
        });
        resetState();
      }
    };

    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmImport = () => {
    if (successfulImports.length > 0) {
      onImport(successfulImports);
    }

    if (failedImports.length > 0) {
        const totalFailed = failedImports.length;
        toast({
          variant: successfulImports.length > 0 ? 'default' : 'destructive',
          title: `Import Complete: ${successfulImports.length} added, ${totalFailed} failed.`,
          description: `Review the skipped rows in the preview.`,
        });
      } else if (successfulImports.length > 0) {
         toast({
          title: 'Import Successful',
          description: `${successfulImports.length} expenses were added.`,
        });
      } else {
          toast({
            variant: 'destructive',
            title: 'Import Failed',
            description: 'No valid expenses found in the file. Please check the format and data.',
          });
      }
    
    handleOpenChange(false);
  }
  
  const ErrorDisplay = ({ error, value }: { error?: string; value: string }) => {
    if (!error) return <div>{value}</div>;
    return (
      <div className="text-destructive font-medium">
        <div className="line-through text-muted-foreground">{value || '""'}</div>
        <div>
          <Badge variant="destructive">{error}</Badge>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' ? 'Import Expenses from Excel' : 'Preview Import'}
          </DialogTitle>
          {step === 'upload' && (
            <>
              <DialogDescription className="space-y-1">
                <span>Upload an Excel file with columns for: <code className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Date</code>, <code className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Description</code>, <code className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Category</code>, <code className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Paid By</code>, and <code className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Amount</code>.</span>
                <span>The <code className="font-mono text-foreground bg-muted p-1 rounded-sm text-xs mx-1">Paid By</code> name must match either "{parentNames['Parent 1']}" or "{parentNames['Parent 2']}".</span>
                <span>The system calculates each parent's share automatically.</span>
              </DialogDescription>
              <div className="pt-2">
                <Button variant="link" onClick={handleDownloadTemplate} className="p-0 h-auto font-normal">
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </>
          )}
          {step === 'preview' && (
             <DialogDescription>
              Review the expenses found in your file. Click "Confirm Import" to add them to your ledger.
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'upload' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFileParse)} className="space-y-4 pt-4">
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
                <Button type="submit">Preview Import</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {step === 'preview' && (
          <div className="flex-grow overflow-y-auto pr-6 -mr-6">
            {successfulImports.length > 0 && (
                <div className="mb-6">
                    <h3 className="font-semibold mb-2 text-green-600">{successfulImports.length} expenses will be imported:</h3>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Paid By</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {successfulImports.map((exp, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{format(new Date(exp.date), 'MMM d, yyyy')}</TableCell>
                                        <TableCell>{exp.description}</TableCell>
                                        <TableCell><Badge variant="outline">{exp.category}</Badge></TableCell>
                                        <TableCell>{parentNames[exp.paidBy]}</TableCell>
                                        <TableCell className="text-right">${exp.amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
             {failedImports.length > 0 && (
                <div className="mb-6">
                    <h3 className="font-semibold mb-2 text-destructive">{failedImports.length} rows will be skipped:</h3>
                     <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Row</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Paid By</TableHead>
                                    <TableHead>Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedImports.map((fail, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-mono">
                                            {fail.rowNumber}
                                            {fail.errors.general && (
                                                <div className='mt-1'><Badge variant="destructive">{fail.errors.general}</Badge></div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <ErrorDisplay error={fail.errors.date} value={String(fail.data.date)} />
                                        </TableCell>
                                        <TableCell>
                                            <ErrorDisplay error={fail.errors.description} value={String(fail.data.description)} />
                                        </TableCell>
                                        <TableCell>
                                            <ErrorDisplay error={fail.errors.category} value={String(fail.data.category)} />
                                        </TableCell>
                                        <TableCell>
                                            <ErrorDisplay error={fail.errors.paidBy} value={String(fail.data.paidBy)} />
                                        </TableCell>
                                        <TableCell>
                                            <ErrorDisplay error={fail.errors.amount} value={String(fail.data.amount)} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setStep('upload')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
                <Button onClick={handleConfirmImport} disabled={successfulImports.length === 0}>
                  Confirm Import ({successfulImports.length})
                </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
