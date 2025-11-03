'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, Edit, Paperclip, X } from 'lucide-react';
import { useState, useEffect } from 'react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Separator } from './ui/separator';

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
    ['Medical', 'Education', 'Child Care', 'Activities', 'Clothing', 'Food', 'Other'],
    { required_error: 'Please select a category.' }
  ),
  receipt: z.any().optional(),
});

type FormValues = z.infer<typeof expenseSchema>;

interface EditExpenseDialogProps {
  expense: Expense;
  onUpdateExpense: (expense: Expense, originalMonthId: string) => void;
  parentNames: ParentNames;
  monthId: string;
}

export function EditExpenseDialog({ expense, onUpdateExpense, parentNames, monthId }: EditExpenseDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [hasExistingReceipt, setHasExistingReceipt] = useState(!!expense.receiptUrl);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(expenseSchema),
  });

  const receiptRef = form.register('receipt');

  useEffect(() => {
    if (isOpen) {
      form.reset({
        description: expense.description,
        amount: expense.amount,
        date: new Date(expense.date),
        paidBy: expense.paidBy,
        category: expense.category,
      });
      setHasExistingReceipt(!!expense.receiptUrl);
      setRemoveReceipt(false);
    }
  }, [expense, form, isOpen]);

  async function onSubmit(values: FormValues) {
    let receiptData: Partial<Pick<Expense, 'receiptUrl' | 'receiptFilename'>>;

    const { receipt, ...expenseValues } = values;

    if (removeReceipt) {
      receiptData = { receiptUrl: null, receiptFilename: null };
    } else if (values.receipt && values.receipt.length > 0) {
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
    } else {
      // If no new receipt, and not removing, keep the old one
      receiptData = { 
        receiptUrl: expense.receiptUrl, 
        receiptFilename: expense.receiptFilename 
      };
    }

    onUpdateExpense({
      ...expense,
      ...expenseValues,
      date: values.date.toISOString(),
      receiptUrl: receiptData.receiptUrl,
      receiptFilename: receiptData.receiptFilename,
    }, monthId);
    toast({
      title: 'Expense Updated',
      description: `"${values.description}" has been updated.`,
    });
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription>
            Update the details of this expense.
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Medical">Medical</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Child Care">Child Care</SelectItem>
                      <SelectItem value="Activities">Activities</SelectItem>
                      <SelectItem value="Clothing">Clothing</SelectItem>
                      <SelectItem value="Food">Food</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <FormLabel>Paid By</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Receipt</FormLabel>
              {hasExistingReceipt && !removeReceipt ? (
                <div className="flex items-center justify-between rounded-md border p-2">
                  <div className='flex items-center gap-2'>
                    <Paperclip className="h-4 w-4" />
                    <a href={expense.receiptUrl!} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                      {expense.receiptFilename || 'View Receipt'}
                    </a>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRemoveReceipt(true)}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <FormControl>
                  <Input type="file" accept={ACCEPTED_FILE_TYPES.join(',')} {...receiptRef} />
                </FormControl>
              )}
              <FormMessage>{form.formState.errors.receipt?.message as React.ReactNode}</FormMessage>
            </FormItem>

            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
