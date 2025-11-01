'use client';

import { useState, useMemo, useEffect } from 'react';
import { getYear, format, parse } from 'date-fns';
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

import type { AppData, Expense, ExpenseCategory, ParentNames, Parent, ExpenseSplit, ChildSupport, MedicalExpenseSplit } from '@/lib/types';
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
import { ReportingExportButton } from './reporting-export-button';

interface ReportingPageProps {
  appData: AppData | null;
}

type EnrichedExpense = Expense & { 
  parentNames: ParentNames;
  expenseSplit: ExpenseSplit;
  medicalExpenseSplit: MedicalExpenseSplit;
};

type EnrichedChildSupport = ChildSupport & {
  id: string;
  date: string;
  description: string;
  category: 'Child Support';
  parentNames: ParentNames;
  year: number;
  month: number;
}

type Transaction = EnrichedExpense | EnrichedChildSupport;


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
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or 'yyyy-MM'
  const [searchTerm, setSearchTerm] = useState('');

  const {
    availableYears,
    availableMonths,
    periodData,
    totalPeriodExpenses,
    allTransactions,
    parentNamesForPeriod,
    reportTitle,
    reportDescription,
  } = useMemo(() => {
    const reportTitleForMonth = (month: string) => month === 'all' ? 'Yearly Report' : 'Monthly Report';
    const reportDescriptionForPeriod = (year: string, month: string) => 
      `An overview of all expenses for ${month === 'all' ? year : format(parse(month, 'yyyy-MM', new Date()), 'MMMM yyyy')}.`;

    if (!appData?.months || Object.keys(appData.months).length === 0) {
      const year = String(getYear(new Date()));
      return {
        availableYears: [year],
        availableMonths: [],
        periodData: [],
        totalPeriodExpenses: 0,
        allTransactions: [],
        parentNamesForPeriod: { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' } as ParentNames,
        reportTitle: reportTitleForMonth(selectedMonth),
        reportDescription: reportDescriptionForPeriod(selectedYear, selectedMonth),
      };
    }

    const allMonthKeys = Object.keys(appData.months).sort().reverse();
    const years = new Set<string>();
    allMonthKeys.forEach(monthId => years.add(monthId.substring(0, 4)));
    const sortedYears = Array.from(years);

    const monthsForSelectedYear = allMonthKeys
      .filter(monthId => monthId.startsWith(selectedYear))
      .map(monthId => ({
        value: monthId,
        label: format(parse(monthId, 'yyyy-MM', new Date()), 'MMMM'),
      }));

    let filteredMonthKeys = allMonthKeys.filter(monthId => monthId.startsWith(selectedYear));
    if (selectedMonth !== 'all') {
        filteredMonthKeys = filteredMonthKeys.filter(monthId => monthId === selectedMonth);
    }
    
    let allTransactionsForPeriod: Transaction[] = [];
    let latestParentNames: ParentNames | null = null;
    
    filteredMonthKeys.forEach(monthId => {
        const monthData = appData.months[monthId];
        if (monthData) {
            if (monthData.parentNames && !latestParentNames) {
              latestParentNames = monthData.parentNames;
            }
            monthData.expenses.forEach(expense => {
                allTransactionsForPeriod.push({
                    ...expense,
                    parentNames: monthData.parentNames,
                    expenseSplit: monthData.expenseSplit,
                    medicalExpenseSplit: monthData.medicalExpenseSplit,
                });
            });
            if (monthData.childSupport.amount > 0 && monthData.childSupport.paidBy !== 'None') {
                allTransactionsForPeriod.push({
                    ...monthData.childSupport,
                    id: `cs-${monthId}`,
                    date: parse(monthId, 'yyyy-MM', new Date()).toISOString(),
                    description: 'Child Support',
                    category: 'Child Support',
                    parentNames: monthData.parentNames,
                    year: monthData.year,
                    month: monthData.month
                });
            }
        }
    });
    
    const allExpensesForPeriod = allTransactionsForPeriod.filter(t => t.category !== 'Child Support') as EnrichedExpense[];

    const aggregated: { [key in ExpenseCategory]?: number } = {};
    ALL_CATEGORIES.forEach(cat => aggregated[cat] = 0);

    let total = 0;
    allExpensesForPeriod.forEach((expense) => {
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
      
    allTransactionsForPeriod.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      availableYears: sortedYears.length > 0 ? sortedYears : [String(getYear(new Date()))],
      availableMonths: monthsForSelectedYear,
      periodData: chartData,
      totalPeriodExpenses: total,
      allTransactions: allTransactionsForPeriod,
      parentNamesForPeriod: latestParentNames || { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' },
      reportTitle: reportTitleForMonth(selectedMonth),
      reportDescription: reportDescriptionForPeriod(selectedYear, selectedMonth),
    };
  }, [appData, selectedYear, selectedMonth]);
  
  // Reset month selection when year changes
  useEffect(() => {
    setSelectedMonth('all');
  }, [selectedYear]);

  const filteredTransactions = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    if (!lowercasedFilter) {
      return allTransactions;
    }
    return allTransactions.filter(transaction => {
      let paidByName = '';
      if (transaction.paidBy && transaction.paidBy !== 'None') {
        paidByName = transaction.parentNames[transaction.paidBy]?.toLowerCase() || '';
      }
      
      const description = transaction.description.toLowerCase();
      const category = transaction.category.toLowerCase();

      let parent1Share = 0;
      let parent2Share = 0;
      if(transaction.category !== 'Child Support') {
        const expense = transaction as EnrichedExpense;
        parent1Share = expense.amount * (expense.category === 'Medical' || expense.category === 'Child Care' ? expense.medicalExpenseSplit['Parent 1'] / 100 : expense.expenseSplit['Parent 1'] / 100);
        parent2Share = expense.amount * (expense.category === 'Medical' || expense.category === 'Child Care' ? expense.medicalExpenseSplit['Parent 2'] / 100 : expense.expenseSplit['Parent 2'] / 100);
      } else {
        const cs = transaction as EnrichedChildSupport;
        if (cs.paidBy === 'Parent 1') parent1Share = cs.amount;
        if (cs.paidBy === 'Parent 2') parent2Share = cs.amount;
      }


      return paidByName.includes(lowercasedFilter) ||
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
    periodData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      };
    });
    return config;
  }, [periodData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <BarChart className="h-5 w-5 text-secondary-foreground" />
            </span>
            <div>
              <CardTitle>{reportTitle}</CardTitle>
              <CardDescription>
                {reportDescription}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-32">
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
             <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={availableMonths.length === 0}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {availableMonths.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ReportingExportButton 
              transactions={allTransactions}
              periodLabel={selectedMonth === 'all' ? selectedYear : format(parse(selectedMonth, 'yyyy-MM', new Date()), 'MMMM-yyyy')}
              parentNames={parentNamesForPeriod}
            />
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
            {periodData.length > 0 ? (
              <div className="space-y-8">
                <div>
                  <ChartContainer
                    config={chartConfig}
                    className="min-h-[250px] w-full"
                  >
                    <RechartsBarChart data={periodData} accessibilityLayer>
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
                        {periodData.map((item) => (
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
                           <TableCell className="text-right">${totalPeriodExpenses.toFixed(2)}</TableCell>
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
                <p className="font-medium">No expenses logged for this period.</p>
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
                      <TableHead className="text-right">{parentNamesForPeriod['Parent 1']}'s Share</TableHead>
                      <TableHead className="text-right">{parentNamesForPeriod['Parent 2']}'s Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length > 0 ? filteredTransactions.map((transaction) => {
                      
                      let parent1Share = 0;
                      let parent2Share = 0;
                      if(transaction.category !== 'Child Support') {
                        const expense = transaction as EnrichedExpense;
                        const parent1Split = expense.category === 'Medical' || expense.category === 'Child Care' ? expense.medicalExpenseSplit['Parent 1'] : expense.expenseSplit['Parent 1'];
                        const parent2Split = expense.category === 'Medical' || expense.category === 'Child Care' ? expense.medicalExpenseSplit['Parent 2'] : expense.expenseSplit['Parent 2'];
                        parent1Share = expense.amount * (parent1Split / 100);
                        parent2Share = expense.amount * (parent2Split / 100);
                      } else {
                        if (transaction.paidBy === 'Parent 1') parent1Share = transaction.amount;
                        if (transaction.paidBy === 'Parent 2') parent2Share = transaction.amount;
                      }

                      return (
                      <TableRow key={transaction.id}>
                        <TableCell>{format(new Date(transaction.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">
                          {transaction.description}
                          <div className='text-xs text-muted-foreground'>{transaction.category}</div>
                        </TableCell>
                        <TableCell>
                            {transaction.paidBy && transaction.paidBy !== 'None' &&
                              <Badge variant={transaction.paidBy === 'Parent 1' ? 'secondary' : 'outline'}>
                                  {transaction.parentNames[transaction.paidBy]}
                              </Badge>
                            }
                        </TableCell>
                        <TableCell className="text-right font-semibold">${transaction.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${parent1Share.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${parent2Share.toFixed(2)}</TableCell>
                      </TableRow>
                    )}) : (
                       <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            {searchTerm ? `No transactions found for "${searchTerm}".` : "No transactions in this period."}
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
