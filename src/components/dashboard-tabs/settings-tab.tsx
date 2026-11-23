import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ParentNamesCard } from '@/components/parent-names-card';
import { ChildSupportCard } from '@/components/child-support-card';
import { CustomSplitCard } from '@/components/custom-split-card';
import { CoParentLinkCard } from '@/components/co-parent-link-card';
import { AccountSettingsCard } from '@/components/account-settings-card';
import type { MonthData, ParentNames, ChildSupport, CustomSplit } from '@/lib/types';

interface SettingsTabProps {
  settingsSubTab: string;
  setSettingsSubTab: (tab: string) => void;
  currentMonthData: MonthData;
  updateSettingsForCurrentAndFutureMonths: (data: Partial<Omit<MonthData, 'id' | 'year' | 'month'>>) => void;
  currentDate: Date;
}

export function SettingsTab({
  settingsSubTab,
  setSettingsSubTab,
  currentMonthData,
  updateSettingsForCurrentAndFutureMonths,
  currentDate,
}: SettingsTabProps) {
  return (
    <div className="mt-6">
      <Tabs value={settingsSubTab} onValueChange={setSettingsSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="app" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">App Settings</TabsTrigger>
          <TabsTrigger id="tour-account-tab" value="account" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Account Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="app">
          <div className="grid grid-cols-1 gap-6 lg:gap-8 mt-6">
            <ParentNamesCard
              parentNames={currentMonthData.parentNames}
              onUpdate={(parentNames: ParentNames) => updateSettingsForCurrentAndFutureMonths({ parentNames })}
            />
            <div id="tour-child-support-card">
              <ChildSupportCard
                childSupport={currentMonthData.childSupport}
                onUpdate={(cs: ChildSupport) => updateSettingsForCurrentAndFutureMonths({ childSupport: cs })}
                parentNames={currentMonthData.parentNames}
                currentDate={currentDate}
              />
            </div>
            <CustomSplitCard
              customSplits={currentMonthData.customSplits || []}
              onUpdate={(customSplits: CustomSplit[]) => updateSettingsForCurrentAndFutureMonths({ customSplits })}
              parentNames={currentMonthData.parentNames}
            />
          </div>
        </TabsContent>
        <TabsContent value="account">
          <div className="grid grid-cols-1 gap-6 lg:gap-8 mt-6">
            <CoParentLinkCard />
            <AccountSettingsCard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
