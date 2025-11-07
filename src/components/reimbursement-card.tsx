'use client';

import { HandCoins } from 'lucide-react';
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
import type { Reimbursement, Parent, ParentNames } from '@/lib/types';

interface ReimbursementCardProps {
  reimbursement?: Reimbursement; // Make prop optional
  onUpdate: (data: Reimbursement) => void;
  parentNames: ParentNames;
}

const defaultReimbursement: Reimbursement = {
  amount: 0,
  paidBy: 'None',
  status: 'Unsettled',
};

export function ReimbursementCard({
  reimbursement = defaultReimbursement, // Provide a default value
  onUpdate,
  parentNames
}: ReimbursementCardProps) {
  const [inputValue, setInputValue] = useState<string>(
    reimbursement.amount > 0 ? String(reimbursement.amount) : ''
  );

  useEffect(() => {
    // Sync local state if prop changes from parent
    setInputValue(reimbursement.amount > 0 ? String(reimbursement.amount) : '');
  }, [reimbursement.amount]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  const handleAmountBlur = () => {
    const amount = Number(inputValue);
    const finalAmount = isNaN(amount) || inputValue === '' ? 0 : amount;
    
    if (reimbursement.amount !== finalAmount) {
      onUpdate({ ...reimbursement, amount: finalAmount });
    }
  };

  const handlePayerChange = (value: Parent | 'None') => {
    onUpdate({ ...reimbursement, paidBy: value });
  };
  
  const requiresPayer =
    reimbursement.amount > 0 && reimbursement.paidBy === 'None';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <HandCoins className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>Reimbursement</CardTitle>
            <CardDescription>Monthly recurring amount.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reimbursement-amount">Amount ($)</Label>
          <Input
            id="reimbursement-amount"
            type="number"
            placeholder="e.g., 100"
            value={inputValue}
            onChange={handleAmountChange}
            onBlur={handleAmountBlur}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reimbursement-paid-by">Paid By</Label>
          <Select
            onValueChange={handlePayerChange}
            value={reimbursement.paidBy ?? 'None'}
          >
            <SelectTrigger
              id="reimbursement-paid-by"
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
    </Card>
  );
}
