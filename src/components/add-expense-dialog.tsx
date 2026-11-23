
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, PlusCircle, Info } from 'lucide-react';
import { useState, type ReactNode, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Expense, Parent, ExpenseCategory, ParentNames, CustomSplit } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { SelectSeparator } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { useAppContext } from '@/context/app-context';
import { getAllCategories, isExpenseReimbursement, getCategoryColor } from '@/lib/splits';

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

const createExpenseSchema = () => z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be a positive number'),
  date: z.date({ required_error: 'A date is required.' }),
  paidBy: z.enum(['Parent 1', 'Parent 2'], {
    required_error: 'Please select who paid.',
  }),
  category: z.string().min(1, 'Please select a category.'),
  receipt: z
    .any()
    .optional()
    .refine(
      (files) => {
        if (typeof window === 'undefined') return true; 
        if (!files || !(files instanceof FileList) || files.length === 0) return true;
        return files[0].size <= MAX_FILE_SIZE;
      },
      'Max file size is 4MB.'
    )
    .refine(
      (files) => {
        if (typeof window === 'undefined') return true;
        if (!files || !(files instanceof FileList) || files.length === 0) return true;
        return ACCEPTED_FILE_TYPES.includes(files[0].type);
      },
      'Only .jpg, .jpeg, .png, .webp and .pdf files are accepted.'
    ),
});

type FormValues = z.infer<ReturnType<typeof createExpenseSchema>>;

interface AddExpenseDialogProps {
  onAddExpense: (expense: Omit<Expense, 'id' | 'year' | 'month'>) => void;
  parentNames: ParentNames;
  currentDate: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customSplits?: CustomSplit[];
}

export function AddExpenseDialog({
  onAddExpense,
  parentNames,
  currentDate,
  open,
  onOpenChange,
  customSplits,
}: AddExpenseDialogProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const { toast } = useToast();
  const { appData } = useAppContext();
  const expenseSchema = createExpenseSchema();

  const categories = useMemo(() => {
    if (customSplits && customSplits.length > 0) {
      return getAllCategories(customSplits);
    }
    if (appData?.months) {
      const allSplits = Object.values(appData.months).flatMap((m) => m.customSplits || []);
      return getAllCategories(allSplits);
    }
    return getAllCategories();
  }, [customSplits, appData]);

  const form = useForm<FormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      amount: '' as any,
      date: currentDate,
      category: 'Other',
    },
  });

  const selectedCategory = form.watch('category');

  useEffect(() => {
    if (open) {
      form.reset({
        description: '',
        amount: '' as any,
        date: currentDate,
        paidBy: undefined,
        category: 'Other',
        receipt: undefined,
      });
    }
  }, [open, currentDate, form]);

  const receiptRef = form.register('receipt');

  const onSubmit = async (values: FormValues) => {
    let receiptData: Partial<Pick<Expense, 'receiptUrl' | 'receiptFilename'>> = {};
    const { receipt, ...expenseValues } = values;

    if (values.receipt && values.receipt.length > 0) {
      const file = values.receipt[0];
      
      try {
        receiptData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              resolve({ receiptUrl: e.target.result as string, receiptFilename: file.name });
            } else {
              reject(new Error("Could not read file"));
            }
          };
          reader.onerror = (error) => {
            console.error("FileReader error:", error);
            reject(new Error("Error reading file."));
          };
          reader.readAsDataURL(file);
        });
      } catch (error) {
        console.error("Error processing receipt:", error);
        toast({
          variant: "destructive",
          title: "File Read Error",
          description: "There was a problem processing the receipt file. Please try again.",
        });
        return; // Stop submission if file reading fails
      }
    }
    
    onAddExpense({
      ...expenseValues,
      date: values.date.toISOString(),
      paidBy: values.paidBy as Parent,
      category: values.category as ExpenseCategory,
      status: 'Unsettled',
      receiptUrl: receiptData.receiptUrl ?? null,
      receiptFilename: receiptData.receiptFilename ?? null,
    });
    
    toast({
      title: 'Expense Added',
      description: `"${values.description}" has been logged.`,
    });
    
    onOpenChange(false); // Close the dialog on submit
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
          <DialogDescription>
            Enter the total amount for an expense. The app will automatically calculate each parent's share based on your settings.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., School supplies" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: getCategoryColor(cat) }}
                              />
                              <span>{cat}</span>
                              {isExpenseReimbursement(cat, customSplits) && (
                                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium ml-1">
                                  (100% Reimbursed)
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isExpenseReimbursement(selectedCategory, customSplits) && (
                      <Alert className="mt-2 bg-teal-500/10 border-teal-500/30 text-teal-800 dark:text-teal-200">
                        <Info className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        <AlertDescription>
                          The parent who pays will be reimbursed 100% of this amount by the other parent.
                        </AlertDescription>
                      </Alert>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="50.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paidBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Payer</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Parent 1">{parentNames['Parent 1']}</SelectItem>
                        <SelectItem value="Parent 2">{parentNames['Parent 2']}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Expense</FormLabel>
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(date);
                          }
                          setIsDatePickerOpen(false);
                        }}
                        defaultMonth={currentDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="receipt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt (Optional)</FormLabel>
                  <FormControl>
                    <Input type="file" accept={ACCEPTED_FILE_TYPES.join(',')} {...receiptRef} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Add Expense</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    

    