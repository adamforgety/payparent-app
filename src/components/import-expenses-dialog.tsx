'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';
import { Upload, Download, ArrowLeft, RefreshCw } from 'lucide-react';

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
import { format, parse, isValid } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './ui/tooltip';

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

type RowData = {
  date: string;
  description: string;
  category: string;
  paidBy: string;
  amount: string;
};

type RowErrors = {
    date?: string;
    description?: string;
    category?: string;
    paidBy?: string;
    amount?: string;
    general?: string;
};

type FailedImport = {
    rowNumber: number;
    data: RowData;
    errors: RowErrors;
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

// More flexible date parsing
function flexibleDateParse(dateString: string): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  // Handle Excel date serial numbers
  if (!isNaN(Number(dateString)) && Number(dateString) > 20000) {
    // This is a basic way to handle Excel's epoch (days since 1900-01-01, with a bug for leap years).
    // The `Date.UTC(0, 0, ...)` trick correctly converts the serial number.
    return new Date(Date.UTC(0, 0, Number(dateString) - 1));
  }

  const formats = [
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'M/d/yyyy',
    'MM-dd-yyyy',
    'M-d-yyyy',
    'yyyy/MM/dd',
  ];

  for (const fmt of formats) {
    const parsedDate = parse(dateString, fmt, new Date());
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }

  // Final attempt with native Date constructor for formats like ISO 8601
  const nativeParsed = new Date(dateString);
  if (isValid(nativeParsed)) {
      return nativeParsed;
  }

  return null;
}

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

  const validateRow = (rowData: RowData, parentNames: ParentNames): { errors: RowErrors, parsedExpense: ParsedExpense | null } => {
    const errors: RowErrors = {};
    const { date, description, amount, paidBy, category } = rowData;

    let parsedDate: Date | null = null;
    if (!date) {
      errors.date = 'Missing';
    } else {
      parsedDate = flexibleDateParse(date);
      if (!parsedDate) {
        errors.date = 'Invalid Date';
      }
    }

    if (!description) {
        errors.description = 'Missing';
    }
    
    let amountAsString = String(amount || '').trim();
    if (amountAsString.startsWith('$')) {
      amountAsString = amountAsString.substring(1).trim();
    }
    if (!amount) {
      errors.amount = 'Missing';
    } else if (!/^\s*(\d+(\.\d{1,2})?)\s*$/.test(amountAsString)) {
        errors.amount = 'Invalid Number';
    }

    let paidByParent: Parent | null = null;
    if (!paidBy) {
        errors.paidBy = 'Missing';
    } else if (typeof paidBy === 'string') {
        const paidByLower = paidBy.toLowerCase();
        if (paidByLower === parentNames['Parent 1'].toLowerCase()) {
            paidByParent = 'Parent 1';
        } else if (paidByLower === parentNames['Parent 2'].toLowerCase()) {
            paidByParent = 'Parent 2';
        } else {
            errors.paidBy = 'Unrecognized';
        }
    }

    let expenseCategory: ExpenseCategory = 'Other';
    if (category) {
        const matchedCategory = ALL_CATEGORIES.find(c => c.toLowerCase() === String(category).toLowerCase());
        if (matchedCategory) {
            expenseCategory = matchedCategory;
        }
    }

    if (Object.keys(errors).length > 0) {
        return { errors, parsedExpense: null };
    }

    const parsedAmount = parseFloat(amountAsString);
    const expenseObject: ParsedExpense = {
        date: parsedDate!.toISOString(),
        description: String(description),
        amount: parsedAmount,
        paidBy: paidByParent!,
        category: expenseCategory,
        status: 'Unsettled',
        receiptUrl: null,
        receiptFilename: null,
    };

    return { errors: {}, parsedExpense: expenseObject };
  }

  const onFileParse = async (values: FormValues) => {
    const file = values.file[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

        const successes: ParsedExpense[] = [];
        const failures: FailedImport[] = [];
        const seen = new Set<string>();

        jsonData.forEach((row, index) => {
            const normalizedRow: {[key: string]: any} = {};
            for (const key in row) {
              normalizedRow[key.toLowerCase().replace(/[^a-z0-9]/gi, '')] = row[key];
            }

            const rowData: RowData = {
              date: normalizedRow.date,
              description: normalizedRow.description,
              category: normalizedRow.category,
              paidBy: normalizedRow.paidby,
              amount: String(normalizedRow.amount),
            };

            const { errors, parsedExpense } = validateRow(rowData, parentNames);
            
            if (parsedExpense) {
              const uniqueKey = `${parsedExpense.date}-${parsedExpense.description}-${parsedExpense.amount}-${parsedExpense.paidBy}`;
              if (seen.has(uniqueKey)) {
                failures.push({
                    rowNumber: index + 2, data: rowData, errors: { general: 'Duplicate in file' },
                });
                return;
              }
              seen.add(uniqueKey);
              successes.push(parsedExpense);
            } else {
              failures.push({ rowNumber: index + 2, data: rowData, errors });
            }
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
          description: `Skipped rows can be corrected and re-tried.`,
        });
        if(successfulImports.length > 0) {
          handleOpenChange(false);
        }
      } else if (successfulImports.length > 0) {
         toast({
          title: 'Import Successful',
          description: `${successfulImports.length} expenses were added.`,
        });
         handleOpenChange(false);
      } else {
          toast({
            variant: 'destructive',
            title: 'Import Failed',
            description: 'No valid expenses found in the file. Please check the format and data.',
          });
      }
  }

  const handleFailedRowChange = (index: number, field: keyof RowData, value: string) => {
    const updatedFailedImports = [...failedImports];
    updatedFailedImports[index].data[field] = value;

    // Live re-validation
    const { errors } = validateRow(updatedFailedImports[index].data, parentNames);
    updatedFailedImports[index].errors = errors;
    
    setFailedImports(updatedFailedImports);
  };

  const handleRetryFailedRow = (index: number) => {
    const rowToRetry = failedImports[index];
    const { errors, parsedExpense } = validateRow(rowToRetry.data, parentNames);

    if (parsedExpense) {
      // Move from failed to successful
      setSuccessfulImports(prev => [...prev, parsedExpense]);
      setFailedImports(prev => prev.filter((_, i) => i !== index));
    } else {
      // Update errors
      const updatedFailedImports = [...failedImports];
      updatedFailedImports[index].errors = errors;
      setFailedImports(updatedFailedImports);
      toast({
        variant: 'destructive',
        title: 'Validation Failed',
        description: 'Please fix the errors before retrying.',
      });
    }
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
           <DialogDescription>
            {step === 'upload' ? 
              `Upload a file with columns for Date, Description, Category, Amount, and Paid By (name must match "${parentNames['Parent 1']}" or "${parentNames['Parent 2']}").`
             : 
              'Review the expenses found in your file. Correct any errors and click "Confirm Import" to add them to your ledger.'
            }
          </DialogDescription>
             {step === 'upload' && (
                <div className="pt-2">
                    <Button variant="link" onClick={handleDownloadTemplate} className="p-0 h-auto font-normal text-sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                    </Button>
                </div>
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
                                    <TableHead className="w-[150px]">Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-[150px]">Category</TableHead>
                                    <TableHead className="w-[180px]">Paid By</TableHead>
                                    <TableHead className="w-[130px]">Amount</TableHead>
                                    <TableHead className="w-[50px] text-right">Retry</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedImports.map((fail, i) => (
                                    <TableRow key={fail.rowNumber}>
                                        <TableCell>
                                            <Input
                                                value={fail.data.date}
                                                onChange={(e) => handleFailedRowChange(i, 'date', e.target.value)}
                                                className={cn("h-8", fail.errors.date && "border-destructive focus-visible:ring-destructive")}
                                            />
                                            {fail.errors.date && <div className="text-xs text-destructive mt-1">{fail.errors.date}</div>}
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={fail.data.description}
                                                onChange={(e) => handleFailedRowChange(i, 'description', e.target.value)}
                                                className={cn("h-8", fail.errors.description && "border-destructive focus-visible:ring-destructive")}
                                            />
                                            {fail.errors.description && <div className="text-xs text-destructive mt-1">{fail.errors.description}</div>}
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={fail.data.category}
                                                onValueChange={(value) => handleFailedRowChange(i, 'category', value)}
                                            >
                                                <SelectTrigger className={cn("h-8", fail.errors.category && "border-destructive focus-visible:ring-destructive")}>
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ALL_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={fail.data.paidBy}
                                                onValueChange={(value) => handleFailedRowChange(i, 'paidBy', value)}
                                            >
                                                <SelectTrigger className={cn("h-8", fail.errors.paidBy && "border-destructive focus-visible:ring-destructive")}>
                                                    <SelectValue placeholder="Select parent" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={parentNames['Parent 1']}>{parentNames['Parent 1']}</SelectItem>
                                                    <SelectItem value={parentNames['Parent 2']}>{parentNames['Parent 2']}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fail.errors.paidBy && <div className="text-xs text-destructive mt-1">{fail.errors.paidBy}</div>}
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={fail.data.amount}
                                                onChange={(e) => handleFailedRowChange(i, 'amount', e.target.value)}
                                                className={cn("h-8 text-right", fail.errors.amount && "border-destructive focus-visible:ring-destructive")}
                                            />
                                            {fail.errors.amount && <div className="text-xs text-destructive mt-1">{fail.errors.amount}</div>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                         <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRetryFailedRow(i)}
                                                            disabled={Object.keys(fail.errors).length > 0}
                                                            className="h-8 w-8"
                                                        >
                                                            <RefreshCw className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Retry Import for this Row</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
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
                <Button onClick={handleConfirmImport} disabled={successfulImports.length === 0 && failedImports.length > 0}>
                  Confirm Import ({successfulImports.length})
                </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
