
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
import type { Expense, Parent, ExpenseCategory, ParentNames } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { SelectSeparator } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be a positive number'),
  date: z.date({ required_error: 'A date is required.' }),
  paidBy: z.enum(['Parent 1', 'Parent 2'], {
    required_error: 'Please select who paid.',
  }),
  category: z.enum(
    ['Medical', 'Child Care', 'Education', 'Activities', 'Clothing', 'Food', 'Reimbursement', 'Other'],
    { required_error: 'Please select a category.' }
  ),
  receipt: z
    .any()
    .refine(
      (files) => !files || files.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE,
      'Max file size is 4MB.'
    )
    .refine(
      (files) => !files || files.length === 0 || ACCEPTED_FILE_TYPES.includes(files?.[0]?.type),
      'Only .jpg, .jpeg, .png, .webp and .pdf files are accepted.'
    ).optional(),
});

type FormValues = z.infer<typeof expenseSchema>;

interface AddExpenseDialogProps {
  onAddExpense: (expense: Omit<Expense, 'id' | 'year' | 'month'>) => void;
  parentNames: ParentNames;
  currentDate: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddExpenseDialog({ onAddExpense, parentNames, currentDate, open, onOpenChange }: AddExpenseDialogProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const { toast } = useToast();

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
      const reader = new FileReader();
      
      receiptData = await new Promise((resolve, reject) => {
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve({ receiptUrl: e.target.result as string, receiptFilename: file.name });
          } else {
            reject(new Error("Could not read file"));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
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
                        <SelectItem value="Medical">Medical</SelectItem>
                        <SelectItem value="Child Care">Child Care</SelectItem>
                        <SelectItem value="Education">Education</SelectItem>
                        <SelectItem value="Activities">Activities</SelectItem>
                        <SelectItem value="Clothing">Clothing</SelectItem>
                        <SelectItem value="Food">Food</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                        <SelectSeparator />
                        <SelectItem value="Reimbursement">Reimbursement</SelectItem>
                      </SelectContent>
                    </Select>
                    {(selectedCategory === 'Medical' || selectedCategory === 'Child Care') && (
                        <Alert className="mt-2">
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                This cost will be divided based on the <strong className="text-foreground">Medical & Child Care Split</strong> percentage in Settings.
                            </AlertDescription>
                        </Alert>
                    )}
                    {selectedCategory === 'Reimbursement' && (
                        <Alert className="mt-2">
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                The parent who initially paid will be reimbursed 100% of this amount by the other parent.
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
