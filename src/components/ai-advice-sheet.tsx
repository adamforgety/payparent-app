'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { getExpenseGuidance, type ExpenseGuidanceOutput } from '@/ai/flows/expense-guidance';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';

const adviceSchema = z.object({
  childAge: z.coerce.number().int().min(0, 'Age cannot be negative').max(25, "Age seems high"),
  location: z.string().min(2, 'Location is required'),
  parent1Income: z.coerce.number().min(0, 'Income must be a positive number'),
  parent2Income: z.coerce.number().min(0, 'Income must be a positive number'),
});

interface AiAdviceSheetProps {
  children: ReactNode;
  currentMonthlyExpenses: number;
}

export function AiAdviceSheet({
  children,
  currentMonthlyExpenses,
}: AiAdviceSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExpenseGuidanceOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof adviceSchema>>({
    resolver: zodResolver(adviceSchema),
  });

  async function onSubmit(values: z.infer<typeof adviceSchema>) {
    setIsLoading(true);
    setResult(null);
    try {
      const guidance = await getExpenseGuidance({
        ...values,
        currentMonthlyExpenses,
      });
      setResult(guidance);
    } catch (error) {
      console.error('AI guidance error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not get AI advice. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="text-primary" />
            Smart Budgeting Advice
          </SheetTitle>
          <SheetDescription>
            Get AI-powered advice on fair monthly expenses for your child based
            on your circumstances.
          </SheetDescription>
        </SheetHeader>
        <div className="py-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="childAge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Child's Age</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 8" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., New York, NY" {...field} />
                    </FormControl>
                     <FormDescription>
                      City and state can help determine cost of living.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="parent1Income"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent 1 Monthly Income ($)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 5000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="parent2Income"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent 2 Monthly Income ($)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 6500" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Get Advice
              </Button>
            </form>
          </Form>

          {result && (
             <div className="mt-6 rounded-lg border bg-secondary/50 p-4">
                <h3 className="font-semibold mb-2">AI Recommendation</h3>
                <div className="mb-4">
                    <p className="text-sm text-muted-foreground">Recommended Monthly Expenses</p>
                    <p className="text-2xl font-bold text-primary">${result.recommendedMonthlyExpenses.toFixed(2)}</p>
                </div>
                <div>
                     <p className="text-sm text-muted-foreground">Reasoning</p>
                     <p className="text-sm">{result.reasoning}</p>
                </div>
             </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
