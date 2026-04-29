import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettleBalanceCard } from '@/components/settle-balance-card';
import { SummaryDetailsCard } from '@/components/summary-details-card';
import type { AppData, MonthData, Expense } from '@/lib/types';

interface DashboardTabProps {
  dashboardSubTab: string;
  setDashboardSubTab: (tab: string) => void;
  currentMonthData: MonthData;
  expenses: Expense[];
  appData: AppData;
  monthId: string;
  handleGoToUnsettled: (monthId: string) => void;
}

export function DashboardTab({
  dashboardSubTab,
  setDashboardSubTab,
  currentMonthData,
  expenses,
  appData,
  monthId,
  handleGoToUnsettled,
}: DashboardTabProps) {
  return (
    <div className="mt-6">
      <Tabs value={dashboardSubTab} onValueChange={setDashboardSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger
            value="parent-1"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {currentMonthData.parentNames['Parent 1']}
          </TabsTrigger>
          <TabsTrigger
            value="parent-2"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {currentMonthData.parentNames['Parent 2']}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="parent-1" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="lg:col-span-1">
              <SettleBalanceCard
                parent="Parent 1"
                expenses={expenses}
                customSplits={currentMonthData.customSplits}
                childSupport={currentMonthData.childSupport}
                parentNames={currentMonthData.parentNames}
                appData={appData}
                currentMonthId={monthId}
                onGoToExpenses={handleGoToUnsettled}
              />
            </div>
            <div className="lg:col-span-2">
              <SummaryDetailsCard
                parent="Parent 1"
                expenses={expenses}
                customSplits={currentMonthData.customSplits}
                childSupport={currentMonthData.childSupport}
                parentNames={currentMonthData.parentNames}
                appData={appData}
                currentMonthId={monthId}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="parent-2" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="lg:col-span-1">
              <SettleBalanceCard
                parent="Parent 2"
                expenses={expenses}
                customSplits={currentMonthData.customSplits}
                childSupport={currentMonthData.childSupport}
                parentNames={currentMonthData.parentNames}
                appData={appData}
                currentMonthId={monthId}
                onGoToExpenses={handleGoToUnsettled}
              />
            </div>
            <div className="lg:col-span-2">
              <SummaryDetailsCard
                parent="Parent 2"
                expenses={expenses}
                customSplits={currentMonthData.customSplits}
                childSupport={currentMonthData.childSupport}
                parentNames={currentMonthData.parentNames}
                appData={appData}
                currentMonthId={monthId}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
