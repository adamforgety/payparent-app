'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';
import { Upload, Download, ArrowLeft, Check, Trash2 } from 'lucide-react';

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
import { Textarea } from './ui/textarea';

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
    'MM/dd/yy',
    'M/d/yy',
  ];

  for (const fmt of formats) {
    const parsedDate = parse(dateString, fmt, new Date());
    if (isValid(parsedDate)) {
      // Check for two-digit year ambiguity
      if (fmt.endsWith('yy') && parsedDate.getFullYear() < 100) {
        const twoDigitYear = parsedDate.getFullYear();
        // Sliding window: years < 70 are 21st century, >= 70 are 20th.
        parsedDate.setFullYear(twoDigitYear + (twoDigitYear < 70 ? 2000 : 1900));
      }
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

const ResizingTextarea = (props: React.ComponentProps<typeof Textarea>) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [props.value]);

    return <Textarea ref={textareaRef} rows={1} {...props} />;
};


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

  const validateRow = (rowData: RowData): { errors: RowErrors, parsedExpense: ParsedExpense | null } => {
    const errors: RowErrors = {};
    const { date, description, paidBy, category } = rowData;
    let amount = rowData.amount;

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
    } else if (isNaN(parseFloat(amountAsString)) || !isFinite(Number(amountAsString))) {
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

            const { errors, parsedExpense } = validateRow(rowData);
            
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
    const { errors } = validateRow(updatedFailedImports[index].data);
    updatedFailedImports[index].errors = errors;
    
    setFailedImports(updatedFailedImports);
  };

  const handleRetryFailedRow = (index: number) => {
    const rowToRetry = failedImports[index];
    const { errors, parsedExpense } = validateRow(rowToRetry.data);

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

  const handleSuccessfulRowChange = (index: number, field: keyof ParsedExpense, value: string | number | Date) => {
    const updatedSuccessfulImports = [...successfulImports];
    const itemToUpdate = { ...updatedSuccessfulImports[index] };

    if (field === 'date' && value instanceof Date) {
        itemToUpdate.date = value.toISOString();
    } else if (field === 'amount' && typeof value === 'string') {
        let amountAsString = value.trim();
        if (amountAsString.startsWith('$')) {
            amountAsString = amountAsString.substring(1).trim();
        }
        itemToUpdate.amount = parseFloat(amountAsString) || 0;
    } else if (typeof value === 'string') {
        (itemToUpdate as any)[field] = value;
    }

    const rowData: RowData = {
        date: format(new Date(itemToUpdate.date), 'yyyy-MM-dd'),
        description: itemToUpdate.description,
        category: itemToUpdate.category,
        paidBy: parentNames[itemToUpdate.paidBy],
        amount: String(itemToUpdate.amount),
    };

    const { errors, parsedExpense } = validateRow(rowData);
    
    if (parsedExpense) {
        updatedSuccessfulImports[index] = parsedExpense;
        setSuccessfulImports(updatedSuccessfulImports);
    } else {
        // If the edit made it invalid, move it to failed imports
        setSuccessfulImports(prev => prev.filter((_, i) => i !== index));
        setFailedImports(prev => [
            ...prev,
            { rowNumber: -1, data: rowData, errors } // -1 indicates it came from the successful list
        ]);
    }
  };
  
  const removeSuccessfulRow = (index: number) => {
    setSuccessfulImports(prev => prev.filter((_, i) => i !== index));
  };
  
  const removeFailedRow = (index: number) => {
    setFailedImports(prev => prev.filter((_, i) => i !== index));
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
           {step === 'upload' ? (
            <DialogDescription>
             Upload an Excel file with columns for Date, Description, Category, Amount, and "Paid By". The "Paid By" name must match "{parentNames['Parent 1']}" or "{parentNames['Parent 2']}". Add only the total amount paid; the system will auto-calculate the percentage split.
            </DialogDescription>
          ) : (
            <DialogDescription>
              Review the expenses found in your file. You can edit or remove items before the final import.
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'upload' && (
          <>
            <div className="pt-2">
                <Button
                  variant="link"
                  onClick={handleDownloadTemplate}
                  className="p-0 h-auto font-normal text-sm"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
            </div>
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
          </>
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
                                    <TableHead className="w-[150px]">Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-[150px]">Category</TableHead>
                                    <TableHead className="w-[180px]">Paid By</TableHead>
                                    <TableHead className="w-[130px] text-right">Amount</TableHead>
                                    <TableHead className="w-[50px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {successfulImports.map((exp, i) => (
                                    <TableRow key={`success-${i}`}>
                                        <TableCell>
                                            <Input
                                                value={format(new Date(exp.date), 'yyyy-MM-dd')}
                                                onChange={(e) => handleSuccessfulRowChange(i, 'date', new Date(e.target.value))}
                                                type="date"
                                                className="h-8"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <ResizingTextarea
                                                value={exp.description}
                                                onChange={(e) => handleSuccessfulRowChange(i, 'description', e.target.value)}
                                                className="h-8"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={exp.category}
                                                onValueChange={(value) => handleSuccessfulRowChange(i, 'category', value)}
                                            >
                                                <SelectTrigger className="h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ALL_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={exp.paidBy}
                                                onValueChange={(value) => handleSuccessfulRowChange(i, 'paidBy', value)}
                                            >
                                                <SelectTrigger className="h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Parent 1">{parentNames['Parent 1']}</SelectItem>
                                                    <SelectItem value="Parent 2">{parentNames['Parent 2']}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={exp.amount}
                                                onChange={(e) => handleSuccessfulRowChange(i, 'amount', e.target.value)}
                                                className="h-8 text-right"
                                                type="number"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeSuccessfulRow(i)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
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
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedImports.map((fail, i) => (
                                    <TableRow key={`fail-${fail.rowNumber}-${i}`}>
                                        <TableCell>
                                            <Input
                                                value={fail.data.date}
                                                onChange={(e) => handleFailedRowChange(i, 'date', e.target.value)}
                                                className={cn("h-8", fail.errors.date && "border-destructive focus-visible:ring-destructive")}
                                            />
                                            {fail.errors.date && <div className="text-xs text-destructive mt-1">{fail.errors.date}</div>}
                                        </TableCell>
                                        <TableCell>
                                            <ResizingTextarea
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
                                            <div className="flex items-center justify-end">
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
                                                                <Check className={cn("h-4 w-4", Object.keys(fail.errors).length === 0 && "text-green-600")} />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Validate Row</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeFailedRow(i)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
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
