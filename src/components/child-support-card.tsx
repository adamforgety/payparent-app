'use client';

import { Landmark, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Switch } from './ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface ChildSupportCardProps {
  childSupport: ChildSupport;
  onUpdate: (data: ChildSupport) => void;
  parentNames: ParentNames;
}

export function ChildSupportCard({
  childSupport,
  onUpdate,
  parentNames
}: ChildSupportCardProps) {
  const [inputValue, setInputValue] = useState<string>(
    childSupport.amount > 0 ? String(childSupport.amount) : ''
  );

  useEffect(() => {
    // Sync local state if prop changes from parent
    setInputValue(childSupport.amount > 0 ? String(childSupport.amount) : '');
  }, [childSupport.amount]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  const handleAmountBlur = () => {
    const amount = Number(inputValue);
    const finalAmount = isNaN(amount) || inputValue === '' ? 0 : amount;
    
    if (childSupport.amount !== finalAmount) {
      onUpdate({ ...childSupport, amount: finalAmount });
    }
  };

  const handlePayerChange = (value: Parent | 'None') => {
    onUpdate({ ...childSupport, paidBy: value });
  };
  
  const handleIgnoreChange = (checked: boolean) => {
    onUpdate({ ...childSupport, ignored: checked });
  };

  const requiresPayer =
    childSupport.amount > 0 && childSupport.paidBy === 'None';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Landmark className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>Child Support</CardTitle>
            <CardDescription>Monthly recurring amount.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="support-amount">Amount ($)</Label>
          <Input
            id="support-amount"
            type="number"
            placeholder="e.g., 500"
            value={inputValue}
            onChange={handleAmountChange}
            onBlur={handleAmountBlur}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paid-by">Paid By</Label>
          <Select
            onValueChange={handlePayerChange}
            value={childSupport.paidBy ?? 'None'}
          >
            <SelectTrigger
              id="paid-by"
              className={cn(requiresPayer && 'ring-2 ring-destructive')}
            >
              <SelectValue
                placeholder={
                  requiresPayer ? 'Please select a payer' : 'Select parent'
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="None">None</SelectItem>
              <SelectItem value="Parent 1">{parentNames['Parent 1']}</SelectItem>
              <SelectItem value="Parent 2">{parentNames['Parent 2']}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
       <CardFooter className="flex items-center justify-between bg-secondary/30 p-3 rounded-b-lg border-t">
        <div className="flex items-center space-x-2">
          <Switch
            id="ignore-from-total"
            checked={childSupport.ignored}
            onCheckedChange={handleIgnoreChange}
          />
          <Label htmlFor="ignore-from-total" className="text-sm">
            Ignore from totals
          </Label>
        </div>
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                    <p>If checked, this month's child support will be<br/> excluded from all balance calculations.</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );
}
