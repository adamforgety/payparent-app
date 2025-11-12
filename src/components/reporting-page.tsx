

'use client';

import { useState, useMemo, useEffect } from 'react';
import { getYear, format, parse, isAfter, startOfMonth } from 'date-fns';
import { BarChart as BarChartIcon, ReceiptText, Search, ArrowUpDown, ChevronDown } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  BarChart,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

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

export type Transaction = EnrichedExpense | EnrichedChildSupport;

type SortKey = 'date' | 'description' | 'category' | 'paidBy' | 'amount' | 'parent1Paid' | 'parent2Paid';

type SortConfig = {
  key: SortKey;
  direction: 'ascending' | 'descending';
} | null;


const ALL_CATEGORIES: (ExpenseCategory | 'Child Support')[] = [
  'Medical',
  'Education',
  'Child Care',
  'Activities',
  'Clothing',
  'Food',
  'Reimbursement',
  'Child Support',
  'Other',
];

interface SummaryData {
    availableYears: string[];
    availableMonths: { value: string; label: string; }[];
    periodData: { name: string; amount: number; }[];
    totalPeriodExpenses: number;
    parentNamesForPeriod: ParentNames;
    reportTitle: string;
    reportDescription: string;
}

interface TransactionsData {
    allTransactions: Transaction[];
}

export function ReportingPage({ appData }: ReportingPageProps) {
  const [selectedYear, setSelectedYear] = useState<string>(
    String(getYear(new Date()))
  );
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or 'yyyy-MM'
  const [selectedCategories, setSelectedCategories] = useState<string[]>(ALL_CATEGORIES);
  const [activeSubTab, setActiveSubTab] = useState('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'descending' });
  
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [transactionsData, setTransactionsData] = useState<TransactionsData | null>(null);
  
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);

  useEffect(() => {
    setIsSummaryLoading(true);
    setTransactionsData(null); // Invalidate transaction data when filters change

    const calculationTimeout = setTimeout(() => {
      if (!appData?.months || Object.keys(appData.months).length === 0) {
        const year = String(getYear(new Date()));
        setSummaryData({
          availableYears: [year],
          availableMonths: [],
          periodData: [],
          totalPeriodExpenses: 0,
          parentNamesForPeriod: { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' } as ParentNames,
          reportTitle: 'Annual Report',
          reportDescription: `An overview of all expenses for the year ${year}.`,
        });
        setIsSummaryLoading(false);
        return;
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

      let transactionsForReport = allTransactionsForPeriod.filter(t => t.status === 'Settled');
      
      const aggregated: { [key: string]: number } = {};
      ALL_CATEGORIES.forEach(cat => aggregated[cat] = 0);

      let total = 0;
      
      const transactionsForSummary = transactionsForReport.filter(t => selectedCategories.includes(t.category));

      transactionsForSummary.forEach((transaction) => {
          if (aggregated[transaction.category] !== undefined) {
              aggregated[transaction.category]! += transaction.amount;
          }
          total += transaction.amount;
      });

      const chartData = Object.entries(aggregated)
        .map(([name, amount]) => ({ name, amount }))
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount);
        
      const reportTitle = selectedMonth === 'all' ? 'Annual Report' : 'Monthly Report';
      const reportDescription = `An overview of all expenses for ${selectedMonth === 'all' ? `the year ${selectedYear}` : format(parse(selectedMonth, 'yyyy-MM', new Date()), 'MMMM yyyy')}.`;

      setSummaryData({
        availableYears: sortedYears.length > 0 ? sortedYears : [String(getYear(new Date()))],
        availableMonths: monthsForSelectedYear,
        periodData: chartData,
        totalPeriodExpenses: total,
        parentNamesForPeriod: latestParentNames || { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' },
        reportTitle,
        reportDescription,
      });

      setIsSummaryLoading(false);

    }, 100);

    return () => clearTimeout(calculationTimeout);

  }, [appData, selectedYear, selectedMonth, selectedCategories]);
  
  useEffect(() => {
    if (activeSubTab !== 'transactions' || !summaryData) return;
    if (transactionsData) return; // Already loaded

    setIsTransactionsLoading(true);

    const calculationTimeout = setTimeout(() => {
        if (!appData?.months) {
            setTransactionsData({ allTransactions: [] });
            setIsTransactionsLoading(false);
            return;
        }

        const today = startOfMonth(new Date());
        let filteredMonthKeys = Object.keys(appData.months)
            .filter(monthId => monthId.startsWith(selectedYear) && !isAfter(parse(monthId, 'yyyy-MM', new Date()), today));
        
        if (selectedMonth !== 'all') {
            filteredMonthKeys = filteredMonthKeys.filter(monthId => monthId === selectedMonth);
        }

        let allTransactionsForPeriod: Transaction[] = [];
        filteredMonthKeys.forEach(monthId => {
            const monthData = appData.months[monthId];
            if (monthData) {
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
        
        const transactionsForReport = allTransactionsForPeriod.filter(t => t.status === 'Settled');

        setTransactionsData({ allTransactions: transactionsForReport });
        setIsTransactionsLoading(false);
    }, 100);

    return () => clearTimeout(calculationTimeout);
  }, [activeSubTab, transactionsData, appData, selectedYear, selectedMonth, summaryData]);


  useEffect(() => {
    if(summaryData?.availableMonths && selectedMonth !== 'all' && !summaryData.availableMonths.some(m => m.value === selectedMonth)) {
      setSelectedMonth('all');
    }
  }, [selectedYear, summaryData?.availableMonths, selectedMonth]);
  
  const getParentShare = (transaction: Transaction, parent: Parent): number => {
      if (transaction.category === 'Child Support') {
          return transaction.paidBy === parent ? transaction.amount : 0;
      }
  
      const expense = transaction as EnrichedExpense;
      if (expense.category === 'Reimbursement') {
          return expense.paidBy === parent ? 0 : expense.amount;
      }

      const split = expense.category === 'Medical' || expense.category === 'Child Care' ? expense.medicalExpenseSplit : expense.expenseSplit;
      return expense.amount * (split[parent] / 100);
  };

  const filteredTransactions = useMemo(() => {
    if (!transactionsData) return [];
    const lowercasedFilter = searchTerm.toLowerCase();
    if (!lowercasedFilter) {
      return transactionsData.allTransactions;
    }
    return transactionsData.allTransactions.filter(transaction => {
      let paidByName = '';
      if (transaction.paidBy && transaction.paidBy !== 'None') {
        paidByName = transaction.parentNames[transaction.paidBy]?.toLowerCase() || '';
      }
      
      const description = transaction.description.toLowerCase();
      const category = transaction.category.toLowerCase();
      
      const parent1Share = getParentShare(transaction, 'Parent 1');
      const parent2Share = getParentShare(transaction, 'Parent 2');

      return paidByName.includes(lowercasedFilter) ||
             description.includes(lowercasedFilter) ||
             category.includes(lowercasedFilter) ||
             parent1Share.toFixed(2).includes(lowercasedFilter) ||
             parent2Share.toFixed(2).includes(lowercasedFilter);
    });
  }, [transactionsData, searchTerm]);

  const sortedTransactions = useMemo(() => {
    let sortableItems = [...filteredTransactions];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        if (sortConfig.key === 'parent1Paid') {
          aValue = getParentShare(a, 'Parent 1');
          bValue = getParentShare(b, 'Parent 1');
        } else if (sortConfig.key === 'parent2Paid') {
          aValue = getParentShare(a, 'Parent 2');
          bValue = getParentShare(b, 'Parent 2');
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
          if (dateA > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
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

  const { totalAmount, totalParent1Share, totalParent2Share } = useMemo(() => {
    return sortedTransactions.reduce(
      (totals, transaction) => {
        totals.totalAmount += transaction.amount;
        totals.totalParent1Share += getParentShare(transaction, 'Parent 1');
        totals.totalParent2Share += getParentShare(transaction, 'Parent 2');
        return totals;
      },
      { totalAmount: 0, totalParent1Share: 0, totalParent2Share: 0 }
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
    if (!summaryData) return {};
    const config: any = {
      amount: {
        label: "Amount",
        color: "hsl(var(--primary))",
      },
    };
    summaryData.periodData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      };
    });
    return config;
  }, [summaryData]);

  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
    <th className={cn("h-12 px-4 align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)}>
      <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-2 py-1 h-auto -ml-2">
        {children}
        {sortConfig?.key === sortKey ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : <ArrowUpDown className="ml-2 h-3 w-3" />}
      </Button>
    </th>
  );
  
  const handleCategoryFilterChange = (category: string, checked: boolean) => {
    if (category === 'all') {
      setSelectedCategories(checked ? ALL_CATEGORIES : []);
    } else {
      setSelectedCategories(prev => 
        checked ? [...prev, category] : prev.filter(c => c !== category)
      );
    }
  };

  const renderLoadingSkeleton = () => (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 w-32" />
            </div>
        </div>
      </CardHeader>
      <CardContent>
          <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-40 w-full" />
          </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="mt-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Summary</TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions" className="mt-6">
          {(isTransactionsLoading || !summaryData) ? renderLoadingSkeleton() : (
          <Card>
            <CardHeader>
               <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <BarChartIcon className="h-5 w-5 text-primary" />
                    </span>
                    <div>
                      <CardTitle>All Transactions Report</CardTitle>
                      <CardDescription>A complete log of all settled financial items.</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {summaryData.availableYears.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedMonth}
                      onValueChange={setSelectedMonth}
                      disabled={summaryData.availableMonths.length === 0}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        {summaryData.availableMonths.map((month) => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ReportingExportButton
                      transactions={sortedTransactions}
                      periodLabel={
                        selectedMonth === 'all'
                          ? selectedYear
                          : format(
                              parse(selectedMonth, 'yyyy-MM', new Date()),
                              'MMMM-yyyy'
                            )
                      }
                      parentNames={summaryData.parentNamesForPeriod}
                    />
                  </div>
                </div>
                 <div className="flex flex-col sm:flex-row gap-4 mt-4 items-center">
                  <div className="relative flex-1 w-full">
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
              {/* Desktop Table */}
              <div className="rounded-md border overflow-x-auto hidden md:block">
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      <SortableHeader sortKey="date">Date</SortableHeader>
                      <SortableHeader sortKey="description">Description</SortableHeader>
                      <SortableHeader sortKey="category">Category</SortableHeader>
                      <SortableHeader sortKey="paidBy">Initial Payer</SortableHeader>
                      <SortableHeader sortKey="amount" className="text-right">Initial Amount</SortableHeader>
                      <SortableHeader sortKey="parent1Paid" className="text-right">{summaryData.parentNamesForPeriod['Parent 1']}'s Share</SortableHeader>
                      <SortableHeader sortKey="parent2Paid" className="text-right">{summaryData.parentNamesForPeriod['Parent 2']}'s Share</SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransactions.length > 0 ? (
                      sortedTransactions.map((transaction) => {
                        const parent1Share = getParentShare(transaction, 'Parent 1');
                        const parent2Share = getParentShare(transaction, 'Parent 2');

                        const isP1Reimbursed = transaction.category === 'Reimbursement' && transaction.paidBy === 'Parent 1';
                        const isP2Reimbursed = transaction.category === 'Reimbursement' && transaction.paidBy === 'Parent 2';

                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>{format(new Date(transaction.date), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="font-medium">{transaction.description}</TableCell>
                            <TableCell>
                              <Badge variant={transaction.category === 'Child Support' ? 'default' : transaction.category === 'Reimbursement' ? 'reimbursement' : 'outline'}>
                                {transaction.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {transaction.paidBy && transaction.paidBy !== 'None' && (
                                  <Badge variant={transaction.paidBy === 'Parent 1' ? 'secondary' : 'info'}>
                                    {transaction.parentNames[transaction.paidBy]}
                                  </Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right font-semibold">${transaction.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              {isP1Reimbursed ? `($${transaction.amount.toFixed(2)})` : `$${parent1Share.toFixed(2)}`}
                            </TableCell>
                            <TableCell className="text-right">
                              {isP2Reimbursed ? `($${transaction.amount.toFixed(2)})` : `$${parent2Share.toFixed(2)}`}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          {searchTerm ? `No transactions found for "${searchTerm}".` : 'No settled transactions in this period.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {sortedTransactions.length > 0 && (
                    <TableFooter>
                      <TableRow className="bg-secondary/50 font-bold">
                        <TableCell colSpan={4}>Grand Totals</TableCell>
                        <TableCell className="text-right">${totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${totalParent1Share.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${totalParent2Share.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
              {/* Mobile Cards */}
              <div className="space-y-4 md:hidden">
                {sortedTransactions.length > 0 ? (
                  sortedTransactions.map((transaction) => {
                    const parent1Share = getParentShare(transaction, 'Parent 1');
                    const parent2Share = getParentShare(transaction, 'Parent 2');
                    const isP1Reimbursed = transaction.category === 'Reimbursement' && transaction.paidBy === 'Parent 1';
                    const isP2Reimbursed = transaction.category === 'Reimbursement' && transaction.paidBy === 'Parent 2';
                    return (
                    <Card key={transaction.id} className="overflow-hidden">
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{transaction.description}</p>
                            <p className="text-sm text-muted-foreground">{format(new Date(transaction.date), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <Badge variant={transaction.category === 'Child Support' ? 'default' : transaction.category === 'Reimbursement' ? 'reimbursement' : 'outline'}>
                            {transaction.category}
                          </Badge>
                          <p className="font-bold text-lg text-right">${transaction.amount.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Initial Payer</span>
                          {transaction.paidBy && transaction.paidBy !== 'None' && (
                            <Badge variant={transaction.paidBy === 'Parent 1' ? 'secondary' : 'info'}>
                              {transaction.parentNames[transaction.paidBy]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="bg-muted/50 px-4 py-3 text-sm">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div className="text-muted-foreground">{summaryData.parentNamesForPeriod['Parent 1']}'s Share</div>
                            <div className={cn("font-semibold text-right", parent1Share < 0 ? 'text-destructive' : 'text-green-600')}>
                                {isP1Reimbursed ? `($${transaction.amount.toFixed(2)})` : `$${parent1Share.toFixed(2)}`}
                            </div>
                            <div className="text-muted-foreground">{summaryData.parentNamesForPeriod['Parent 2']}'s Share</div>
                            <div className={cn("font-semibold text-right", parent2Share < 0 ? 'text-destructive' : 'text-green-600')}>
                                {isP2Reimbursed ? `($${transaction.amount.toFixed(2)})` : `$${parent2Share.toFixed(2)}`}
                            </div>
                        </div>
                      </div>
                    </Card>
                    );
                  })
                ) : (
                  <div className="h-32 text-center flex flex-col justify-center items-center">
                    <p className="text-muted-foreground">
                      {searchTerm ? `No results for "${searchTerm}".` : 'No settled transactions in this period.'}
                    </p>
                  </div>
                )}
                 {sortedTransactions.length > 0 && (
                     <Card className="bg-secondary/50 font-bold">
                        <CardContent className="p-4 space-y-2">
                             <div className="flex justify-between">
                                <span>Total Initial Amount</span>
                                <span>${totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{summaryData.parentNamesForPeriod['Parent 1']}'s Total Share</span>
                                <span>${totalParent1Share.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{summaryData.parentNamesForPeriod['Parent 2']}'s Total Share</span>
                                <span>${totalParent2Share.toFixed(2)}</span>
                            </div>
                        </CardContent>
                     </Card>
                 )}
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>
        <TabsContent value="summary" className="mt-6">
          {(isSummaryLoading || !summaryData) ? renderLoadingSkeleton() : (
            <Card>
                <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <BarChartIcon className="h-5 w-5 text-primary" />
                        </span>
                        <div>
                        <CardTitle>Expense Summary</CardTitle>
                        <CardDescription>A summary of contributions by category for the selected period.</CardDescription>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-full sm:w-32">
                            <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                            {summaryData.availableYears.map((year) => (
                            <SelectItem key={year} value={year}>
                                {year}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <Select
                        value={selectedMonth}
                        onValueChange={setSelectedMonth}
                        disabled={summaryData.availableMonths.length === 0}
                        >
                        <SelectTrigger className="w-full sm:w-40">
                            <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Months</SelectItem>
                            {summaryData.availableMonths.map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                                {month.label}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-48">
                                Filter Categories
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                            <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                                checked={selectedCategories.length === ALL_CATEGORIES.length}
                                onCheckedChange={(checked) => handleCategoryFilterChange('all', !!checked)}
                            >
                                Select All
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            {ALL_CATEGORIES.map((category) => (
                                <DropdownMenuCheckboxItem
                                key={category}
                                checked={selectedCategories.includes(category)}
                                onCheckedChange={(checked) => handleCategoryFilterChange(category, !!checked)}
                                >
                                {category}
                                </DropdownMenuCheckboxItem>
                            ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    </div>
                </CardHeader>
                <CardContent>
                {summaryData.periodData.length > 0 ? (
                    <div className="space-y-8">
                    <div>
                        <ChartContainer
                        config={chartConfig}
                        className="h-[250px] w-full"
                        >
                        <BarChart data={summaryData.periodData} accessibilityLayer>
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
                        </BarChart>
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
                            {summaryData.periodData.map((item) => (
                                <TableRow key={item.name}>
                                <TableCell className="font-medium">
                                    <Badge
                                    variant={item.name === 'Child Support' ? 'default' : item.name === 'Reimbursement' ? 'reimbursement' : 'outline'}
                                    >
                                    {item.name}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    ${item.amount.toFixed(2)}
                                </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-secondary/50 font-bold">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right">
                                ${summaryData.totalPeriodExpenses.toFixed(2)}
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
                        <ReceiptText className="h-8 w-8 text-primary" />
                    </div>
                    <p className="font-medium">
                        No transactions for this period or selection.
                    </p>
                    <p className="text-sm">
                        Once you record transactions, a summary will appear here.
                    </p>
                    </div>
                )}
                </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
