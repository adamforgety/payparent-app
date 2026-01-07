

'use client';

import { useState, useMemo, useEffect } from 'react';
import { getYear, format, parse, isAfter, startOfMonth, getMonth } from 'date-fns';
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

import type { AppData, Expense, ExpenseCategory, ParentNames, Parent, CustomSplit, ChildSupport } from '@/lib/types';
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
  currentDate: Date;
}

type EnrichedExpense = Expense & { 
  parentNames: ParentNames;
  customSplits: CustomSplit[];
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
    periodData: { name: string; amount: number; }[];
    totalPeriodExpenses: number;
    parentNamesForPeriod: ParentNames;
}

interface TransactionsData {
    allTransactions: Transaction[];
}

export function ReportingPage({ appData, currentDate }: ReportingPageProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(ALL_CATEGORIES);
  const [activeSubTab, setActiveSubTab] = useState('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });
  const [selectedParent, setSelectedParent] = useState<Parent | 'all'>('all');
  const [isAllMonthsView, setIsAllMonthsView] = useState(true);
  
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [transactionsData, setTransactionsData] = useState<TransactionsData | null>(null);
  
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);

  const localGetParentShare = (transaction: Transaction, parent: Parent): number => {
    if (transaction.category === 'Child Support') {
      return transaction.paidBy === parent ? transaction.amount : 0;
    }

    const expense = transaction as EnrichedExpense;
    if (expense.category === 'Reimbursement') {
      return expense.paidBy === parent ? 0 : expense.amount;
    }

    const applicableSplit = expense.customSplits?.find(s => s.categories.includes(expense.category));
    const parentSplitPercent = applicableSplit ? applicableSplit.split[parent] / 100 : 0.5;
    return expense.amount * parentSplitPercent;
  };

  useEffect(() => {
    setIsSummaryLoading(true);
    setTransactionsData(null); // Invalidate transaction data when filters change

    const calculationTimeout = setTimeout(() => {
      if (!appData?.months || Object.keys(appData.months).length === 0) {
        setSummaryData({
          periodData: [],
          totalPeriodExpenses: 0,
          parentNamesForPeriod: { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' } as ParentNames,
        });
        setIsSummaryLoading(false);
        return;
      }
      
      const today = startOfMonth(new Date());
      const selectedYear = getYear(currentDate);

      const allMonthKeys = Object.keys(appData.months)
        .filter(monthId => !isAfter(parse(monthId, 'yyyy-MM', new Date()), today))
        .sort()
        .reverse();

      let filteredMonthKeys = allMonthKeys.filter(monthId => monthId.startsWith(String(selectedYear)));
      if (!isAllMonthsView) {
          const selectedMonthId = format(currentDate, 'yyyy-MM');
          filteredMonthKeys = filteredMonthKeys.filter(monthId => monthId === selectedMonthId);
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
                      customSplits: monthData.customSplits,
                  });
              });

              const monthDate = parse(monthId, 'yyyy-MM', new Date());
              const isFutureMonth = isAfter(monthDate, today);
              const monthIndex = getMonth(monthDate) + 1;
              const monthlyPayer = monthData.childSupport.monthlyPayer?.[monthIndex] ?? 'None';

              if (monthData.childSupport.amount > 0 && monthlyPayer !== 'None' && !isFutureMonth) {
                  allTransactionsForPeriod.push({
                      ...monthData.childSupport,
                      paidBy: monthlyPayer,
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
      
      const aggregated: { [key: string]: number } = {};
      ALL_CATEGORIES.forEach(cat => aggregated[cat] = 0);

      let total = 0;
      
      const transactionsForSummary = transactionsForReport.filter(t => selectedCategories.includes(t.category));

      transactionsForSummary.forEach((transaction) => {
        if (aggregated[transaction.category] !== undefined) {
          if (selectedParent === 'all') {
            // For 'Reimbursement', we should consider the cost to the non-paying parent, not the total amount
            if (transaction.category === 'Reimbursement') {
                total += transaction.amount;
                aggregated[transaction.category]! += transaction.amount;
            } else if (transaction.category !== 'Child Support') {
                total += transaction.amount;
                aggregated[transaction.category]! += transaction.amount;
            } else {
                 aggregated[transaction.category]! += transaction.amount;
                 total += transaction.amount;
            }
          } else {
            const share = localGetParentShare(transaction, selectedParent);
            aggregated[transaction.category]! += share;
            total += share;
          }
        }
      });

      const chartData = Object.entries(aggregated)
        .map(([name, amount]) => ({ name, amount }))
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount);
        
      setSummaryData({
        periodData: chartData,
        totalPeriodExpenses: total,
        parentNamesForPeriod: latestParentNames || { 'Parent 1': 'Parent 1', 'Parent 2': 'Parent 2' },
      });

      setIsSummaryLoading(false);

    }, 100);

    return () => clearTimeout(calculationTimeout);

  }, [appData, currentDate, isAllMonthsView, selectedCategories, selectedParent]);
  
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
        const selectedYear = getYear(currentDate);

        let filteredMonthKeys = Object.keys(appData.months)
            .filter(monthId => monthId.startsWith(String(selectedYear)) && !isAfter(parse(monthId, 'yyyy-MM', new Date()), today));
        
        if (!isAllMonthsView) {
            const selectedMonthId = format(currentDate, 'yyyy-MM');
            filteredMonthKeys = filteredMonthKeys.filter(monthId => monthId === selectedMonthId);
        }

        let allTransactionsForPeriod: Transaction[] = [];
        filteredMonthKeys.forEach(monthId => {
            const monthData = appData.months[monthId];
            if (monthData) {
                monthData.expenses.forEach(expense => {
                    allTransactionsForPeriod.push({
                        ...expense,
                        parentNames: monthData.parentNames,
                        customSplits: monthData.customSplits,
                    });
                });
                const monthDate = parse(monthId, 'yyyy-MM', new Date());
                const isFutureMonth = isAfter(monthDate, today);
                const monthIndex = getMonth(monthDate) + 1;
                const monthlyPayer = monthData.childSupport.monthlyPayer?.[monthIndex] ?? 'None';

                if (monthData.childSupport.amount > 0 && monthlyPayer !== 'None' && !isFutureMonth) {
                    allTransactionsForPeriod.push({
                        ...monthData.childSupport,
                        paidBy: monthlyPayer,
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
  }, [activeSubTab, transactionsData, appData, currentDate, isAllMonthsView, summaryData]);

  const getParentShare = (transaction: Transaction, parent: Parent): number => {
    if (transaction.category === 'Child Support') {
      return transaction.paidBy === parent ? transaction.amount : 0;
    }

    const expense = transaction as EnrichedExpense;
    if (expense.category === 'Reimbursement') {
      return expense.paidBy === parent ? 0 : expense.amount;
    }

    const applicableSplit = expense.customSplits?.find(s => s.categories.includes(expense.category));
    const parentSplitPercent = applicableSplit ? applicableSplit.split[parent] / 100 : 0.5;
    return expense.amount * parentSplitPercent;
  };

  const filteredTransactions = useMemo(() => {
    if (!transactionsData) return [];
    
    let items = transactionsData.allTransactions;

    // Filter by selected parent's share
    if (selectedParent !== 'all') {
        items = items.filter(t => getParentShare(t, selectedParent) > 0);
    }

    // Filter by search term
    const lowercasedFilter = searchTerm.toLowerCase();
    if (lowercasedFilter) {
      items = items.filter(transaction => {
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
    }

    return items;
  }, [transactionsData, searchTerm, selectedParent]);

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

        if (sortConfig.key === 'date') {
          const dateA = new Date(aValue).getTime();
          const dateB = new Date(bValue).getTime();
          if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
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
        if(transaction.category !== 'Reimbursement' && transaction.category !== 'Child Support') {
            totals.totalAmount += transaction.amount;
        } else if (transaction.category === 'Reimbursement') {
            totals.totalAmount += transaction.amount;
        }

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

  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
    <th className={cn("h-12 px-4 align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)}>
      <Button variant="ghost" onClick={() => requestSort(sortKey)} className={cn("px-2 py-1 h-auto -ml-2", className?.includes('text-right') && "justify-end w-full")}>
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
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="report-all-months-switch"
                            checked={isAllMonthsView}
                            onCheckedChange={setIsAllMonthsView}
                        />
                        <Label htmlFor="report-all-months-switch">Show All Months</Label>
                    </div>
                    <ReportingExportButton
                      transactions={sortedTransactions}
                      periodLabel={
                        isAllMonthsView
                          ? String(getYear(currentDate))
                          : format(currentDate, 'MMMM-yyyy')
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
                    <div className="flex-1 w-full">
                        <Select value={selectedParent} onValueChange={(value: Parent | 'all') => setSelectedParent(value)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Filter by parent's share" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Parent Shares</SelectItem>
                                <SelectItem value="Parent 1">{summaryData.parentNamesForPeriod['Parent 1']}'s Share</SelectItem>
                                <SelectItem value="Parent 2">{summaryData.parentNamesForPeriod['Parent 2']}'s Share</SelectItem>
                            </SelectContent>
                        </Select>
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
                            <div className={cn("font-semibold text-right", isP1Reimbursed ? 'text-destructive' : '')}>
                                {isP1Reimbursed ? `($${transaction.amount.toFixed(2)})` : `$${parent1Share.toFixed(2)}`}
                            </div>
                            <div className="text-muted-foreground">{summaryData.parentNamesForPeriod['Parent 2']}'s Share</div>
                            <div className={cn("font-semibold text-right", isP2Reimbursed ? 'text-destructive' : '')}>
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
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="report-all-months-switch-summary"
                                checked={isAllMonthsView}
                                onCheckedChange={setIsAllMonthsView}
                            />
                            <Label htmlFor="report-all-months-switch-summary">Show All Months</Label>
                        </div>
                         <Select value={selectedParent} onValueChange={(value: Parent | 'all') => setSelectedParent(value)}>
                            <SelectTrigger className="w-full sm:w-[10rem]">
                                <SelectValue placeholder="Filter by parent's share" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Parent Shares</SelectItem>
                                <SelectItem value="Parent 1">{summaryData.parentNamesForPeriod['Parent 1']}'s Share</SelectItem>
                                <SelectItem value="Parent 2">{summaryData.parentNamesForPeriod['Parent 2']}'s Share</SelectItem>
                            </SelectContent>
                        </Select>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto">
                                Categories
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
                        config={{
                            amount: {
                                label: "Amount",
                                color: "hsl(var(--primary))",
                            },
                        }}
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
