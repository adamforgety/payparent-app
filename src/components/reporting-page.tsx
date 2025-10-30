'use client';

import { useState, useMemo } from 'react';
import { getYear, format } from 'date-fns';
import { BarChart, ReceiptText, Search } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Tooltip,
} from 'recharts';

import type { AppData, Expense, ExpenseCategory, ParentNames, Parent, ExpenseSplit } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ChartContainer, ChartTooltipContent } from './ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';

interface ReportingPageProps {
  appData: AppData | null;
}

type EnrichedExpense = Expense & { 
  parentNames: ParentNames;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: ExpenseSplit;
};

const ALL_CATEGORIES: ExpenseCategory[] = [
  'Medical',
  'Education',
  'Child Care',
  'Activities',
  'Clothing',
  'Food',
  'Other',
];

export function ReportingPage({ appData }: ReportingPageProps) {
  const [selectedYear, setSelectedYear] = useState<string>(
    String(getYear(new Date()))
  );
  const [searchTerm, setSearchTerm] = useState('');

  const { availableYears, yearlyData, totalYearlyExpenses, allTransactions, parentNamesForYear } = useMemo(() => {
    if (!appData?.months) {
      return {
        availableYears: [String(getYear(new Date()))],
        yearlyData: [],
        totalYearlyExpenses: 0,
        allTransactions: [],
        parentNamesForYear: { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' } as ParentNames,
      };
    }

    const years = new Set<string>();
    let allExpensesForYear: EnrichedExpense[] = [];
    let latestParentNames: ParentNames | null = null;
    
    const sortedMonthKeys = Object.keys(appData.months).sort();

    for (const monthId of sortedMonthKeys) {
      const monthData = appData.months[monthId];
      years.add(String(monthData.year));
      if (String(monthData.year) === selectedYear) {
        if (monthData.parentNames) {
          latestParentNames = monthData.parentNames;
        }
        monthData.expenses.forEach(expense => {
            allExpensesForYear.push({
                ...expense,
                parentNames: monthData.parentNames,
                expenseSplit: monthData.expenseSplit,
                medicalExpenseSplit: monthData.medicalExpenseSplit,
            });
        });
      }
    }

    const aggregated: { [key in ExpenseCategory]?: number } = {};
    ALL_CATEGORIES.forEach(cat => aggregated[cat] = 0);

    let total = 0;
    allExpensesForYear.forEach((expense) => {
      if (aggregated[expense.category] !== undefined) {
        aggregated[expense.category]! += expense.amount;
      }
      total += expense.amount;
    });

    const chartData = Object.entries(aggregated)
      .map(([name, amount]) => ({
        name,
        amount,
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
      
    const sortedYears = Array.from(years).sort((a, b) => Number(b) - Number(a));
    
    allExpensesForYear.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      availableYears: sortedYears.length > 0 ? sortedYears : [String(getYear(new Date()))],
      yearlyData: chartData,
      totalYearlyExpenses: total,
      allTransactions: allExpensesForYear,
      parentNamesForYear: latestParentNames || { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' },
    };
  }, [appData, selectedYear]);
  
  const filteredTransactions = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    if (!lowercasedFilter) {
      return allTransactions;
    }
    return allTransactions.filter(transaction => {
      const paidByParent: Parent = transaction.paidBy;
      const parentName = transaction.parentNames[paidByParent]?.toLowerCase() || '';
      const description = transaction.description.toLowerCase();
      const category = transaction.category.toLowerCase();

      const parent1Share = transaction.amount * (transaction.category === 'Medical' ? transaction.medicalExpenseSplit['Parent 1'] / 100 : transaction.expenseSplit['Parent 1'] / 100);
      const parent2Share = transaction.amount * (transaction.category === 'Medical' ? transaction.medicalExpenseSplit['Parent 2'] / 100 : transaction.expenseSplit['Parent 2'] / 100);

      return parentName.includes(lowercasedFilter) ||
             description.includes(lowercasedFilter) ||
             category.includes(lowercasedFilter) ||
             parent1Share.toFixed(2).includes(lowercasedFilter) ||
             parent2Share.toFixed(2).includes(lowercasedFilter);
    });
  }, [allTransactions, searchTerm]);

  const chartConfig = useMemo(() => {
    const config: any = {
      amount: {
        label: "Amount",
        color: "hsl(var(--primary))",
      },
    };
    yearlyData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      };
    });
    return config;
  }, [yearlyData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <BarChart className="h-5 w-5 text-secondary-foreground" />
            </span>
            <div>
              <CardTitle>Yearly Report</CardTitle>
              <CardDescription>
                An overview of all expenses for the selected year.
              </CardDescription>
            </div>
          </div>
          <div className="w-full sm:w-48">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
         <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="transactions">All Transactions</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-6">
            {yearlyData.length > 0 ? (
              <div className="space-y-8">
                <div>
                  <ChartContainer
                    config={chartConfig}
                    className="min-h-[250px] w-full"
                  >
                    <RechartsBarChart data={yearlyData} accessibilityLayer>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(value) => `$${value}`}
                       />
                      <Tooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="dot" />}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={4} />
                    </RechartsBarChart>
                  </ChartContainer>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {yearlyData.map((item) => (
                          <TableRow key={item.name}>
                            <TableCell className="font-medium">
                              <Badge variant="outline">{item.name}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ${item.amount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-secondary/50 font-bold">
                           <TableCell>Total</TableCell>
                           <TableCell className="text-right">${totalYearlyExpenses.toFixed(2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 text-center min-h-[300px] text-muted-foreground">
                 <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    <ReceiptText className="h-8 w-8" />
                </div>
                <p className="font-medium">No expenses logged for {selectedYear}.</p>
                <p className="text-sm">Once you add expenses, a summary will appear here.</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="transactions" className="mt-6">
            <div className='flex flex-col sm:flex-row gap-4 mb-4'>
                <div className='relative flex-1'>
                    <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                    <Input 
                      type="search"
                      placeholder="Search by description, category, or parent..."
                      className="pl-8 w-full"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
             <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Paid By</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">{parentNamesForYear['Parent 1']}'s Share</TableHead>
                      <TableHead className="text-right">{parentNamesForYear['Parent 2']}'s Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length > 0 ? filteredTransactions.map((expense) => {
                      const parent1Split = expense.category === 'Medical' ? expense.medicalExpenseSplit['Parent 1'] : expense.expenseSplit['Parent 1'];
                      const parent2Split = expense.category === 'Medical' ? expense.medicalExpenseSplit['Parent 2'] : expense.expenseSplit['Parent 2'];
                      const parent1Share = expense.amount * (parent1Split / 100);
                      const parent2Share = expense.amount * (parent2Split / 100);
                      
                      return (
                      <TableRow key={expense.id}>
                        <TableCell>{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">
                          {expense.description}
                          <div className='text-xs text-muted-foreground'>{expense.category}</div>
                        </TableCell>
                        <TableCell>
                            <Badge variant={expense.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>
                                {expense.parentNames[expense.paidBy]}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">${expense.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${parent1Share.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${parent2Share.toFixed(2)}</TableCell>
                      </TableRow>
                    )}) : (
                       <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            {searchTerm ? `No transactions found for "${searchTerm}".` : "No transactions this year."}
                          </TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
