'use client';

import React, { useMemo, useState } from 'react';
import { parse, format, getMonth, isAfter, startOfMonth } from 'date-fns';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Scale,
  ArrowRight,
  TrendingUp,
  PieChart,
  User,
  PlusCircle,
  Loader2,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import type { AppData, MonthData, Expense, CustomSplit, Parent } from '@/lib/types';
import { useAppContext } from '@/context/app-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DashboardTabProps {
  currentMonthData: MonthData;
  expenses: Expense[];
  appData: AppData;
  monthId: string;
  handleGoToUnsettled?: (monthId: string) => void;
  setActiveTab?: (tab: string) => void;
  dashboardSubTab?: string;
  setDashboardSubTab?: (tab: string) => void;
}

const CATEGORY_COLORS: { [key: string]: string } = {
  'Child Support': '#6366f1', // Indigo
  'Child Care': '#f59e0b',    // Amber
  'Education': '#10b981',     // Emerald
  'Activities': '#3b82f6',    // Blue
  'Medical': '#ec4899',       // Pink
  'Clothing': '#8b5cf6',      // Purple
  'Food': '#f97316',          // Orange
  'Reimbursement': '#14b8a6', // Teal
  'Other': '#64748b',         // Slate
};

export function DashboardTab({
  currentMonthData,
  expenses,
  appData,
  monthId,
  handleGoToUnsettled,
  setActiveTab,
}: DashboardTabProps) {
  const { batchUpdateMonths } = useAppContext();
  const { toast } = useToast();
  const [isSettling, setIsSettling] = useState(false);

  const monthDate = useMemo(() => parse(monthId, 'yyyy-MM', new Date()), [monthId]);
  const monthName = useMemo(() => format(monthDate, 'MMMM yyyy'), [monthDate]);
  const monthIndex = useMemo(() => getMonth(monthDate) + 1, [monthDate]);

  const p1Name = currentMonthData.parentNames?.['Parent 1'] || 'Parent 1';
  const p2Name = currentMonthData.parentNames?.['Parent 2'] || 'Parent 2';

  const customSplits = currentMonthData.customSplits || [];
  const childSupport = currentMonthData.childSupport;

  // 1. Child Support Configuration for this month
  const csPayer = childSupport?.monthlyPayer?.[monthIndex] ?? childSupport?.paidBy ?? 'None';
  const csAmount = childSupport?.amount || 0;
  const isCsConfigured = csPayer !== 'None' && csAmount > 0;
  const isCsSettled = childSupport?.status === 'Settled';

  // 2. Upfront paid totals for this month
  const { p1Upfront, p2Upfront } = useMemo(() => {
    let p1 = 0;
    let p2 = 0;
    for (const exp of expenses) {
      if (exp.paidBy === 'Parent 1') p1 += exp.amount;
      else if (exp.paidBy === 'Parent 2') p2 += exp.amount;
    }
    return { p1Upfront: p1, p2Upfront: p2 };
  }, [expenses]);

  // 3. Debts & Obligations calculation
  const { p1Debt, p2Debt, unsettledItemsCount, isEntireMonthSettled } = useMemo(() => {
    let p1 = 0; // What P1 owes P2
    let p2 = 0; // What P2 owes P1
    let unsettledCount = 0;

    for (const exp of expenses) {
      if (exp.status === 'Unsettled') {
        unsettledCount++;
        if (exp.paidBy === 'Parent 2') {
          // P2 paid upfront, so P1 owes their share
          if (exp.category === 'Reimbursement') {
            p1 += exp.amount;
          } else {
            const split = customSplits.find((s) => s.categories.includes(exp.category));
            const p1Percent = split ? split.split['Parent 1'] / 100 : 0.5;
            p1 += exp.amount * p1Percent;
          }
        } else if (exp.paidBy === 'Parent 1') {
          // P1 paid upfront, so P2 owes their share
          if (exp.category === 'Reimbursement') {
            p2 += exp.amount;
          } else {
            const split = customSplits.find((s) => s.categories.includes(exp.category));
            const p2Percent = split ? split.split['Parent 2'] / 100 : 0.5;
            p2 += exp.amount * p2Percent;
          }
        }
      }
    }

    // Add monthly child support obligation if unsettled
    if (isCsConfigured && !isCsSettled) {
      unsettledCount++;
      if (csPayer === 'Parent 1') {
        p1 += csAmount;
      } else if (csPayer === 'Parent 2') {
        p2 += csAmount;
      }
    }

    const allSettled = expenses.length > 0 && unsettledCount === 0;

    return {
      p1Debt: p1,
      p2Debt: p2,
      unsettledItemsCount: unsettledCount,
      isEntireMonthSettled: allSettled,
    };
  }, [expenses, customSplits, isCsConfigured, isCsSettled, csPayer, csAmount]);

  const netDiff = Math.abs(p1Debt - p2Debt);
  const isNetZero = netDiff < 0.01;

  // 4. "Where Did The Money Go?" Category Visualizer
  const { categoriesList, totalMonthSpend } = useMemo(() => {
    const map: { [key: string]: { total: number; count: number; p1Share: number; p2Share: number } } = {};
    let totalSpend = 0;

    // Process all logged expenses for this month
    for (const exp of expenses) {
      totalSpend += exp.amount;
      if (!map[exp.category]) {
        map[exp.category] = { total: 0, count: 0, p1Share: 0, p2Share: 0 };
      }
      map[exp.category].total += exp.amount;
      map[exp.category].count += 1;

      if (exp.category === 'Reimbursement') {
        if (exp.paidBy === 'Parent 1') {
          map[exp.category].p2Share += exp.amount;
        } else {
          map[exp.category].p1Share += exp.amount;
        }
      } else {
        const split = customSplits.find((s) => s.categories.includes(exp.category));
        const p1Pct = split ? split.split['Parent 1'] / 100 : 0.5;
        const p2Pct = 1 - p1Pct;
        map[exp.category].p1Share += exp.amount * p1Pct;
        map[exp.category].p2Share += exp.amount * p2Pct;
      }
    }

    // Include Child Support as a category if configured
    if (isCsConfigured) {
      totalSpend += csAmount;
      if (!map['Child Support']) {
        map['Child Support'] = { total: 0, count: 0, p1Share: 0, p2Share: 0 };
      }
      map['Child Support'].total += csAmount;
      map['Child Support'].count += 1;
      if (csPayer === 'Parent 1') {
        map['Child Support'].p1Share += csAmount;
      } else if (csPayer === 'Parent 2') {
        map['Child Support'].p2Share += csAmount;
      }
    }

    const list = Object.keys(map).map((catName) => {
      const item = map[catName];
      const pct = totalSpend > 0 ? (item.total / totalSpend) * 100 : 0;
      const p1Pct = item.total > 0 ? Math.round((item.p1Share / item.total) * 100) : 50;
      const p2Pct = 100 - p1Pct;
      return {
        name: catName,
        total: item.total,
        count: item.count,
        p1Share: item.p1Share,
        p2Share: item.p2Share,
        pct,
        p1Pct,
        p2Pct,
        color: CATEGORY_COLORS[catName] || '#6c5ce7',
      };
    });

    list.sort((a, b) => b.total - a.total);

    return { categoriesList: list, totalMonthSpend: totalSpend };
  }, [expenses, customSplits, isCsConfigured, csAmount, csPayer]);

  // Handler for Settle All
  const handleSettleAll = () => {
    setIsSettling(true);

    const settledExpenses = expenses.map((e) => ({
      ...e,
      status: 'Settled' as const,
    }));

    const updatedChildSupport = {
      ...childSupport,
      status: 'Settled' as const,
    };

    batchUpdateMonths({
      [monthId]: {
        expenses: settledExpenses,
        childSupport: updatedChildSupport,
      },
    });

    setIsSettling(false);
    toast({
      title: 'Month Settled',
      description: `All ${unsettledItemsCount} unsettled transactions marked as Settled.`,
    });
  };

  const handleJumpToExpenses = () => {
    if (setActiveTab) {
      setActiveTab('expenses');
    } else if (handleGoToUnsettled) {
      handleGoToUnsettled(monthId);
    }
  };

  const handleJumpToSettings = () => {
    if (setActiveTab) {
      setActiveTab('settings');
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* 1. Missing Child Support Alert Banner */}
      {!isCsConfigured && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full ml-2">
            <div>
              <AlertTitle className="font-semibold text-sm">
                Child Support Not Logged for {monthName}
              </AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground mt-0.5">
                No monthly payer or amount is assigned to this month in your settings.
              </AlertDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400/50 hover:bg-amber-500/20 text-xs shrink-0 font-medium"
              onClick={handleJumpToSettings}
            >
              Configure Child Support
            </Button>
          </div>
        </Alert>
      )}

      {/* 2. Hero Settlement Banner */}
      <Card className="border-border shadow-sm overflow-hidden bg-gradient-to-br from-card to-muted/20">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start md:items-center gap-4">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-lg',
                  unsettledItemsCount === 0 || isNetZero
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                )}
              >
                {unsettledItemsCount === 0 || isNetZero ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <Scale className="h-6 w-6" />
                )}
              </div>

              <div>
                <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                  SETTLEMENT STATUS • {monthName.toUpperCase()}
                </div>
                <div className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mt-0.5">
                  {expenses.length === 0 && !isCsConfigured ? (
                    'No Transactions Logged'
                  ) : isEntireMonthSettled ? (
                    isNetZero
                      ? 'Fully Reconciled ($0.00)'
                      : p1Debt >= p2Debt
                      ? `${p1Name} paid ${p2Name} $${netDiff.toFixed(2)}`
                      : `${p2Name} paid ${p1Name} $${netDiff.toFixed(2)}`
                  ) : isNetZero ? (
                    'All Balanced ($0.00)'
                  ) : p1Debt > p2Debt ? (
                    `${p1Name} owes ${p2Name} $${netDiff.toFixed(2)}`
                  ) : (
                    `${p2Name} owes ${p1Name} $${netDiff.toFixed(2)}`
                  )}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1">
                  {expenses.length === 0 && !isCsConfigured ? (
                    'Click Add Expense below to record shared costs for this month.'
                  ) : (
                    <span>
                      {p1Name} Share (<strong>${p1Debt.toFixed(2)}</strong>) − {p2Name} Share (
                      <strong>${p2Debt.toFixed(2)}</strong>) = <strong>${netDiff.toFixed(2)}</strong> Net
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              {unsettledItemsCount > 0 ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs md:text-sm px-4 shadow-sm"
                      disabled={isSettling}
                    >
                      {isSettling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Settle All ({unsettledItemsCount})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Settle All Transactions?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Mark all {unsettledItemsCount} unsettled items in {monthName} as Settled? This
                        will reconcile the current month balance.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSettleAll}>
                        Confirm Settle All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Badge
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3 py-1 gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  All Settled
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Side-by-Side Parent Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parent 1 Pillar */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">
                  {p1Name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-base font-bold">{p1Name}</CardTitle>
                  <CardDescription className="text-xs">Parent 1</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-semibold text-xs bg-muted/40">
                P1
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground text-xs font-medium">Paid Upfront</span>
              <strong className="font-semibold text-foreground">${p1Upfront.toFixed(2)}</strong>
            </div>
            <Separator className="bg-border/60" />
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground text-xs font-medium">
                {isEntireMonthSettled ? 'Paid Share' : 'Owes (Share)'}
              </span>
              <strong className="text-destructive font-semibold">${p1Debt.toFixed(2)}</strong>
            </div>
            <Separator className="bg-border/60" />
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground text-xs font-medium">
                {isEntireMonthSettled ? 'Was Reimbursed' : 'Is Owed'}
              </span>
              <strong className="font-semibold text-foreground">${p2Debt.toFixed(2)}</strong>
            </div>
            <Separator className="bg-border" />
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Month Balance
              </span>
              {isNetZero ? (
                <Badge variant="secondary" className="font-bold text-xs px-2.5 py-1">
                  $0.00
                </Badge>
              ) : p1Debt > p2Debt ? (
                <Badge className="bg-amber-500/15 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 font-bold text-xs px-2.5 py-1">
                  {isEntireMonthSettled ? 'Paid' : 'Owes'} ${netDiff.toFixed(2)}
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 font-bold text-xs px-2.5 py-1">
                  {isEntireMonthSettled ? 'Received' : 'Receives'} ${netDiff.toFixed(2)}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parent 2 Pillar */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                  {p2Name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-base font-bold">{p2Name}</CardTitle>
                  <CardDescription className="text-xs">Parent 2</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-semibold text-xs bg-muted/40">
                P2
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground text-xs font-medium">Paid Upfront</span>
              <strong className="font-semibold text-foreground">${p2Upfront.toFixed(2)}</strong>
            </div>
            <Separator className="bg-border/60" />
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground text-xs font-medium">
                {isEntireMonthSettled ? 'Paid Share' : 'Owes (Share)'}
              </span>
              <strong className="text-destructive font-semibold">${p2Debt.toFixed(2)}</strong>
            </div>
            <Separator className="bg-border/60" />
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground text-xs font-medium">
                {isEntireMonthSettled ? 'Was Reimbursed' : 'Is Owed'}
              </span>
              <strong className="font-semibold text-foreground">${p1Debt.toFixed(2)}</strong>
            </div>
            <Separator className="bg-border" />
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Month Balance
              </span>
              {isNetZero ? (
                <Badge variant="secondary" className="font-bold text-xs px-2.5 py-1">
                  $0.00
                </Badge>
              ) : p2Debt > p1Debt ? (
                <Badge className="bg-amber-500/15 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 font-bold text-xs px-2.5 py-1">
                  {isEntireMonthSettled ? 'Paid' : 'Owes'} ${netDiff.toFixed(2)}
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 font-bold text-xs px-2.5 py-1">
                  {isEntireMonthSettled ? 'Received' : 'Receives'} ${netDiff.toFixed(2)}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. "Where Did The Money Go?" Category Breakdown */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold">Where Did The Money Go?</CardTitle>
              <CardDescription className="text-xs">
                Spending by category for {monthName}
              </CardDescription>
            </div>
            <div>
              <Badge variant="secondary" className="font-semibold text-xs px-3 py-1">
                {categoriesList.length} Categories • ${totalMonthSpend.toFixed(2)}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {categoriesList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <PieChart className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No category records found for this period.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {categoriesList.map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-primary/40 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-bold text-sm text-foreground">{item.name}</span>
                      <span className="text-xs text-muted-foreground font-medium">
                        ({item.count} {item.count === 1 ? 'item' : 'items'})
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="font-extrabold text-sm text-foreground">
                        ${item.total.toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {item.pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Meter */}
                  <div className="w-full h-2 rounded-full bg-secondary/80 overflow-hidden my-2.5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(2, item.pct))}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>

                  {/* Split Info Footer */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <div>
                      {p1Name}: <strong>${item.p1Share.toFixed(2)}</strong> ({item.p1Pct}%) &nbsp;•&nbsp; {p2Name}:{' '}
                      <strong>${item.p2Share.toFixed(2)}</strong> ({item.p2Pct}%)
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs font-semibold text-primary hover:text-primary/80 px-2 gap-1"
                      onClick={handleJumpToExpenses}
                    >
                      View in Expenses
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
