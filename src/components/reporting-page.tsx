'use client';

import { useState, useMemo, useEffect } from 'react';
import { getYear, format, parse, isAfter, startOfMonth } from 'date-fns';
import { BarChart, ReceiptText, Search, ArrowUpDown } from 'lucide-react';
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
  TableFooter,
} from './ui/table';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { ReportingExportButton } from './reporting-export-button';
import { Button } from './ui/button';

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

type SortKey = 'date' | 'description' | 'category' | 'paidBy' | 'amount' | 'parent1Paid' | 'parent2Paid';

type SortConfig = {
  key: SortKey;
  direction: 'ascending' | 'descending';
} | null;


const ALL_CATEGORIES: ExpenseCategory[] = [
  'Medical',
  'Education',
  'Child Care',
  'Activities',
  'Clothing',
  'Food',
  'Child Support',
  'Other',
];

export function ReportingPage({ appData }: ReportingPageProps) {
  const [selectedYear, setSelectedYear] = useState<string>(
    String(getYear(new Date()))
  );
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or 'yyyy-MM'
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'descending' });

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
    const reportTitleForMonth = (month: string) => month === 'all' ? 'Year-to-Date Report' : 'Monthly Report';
    const reportDescriptionForPeriod = (year: string, month: string) => 
      `An overview of all expenses for ${month === 'all' ? `the year ${year}` : format(parse(month, 'yyyy-MM', new Date()), 'MMMM yyyy')}.`;

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
    
    const today = startOfMonth(new Date());

    const allMonthKeys = Object.keys(appData.months)
      .filter(monthId => !isAfter(parse(monthId, 'yyyy-MM', new Date()), today))
      .sort()
      .reverse();

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

            const monthDate = parse(monthId, 'yyyy-MM', new Date());
            const isFutureMonth = isAfter(monthDate, today);

            if (monthData.childSupport.amount > 0 && monthData.childSupport.paidBy !== 'None' && !isFutureMonth) {
                allTransactionsForPeriod.push({
                    ...monthData.childSupport,
                    id: `cs-${monthId}`,
                    date: monthDate.toISOString(),
                    description: 'Child Support',
                    category: 'Child Support',
                    parentNames: monthData.parentNames,
                    year: monthData.year,
                    month: monthData.month
                });
            }
        }
    });

    // Filter for settled items only for the reporting table
    let settledTransactions = allTransactionsForPeriod.filter(t => t.status === 'Settled');
    
    if (selectedCategory !== 'all') {
        settledTransactions = settledTransactions.filter(t => t.category === selectedCategory);
    }
    
    const aggregated: { [key in ExpenseCategory]?: number } = {};
    ALL_CATEGORIES.forEach(cat => aggregated[cat] = 0);

    let total = 0;
    
    const transactionsForSummary = selectedCategory === 'all'
      ? allTransactionsForPeriod.filter(t => t.status === 'Settled')
      : settledTransactions;

    transactionsForSummary.forEach((transaction) => {
        if (aggregated[transaction.category] !== undefined) {
            aggregated[transaction.category]! += transaction.amount;
        }
        total += transaction.amount;
    });

    const chartData = Object.entries(aggregated)
      .map(([name, amount]) => ({
        name,
        amount,
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
      
    settledTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      availableYears: sortedYears.length > 0 ? sortedYears : [String(getYear(new Date()))],
      availableMonths: monthsForSelectedYear,
      periodData: chartData,
      totalPeriodExpenses: total,
      allTransactions: settledTransactions, // Use settled transactions for the report
      parentNamesForPeriod: latestParentNames || { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' },
      reportTitle: reportTitleForMonth(selectedMonth),
      reportDescription: reportDescriptionForPeriod(selectedYear, selectedMonth),
    };
  }, [appData, selectedYear, selectedMonth, selectedCategory]);
  
  useEffect(() => {
    // If the selected month is no longer available in the new year's list, reset to 'all'
    if (selectedMonth !== 'all' && !availableMonths.some(m => m.value === selectedMonth)) {
      setSelectedMonth('all');
    }
  }, [selectedYear, availableMonths, selectedMonth]);
  
  const getPaidAmount = (transaction: Transaction, parent: Parent) => {
      if (transaction.status !== 'Settled') return 0;
  
      if (transaction.category === 'Child Support') {
          // The parent who "Paid By" is responsible for the full amount
          return transaction.paidBy === parent ? transaction.amount : 0;
      }
  
      // For standard expenses, the "paid" amount is their share
      const expense = transaction as EnrichedExpense;
      const split = expense.category === 'Medical' || expense.category === 'Child Care' ? expense.medicalExpenseSplit : expense.expenseSplit;
      return expense.amount * (split[parent] / 100);
  };

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
      
      const parent1Paid = getPaidAmount(transaction, 'Parent 1');
      const parent2Paid = getPaidAmount(transaction, 'Parent 2');

      return paidByName.includes(lowercasedFilter) ||
             description.includes(lowercasedFilter) ||
             category.includes(lowercasedFilter) ||
             parent1Paid.toFixed(2).includes(lowercasedFilter) ||
             parent2Paid.toFixed(2).includes(lowercasedFilter);
    });
  }, [allTransactions, searchTerm]);

  const sortedTransactions = useMemo(() => {
    let sortableItems = [...filteredTransactions];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        if (sortConfig.key === 'parent1Paid') {
          aValue = getPaidAmount(a, 'Parent 1');
          bValue = getPaidAmount(b, 'Parent 1');
        } else if (sortConfig.key === 'parent2Paid') {
          aValue = getPaidAmount(a, 'Parent 2');
          bValue = getPaidAmount(b, 'Parent 2');
        } else if (sortConfig.key === 'paidBy') {
            aValue = a.paidBy === 'None' ? '' : a.parentNames[a.paidBy];
            bValue = b.paidBy === 'None' ? '' : b.parentNames[b.paidBy];
        } else {
            aValue = a[sortConfig.key as keyof Transaction];
            bValue = b[sortConfig.key as keyof Transaction];
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        } else if (sortConfig.key === 'date') {
          const dateA = new Date(aValue).getTime();
          const dateB = new Date(bValue).getTime();
          if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.direction === 'ascending'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredTransactions, sortConfig]);

  const { totalAmount, totalParent1Paid, totalParent2Paid } = useMemo(() => {
    return sortedTransactions.reduce(
      (totals, transaction) => {
        totals.totalAmount += transaction.amount;
        totals.totalParent1Paid += getPaidAmount(transaction, 'Parent 1');
        totals.totalParent2Paid += getPaidAmount(transaction, 'Parent 2');
        return totals;
      },
      { totalAmount: 0, totalParent1Paid: 0, totalParent2Paid: 0 }
    );
  }, [sortedTransactions]);
  
  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUpDown className="ml-2 h-4 w-4" />; // Or a dedicated up arrow
    }
    return <ArrowUpDown className="ml-2 h-4 w-4" />; // Or a dedicated down arrow
  };


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

  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
    <TableHead className={className}>
      <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-2 py-1 h-auto -ml-2">
        {children}
        {sortConfig?.key === sortKey ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : <ArrowUpDown className="ml-2 h-3 w-3" />}
      </Button>
    </TableHead>
  );

  return (
    <div className="mt-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions">All Transactions</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader>
               <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <BarChart className="h-5 w-5 text-secondary-foreground" />
                    </span>
                    <div>
                      <CardTitle>{reportTitle}</CardTitle>
                      <CardDescription>{reportDescription}</CardDescription>
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
                    <Select
                      value={selectedMonth}
                      onValueChange={setSelectedMonth}
                      disabled={availableMonths.length === 0}
                    >
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
                      periodLabel={
                        selectedMonth === 'all'
                          ? selectedYear
                          : format(
                              parse(selectedMonth, 'yyyy-MM', new Date()),
                              'MMMM-yyyy'
                            )
                      }
                      parentNames={parentNamesForPeriod}
                    />
                  </div>
                </div>
                 <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search by description, category, or parent..."
                      className="pl-8 w-full"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      <SortableHeader sortKey="date">Date</SortableHeader>
                      <SortableHeader sortKey="description">
                        Description
                      </SortableHeader>
                      <SortableHeader sortKey="category">
                        Category
                      </SortableHeader>
                      <SortableHeader sortKey="paidBy">Paid By</SortableHeader>
                      <SortableHeader sortKey="amount" className="text-right">
                        Total Amount
                      </SortableHeader>
                      <SortableHeader
                        sortKey="parent1Paid"
                        className="text-right"
                      >
                        {parentNamesForPeriod['Parent 1']} Paid
                      </SortableHeader>
                      <SortableHeader
                        sortKey="parent2Paid"
                        className="text-right"
                      >
                        {parentNamesForPeriod['Parent 2']} Paid
                      </SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransactions.length > 0 ? (
                      sortedTransactions.map((transaction) => {
                        const parent1Paid = getPaidAmount(transaction, 'Parent 1');
                        const parent2Paid = getPaidAmount(transaction, 'Parent 2');

                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              {format(new Date(transaction.date), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {transaction.description}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  transaction.category === 'Child Support'
                                    ? 'default'
                                    : 'outline'
                                }
                              >
                                {transaction.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {transaction.paidBy &&
                                transaction.paidBy !== 'None' && (
                                  <Badge
                                    variant={
                                      transaction.paidBy === 'Parent 1'
                                        ? 'secondary'
                                        : 'outline'
                                    }
                                  >
                                    {transaction.parentNames[transaction.paidBy]}
                                  </Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              ${transaction.amount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              ${parent1Paid.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              ${parent2Paid.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          {searchTerm
                            ? `No settled transactions found for "${searchTerm}".`
                            : 'No settled transactions in this period.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {sortedTransactions.length > 0 && (
                    <TableFooter>
                      <TableRow className="bg-secondary/50 font-bold">
                        <TableCell colSpan={4}>Grand Totals</TableCell>
                        <TableCell className="text-right">
                          ${totalAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${totalParent1Paid.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${totalParent2Paid.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="summary" className="mt-6">
          <Card>
             <CardHeader>
               <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <BarChart className="h-5 w-5 text-secondary-foreground" />
                    </span>
                    <div>
                      <CardTitle>Expense Summary</CardTitle>
                      <CardDescription>A summary of settled contributions by category.</CardDescription>
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
                    <Select
                      value={selectedMonth}
                      onValueChange={setSelectedMonth}
                      disabled={availableMonths.length === 0}
                    >
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
                     <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {ALL_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
             </CardHeader>
            <CardContent>
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
                        <YAxis tickFormatter={(value) => `$${value}`} />
                        <Tooltip
                          cursor={false}
                          content={<ChartTooltipContent indicator="dot" />}
                        />
                        <Bar
                          dataKey="amount"
                          fill="hsl(var(--primary))"
                          radius={4}
                        />
                      </RechartsBarChart>
                    </ChartContainer>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Category Breakdown
                    </h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">
                              Total Amount
                            </TableHead>
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
                            <TableCell className="text-right">
                              ${totalPeriodExpenses.toFixed(2)}
                            </TableCell>
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
                  <p className="font-medium">
                    No settled expenses for this period.
                  </p>
                  <p className="text-sm">
                    Once you settle expenses, a summary will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
