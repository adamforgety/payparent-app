
'use client';

import { Landmark, Calendar, Edit } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ChildSupport, Parent, ParentNames } from '@/lib/types';
import { Button } from './ui/button';
import { format, getYear } from 'date-fns';

interface ChildSupportCardProps {
  childSupport: ChildSupport;
  onUpdate: (data: ChildSupport) => void;
  parentNames: ParentNames;
  currentDate: Date;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function ChildSupportCard({
  childSupport,
  onUpdate,
  parentNames,
  currentDate,
}: ChildSupportCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [amountValue, setAmountValue] = useState<string>(
    childSupport.amount > 0 ? String(childSupport.amount) : ''
  );
  const [monthlyPayer, setMonthlyPayer] = useState(childSupport.monthlyPayer || {});
  
  const initialValueOnFocus = useRef<string>(amountValue);
  const year = getYear(currentDate);

  useEffect(() => {
    setAmountValue(childSupport.amount > 0 ? String(childSupport.amount) : '');
    setMonthlyPayer(childSupport.monthlyPayer || {});
  }, [childSupport]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountValue(e.target.value);
  };
  
  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    initialValueOnFocus.current = e.target.value;
  };
  
  const handleAmountBlur = () => {
    if (amountValue === initialValueOnFocus.current) {
        return;
    }

    const amount = Number(amountValue);
    const finalAmount = isNaN(amount) || amountValue === '' ? 0 : amount;
    
    if (childSupport.amount !== finalAmount) {
      onUpdate({ ...childSupport, amount: finalAmount });
    }
  };

  const handlePayerChange = (month: number, value: Parent | 'None') => {
    setMonthlyPayer(prev => ({
      ...prev,
      [month]: value,
    }));
  };
  
  const handleSetForAll = (value: Parent | 'None') => {
    const newPayers: { [month: number]: Parent | 'None' } = {};
    for (let i = 1; i <= 12; i++) {
      newPayers[i] = value;
    }
    setMonthlyPayer(newPayers);
  };

  const handleSaveChanges = () => {
    onUpdate({ ...childSupport, monthlyPayer });
    setIsDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Landmark className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>Child Support</CardTitle>
            <CardDescription>Set the recurring amount and designate the payer for each month.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="support-amount">Base Monthly Amount ($)</Label>
          <Input
            id="support-amount"
            type="number"
            placeholder="e.g., 500"
            value={amountValue}
            onChange={handleAmountChange}
            onFocus={handleAmountFocus}
            onBlur={handleAmountBlur}
          />
        </div>
        <div className="space-y-2">
           <Label>Monthly Payer Settings</Label>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left">
                <Calendar className="mr-2 h-4 w-4" />
                Set Monthly Payer for {year}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Monthly Child Support Payer for {year}</DialogTitle>
                <DialogDescription>
                  For each month, select which parent is responsible for the child support payment. Select 'None' if no payment is applicable for that month.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 my-4">
                  <Button variant="secondary" size="sm" onClick={() => handleSetForAll('Parent 1')}>Set All to {parentNames['Parent 1']}</Button>
                  <Button variant="secondary" size="sm" onClick={() => handleSetForAll('Parent 2')}>Set All to {parentNames['Parent 2']}</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleSetForAll('None')}>Set All to None</Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto p-1">
                {MONTH_NAMES.map((name, index) => {
                  const month = index + 1;
                  return (
                    <div key={month} className="space-y-2">
                      <Label htmlFor={`payer-month-${month}`}>{name}</Label>
                      <Select
                        value={monthlyPayer[month] || 'None'}
                        onValueChange={(value: Parent | 'None') => handlePayerChange(month, value)}
                      >
                        <SelectTrigger id={`payer-month-${month}`}>
                          <SelectValue placeholder="Select parent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="None">None</SelectItem>
                          <SelectItem value="Parent 1">{parentNames['Parent 1']}</SelectItem>
                          <SelectItem value="Parent 2">{parentNames['Parent 2']}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveChanges}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
