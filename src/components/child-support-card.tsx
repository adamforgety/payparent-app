'use client';

import { Landmark } from 'lucide-react';
import { useState, useEffect } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
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
import type { ChildSupport, Parent } from '@/lib/types';

interface ChildSupportCardProps {
  childSupport: ChildSupport;
  onUpdate: (data: ChildSupport) => void;
}

export function ChildSupportCard({
  childSupport,
  onUpdate,
}: ChildSupportCardProps) {
  const [inputValue, setInputValue] = useState<string>(
    childSupport.amount > 0 ? String(childSupport.amount) : ''
  );

  useEffect(() => {
    // Sync local state if prop changes from parent
    setInputValue(childSupport.amount > 0 ? String(childSupport.amount) : '');
  }, [childSupport.amount]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Convert to number for state update
    const amount = Number(value);
    const finalAmount = isNaN(amount) || value === '' ? 0 : amount;
    
    // Update parent immediately
    if (childSupport.amount !== finalAmount) {
      onUpdate({ ...childSupport, amount: finalAmount });
    }
  };

  const handlePayerChange = (value: Parent | 'None') => {
    onUpdate({ ...childSupport, paidBy: value });
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
              <SelectItem value="Parent 1">Parent 1</SelectItem>
              <SelectItem value="Parent 2">Parent 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
