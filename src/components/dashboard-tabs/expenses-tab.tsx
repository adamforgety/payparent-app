import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExpensesCard } from '@/components/expenses-card';
import { AllUnsettledExpensesCard } from '@/components/all-unsettled-expenses-card';
import type { AppData, MonthData, Expense, ChildSupport } from '@/lib/types';

interface ExpensesTabProps {
  expensesSubTab: string;
  setExpensesSubTab: (tab: string) => void;
  expenses: Expense[];
  currentMonthData: MonthData;
  monthId: string;
  handleDeleteExpense: (expenseId: string, monthId: string) => void;
  handleUpdateExpense: (updatedExpense: Expense, originalMonthId: string) => void;
  updateChildSupportForSingleMonth: (updatedChildSupport: ChildSupport, monthId: string) => void;
  currentDate: Date;
  appData: AppData;
  isAllMonthsView: boolean;
  setIsAllMonthsView: (val: boolean) => void;
}

export function ExpensesTab({
  expensesSubTab,
  setExpensesSubTab,
  expenses,
  currentMonthData,
  monthId,
  handleDeleteExpense,
  handleUpdateExpense,
  updateChildSupportForSingleMonth,
  currentDate,
  appData,
  isAllMonthsView,
  setIsAllMonthsView,
}: ExpensesTabProps) {
  return (
    <div className="mt-6">
      <Tabs value={expensesSubTab} onValueChange={setExpensesSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monthly" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Monthly Ledger</TabsTrigger>
          <TabsTrigger value="unsettled" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All Unsettled</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly" className="mt-6">
          <ExpensesCard
            expenses={expenses}
            childSupport={currentMonthData.childSupport}
            customSplits={currentMonthData.customSplits}
            onDelete={(expenseId) => handleDeleteExpense(expenseId, monthId)}
            onUpdateExpense={handleUpdateExpense}
            onUpdateChildSupport={(cs) => updateChildSupportForSingleMonth(cs, monthId)}
            currentDate={currentDate}
            parentNames={currentMonthData.parentNames}
            appData={appData}
          />
        </TabsContent>
        <TabsContent value="unsettled" className="mt-6">
          <AllUnsettledExpensesCard 
            appData={appData}
            onUpdateExpense={handleUpdateExpense}
            onUpdateChildSupport={updateChildSupportForSingleMonth}
            onDeleteExpense={handleDeleteExpense}
            currentDate={currentDate}
            isAllMonthsView={isAllMonthsView}
            setIsAllMonthsView={setIsAllMonthsView}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
