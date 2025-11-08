'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as XLSX from 'xlsx';
import { Upload, Download, ArrowLeft, Check, Trash2, Info, Calendar as CalendarIcon, Copy, AlertCircle } from 'lucide-react';

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
import type { AppData, Expense, Parent, ExpenseCategory, ParentNames } from '@/lib/types';
import { format, parse, isValid, getYear, parseISO, startOfDay } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';

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
  onImport: (expenses: Omit<Expense, 'id' | 'year' | 'month'>[]) => { [monthId: string]: number };
  parentNames: ParentNames;
  appData: AppData;
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

type DuplicateImport = {
    rowNumber: number;
    data: ParsedExpense;
    existingExpense: Expense;
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

// A much more robust date parsing function
function flexibleDateParse(dateInput: string | number): Date | null {
    if (dateInput === null || dateInput === undefined || dateInput === '') {
        return null;
    }

    let parsedDate: Date | null = null;

    // Handle Excel's numeric date format
    if (typeof dateInput === 'number') {
        const excelEpoch = new Date(Date.UTC(1900, 0, dateInput - 1));
        if (isValid(excelEpoch)) {
            parsedDate = excelEpoch;
        }
    }

    // Handle string dates
    if (typeof dateInput === 'string') {
        const dateStr = dateInput.trim();
        const commonFormats = [
            'yyyy-MM-dd', 'yyyy/MM/dd', 'MM-dd-yyyy', 'MM/dd/yy',
            'M/d/yyyy', 'M/d/yy', 'M-d-yyyy', 'M-d-yy'
        ];

        // Try parsing ISO format first
        const isoParsed = parseISO(dateStr);
        if (isValid(isoParsed)) {
             return startOfDay(isoParsed);
        }

        // Try common formats
        for (const fmt of commonFormats) {
            const d = parse(dateStr, fmt, new Date());
            if (isValid(d)) {
                return startOfDay(d);
            }
        }
        
        // Final fallback for other native formats
        const nativeParsed = new Date(dateStr);
        if (isValid(nativeParsed)) {
            return startOfDay(nativeParsed);
        }
    }
    
    if (parsedDate) {
        return startOfDay(parsedDate);
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


export function ImportExpensesDialog({ onImport, parentNames, appData }: ImportExpensesDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [successfulImports, setSuccessfulImports] = useState<ParsedExpense[]>([]);
  const [failedImports, setFailedImports] = useState<FailedImport[]>([]);
  const [duplicateImports, setDuplicateImports] = useState<DuplicateImport[]>([]);
  const { toast } = useToast();

  const allExistingExpenses = useMemo(() => {
    if (!appData) return [];
    return Object.values(appData.months).flatMap(month => month.expenses);
  }, [appData]);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(importSchema),
  });

  const resetState = () => {
    form.reset();
    setStep('upload');
    setSuccessfulImports([]);
    setFailedImports([]);
    setDuplicateImports([]);
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
        'Initially Paid By': parentNames['Parent 1'],
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
      parsedDate = flexibleDateParse(date as any); // The raw value can be a number from xlsx
      if (!parsedDate || getYear(parsedDate) < 2000) { // Add year validation
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
        if (
          paidByLower === parentNames['Parent 1'].toLowerCase() ||
          paidByLower === 'parent 1'
        ) {
          paidByParent = 'Parent 1';
        } else if (
          paidByLower === parentNames['Parent 2'].toLowerCase() ||
          paidByLower === 'parent 2'
        ) {
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

  const checkForDuplicates = (expense: ParsedExpense): Expense | undefined => {
    return allExistingExpenses.find(existing => {
        const expenseDate = startOfDay(new Date(expense.date));
        const existingDate = startOfDay(new Date(existing.date));
        return expenseDate.getTime() === existingDate.getTime() &&
               existing.description.toLowerCase() === expense.description.toLowerCase() &&
               existing.amount === expense.amount &&
               existing.paidBy === expense.paidBy;
    });
};

  const onFileParse = async (values: FormValues) => {
    const file = values.file[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false, dateNF: 'yyyy-mm-dd' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, });

        const successes: ParsedExpense[] = [];
        const failures: FailedImport[] = [];
        const duplicates: DuplicateImport[] = [];
        const seenInFile = new Set<string>();

        jsonData.forEach((row, index) => {
            const normalizedRow: {[key: string]: any} = {};
            for (const key in row) {
              normalizedRow[key.toLowerCase().replace(/\s/g, '')] = row[key];
            }

            const rowData: RowData = {
              date: normalizedRow.date,
              description: normalizedRow.description,
              category: normalizedRow.category,
              paidBy: normalizedRow.initiallypaidby || normalizedRow.paidby,
              amount: String(normalizedRow.amount),
            };

            const { errors, parsedExpense } = validateRow(rowData);
            
            if (parsedExpense) {
              const uniqueKeyInFile = `${parsedExpense.date}-${parsedExpense.description}-${parsedExpense.amount}-${parsedExpense.paidBy}`;
              if (seenInFile.has(uniqueKeyInFile)) {
                failures.push({ rowNumber: index + 2, data: rowData, errors: { general: 'Duplicate in file' }, });
                return;
              }
              seenInFile.add(uniqueKeyInFile);

              const existingMatch = checkForDuplicates(parsedExpense);
              if (existingMatch) {
                duplicates.push({ rowNumber: index + 2, data: parsedExpense, existingExpense: existingMatch });
              } else {
                successes.push(parsedExpense);
              }
            } else {
              failures.push({ rowNumber: index + 2, data: rowData, errors });
            }
          });
          
        setSuccessfulImports(successes);
        setFailedImports(failures);
        setDuplicateImports(duplicates);
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
      const summary = onImport(successfulImports);
      const summaryParts = Object.entries(summary).map(
        ([monthId, count]) =>
          `${count} to ${format(parse(monthId, 'yyyy-MM', new Date()), 'MMMM yyyy')}`
      );
      
      toast({
        title: `Added ${successfulImports.length} expenses`,
        description: summaryParts.join(', '),
      });
    }

    const remainingFailures = failedImports.length > 0 || duplicateImports.length > 0;
    
    if (remainingFailures) {
       toast({
        variant: 'destructive',
        title: 'Some rows were not imported',
        description: 'Skipped rows remain in the dialog for correction.',
      });
    }
    
    if (successfulImports.length > 0 && !remainingFailures) {
        handleOpenChange(false);
    } else if (successfulImports.length === 0 && !remainingFailures) {
        toast({ title: 'No expenses to import' });
        handleOpenChange(false);
    }
  };

  const handleFailedRowChange = (index: number, field: keyof RowData, value: string) => {
    const updatedFailedImports = [...failedImports];
    const itemToUpdate = { ...updatedFailedImports[index] };
    itemToUpdate.data[field] = value;
  
    const { errors, parsedExpense } = validateRow(itemToUpdate.data);
  
    if (parsedExpense) {
      const existingMatch = checkForDuplicates(parsedExpense);
      if (existingMatch) {
        setDuplicateImports(prev => [
          ...prev,
          { rowNumber: itemToUpdate.rowNumber, data: parsedExpense, existingExpense: existingMatch }
        ]);
      } else {
        setSuccessfulImports(prev => [...prev, parsedExpense]);
      }
      setFailedImports(prev => prev.filter((_, i) => i !== index));
    } else {
      itemToUpdate.errors = errors;
      updatedFailedImports[index] = itemToUpdate;
      setFailedImports(updatedFailedImports);
    }
  };

  const handleSuccessfulRowChange = (index: number, field: keyof ParsedExpense, value: string | number | Date) => {
    const updatedSuccessfulImports = [...successfulImports];
    const itemToUpdate = { ...updatedSuccessfulImports[index] };

    if (field === 'date' && typeof value === 'string') {
      const parsedDate = flexibleDateParse(value);
      if (parsedDate) {
        itemToUpdate.date = parsedDate.toISOString();
      }
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

    const handleKeepDuplicate = (index: number) => {
        const duplicate = duplicateImports[index];
        setSuccessfulImports(prev => [...prev, duplicate.data]);
        setDuplicateImports(prev => prev.filter((_, i) => i !== index));
    };

    const handleDiscardDuplicate = (index: number) => {
        setDuplicateImports(prev => prev.filter((_, i) => i !== index));
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
            <DialogDescription asChild>
              <div className="space-y-4 pt-2 text-sm text-muted-foreground">
                <p>Upload an Excel file with the required columns to bulk-add expenses.</p>
                <Alert variant="default" className="bg-secondary/50">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-2">
                       <li>
                         Your file must have columns for: <strong className="text-foreground">Date</strong>, <strong className="text-foreground">Description</strong>, <strong className="text-foreground">Category</strong>, <strong className="text-foreground">Amount</strong>, and <strong className="text-foreground">Initially Paid By</strong>.
                      </li>
                      <li>
                        The "Initially Paid By" value must exactly match one of your set parent names: "<strong className="text-foreground">{parentNames['Parent 1']}</strong>" or "<strong className="text-foreground">{parentNames['Parent 2']}</strong>".
                      </li>
                      <li>
                        The system will automatically calculate each parent's share based on your split percentages. Do not pre-calculate splits in the file.
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </DialogDescription>
          ) : (
            <DialogDescription>
              Review the expenses found in your file. You can edit or remove items before the final import.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-6 -mr-6">
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
            <>
              {successfulImports.length > 0 && (
                  <div className="mb-6">
                      <h3 className="font-semibold mb-2 text-green-600">{successfulImports.length} expenses will be imported:</h3>
                      <div className="rounded-md border overflow-x-auto">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead className="w-[150px]">Date</TableHead>
                                      <TableHead>Description</TableHead>
                                      <TableHead className="w-[150px]">Category</TableHead>
                                      <TableHead className="w-[180px]">Initially Paid By</TableHead>
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
                                                  onChange={(e) => handleSuccessfulRowChange(i, 'date', e.target.value)}
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
               {duplicateImports.length > 0 && (
                  <div className="mb-6">
                      <h3 className="font-semibold mb-2 text-yellow-600">{duplicateImports.length} duplicates found:</h3>
                      <div className="rounded-md border overflow-x-auto">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Description</TableHead>
                                      <TableHead>Date</TableHead>
                                      <TableHead className="text-right">Amount</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {duplicateImports.map((dup, i) => (
                                      <TableRow key={`dup-${dup.rowNumber}-${i}`} className="bg-yellow-500/10">
                                          <TableCell>
                                              <p className="font-semibold">{dup.data.description}</p>
                                              <p className="text-xs text-muted-foreground">Paid by {parentNames[dup.data.paidBy]}</p>
                                          </TableCell>
                                          <TableCell>{format(new Date(dup.data.date), 'MMM d, yyyy')}</TableCell>
                                          <TableCell className="text-right">${dup.data.amount.toFixed(2)}</TableCell>
                                          <TableCell className="text-right">
                                              <div className="flex gap-2 justify-end">
                                                  <Button size="sm" variant="outline" onClick={() => handleDiscardDuplicate(i)}>
                                                      <Trash2 className="mr-2 h-3 w-3"/>
                                                      Discard
                                                  </Button>
                                                  <Button size="sm" onClick={() => handleKeepDuplicate(i)}>
                                                      <Copy className="mr-2 h-3 w-3"/>
                                                      Keep
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
               {failedImports.length > 0 && (
                  <div className="mb-6">
                      <h3 className="font-semibold mb-2 text-destructive">{failedImports.length} rows will be skipped:</h3>
                       <div className="rounded-md border overflow-x-auto">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead className="w-[200px]">Date</TableHead>
                                      <TableHead>Description</TableHead>
                                      <TableHead className="w-[150px]">Category</TableHead>
                                      <TableHead className="w-[180px]">Initially Paid By</TableHead>
                                      <TableHead className="w-[130px]">Amount</TableHead>
                                      <TableHead className="w-[50px] text-right">Actions</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {failedImports.map((fail, i) => (
                                      <TableRow key={`fail-${fail.rowNumber}-${i}`}>
                                          <TableCell>
                                              {fail.errors.date ? (
                                                  <Popover>
                                                      <PopoverTrigger asChild>
                                                          <Button
                                                              variant={'outline'}
                                                              className={cn(
                                                                  'w-full justify-start text-left font-normal h-8',
                                                                  !fail.data.date && 'text-muted-foreground',
                                                                  'border-destructive focus-visible:ring-destructive'
                                                              )}
                                                          >
                                                              <CalendarIcon className="mr-2 h-4 w-4" />
                                                              {fail.data.date ? String(fail.data.date) : <span>Pick a date</span>}
                                                          </Button>
                                                      </PopoverTrigger>
                                                      <PopoverContent className="w-auto p-0">
                                                          <Calendar
                                                              mode="single"
                                                              onSelect={(d) => {
                                                                  if (d) handleFailedRowChange(i, 'date', format(d, 'yyyy-MM-dd'));
                                                              }}
                                                              initialFocus
                                                          />
                                                      </PopoverContent>
                                                  </Popover>
                                              ) : (
                                                  <Input
                                                      value={fail.data.date}
                                                      onChange={(e) => handleFailedRowChange(i, 'date', e.target.value)}
                                                      className="h-8"
                                                  />
                                              )}
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
            </>
          )}
        </div>

        {step === 'preview' && (
          <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
              </Button>
              <Button onClick={handleConfirmImport} disabled={successfulImports.length === 0 && duplicateImports.length > 0}>
                Confirm Import ({successfulImports.length})
              </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
