'use client';

import { HeartPulse } from 'lucide-react';
import type { ChangeEvent } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ExpenseSplit, Parent, ParentNames } from '@/lib/types';

interface MedicalSplitCardProps {
  expenseSplit: ExpenseSplit;
  onUpdate: (data: ExpenseSplit) => void;
  parentNames: ParentNames;
}

export function MedicalSplitCard({
  expenseSplit,
  onUpdate,
  parentNames,
}: MedicalSplitCardProps) {
  const handleSplitChange = (
    parent: Parent,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(e.target.value, 10);
    const newPercentage = isNaN(value) ? 0 : Math.max(0, Math.min(100, value));

    const otherParent: Parent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';

    onUpdate({
      [parent]: newPercentage,
      [otherParent]: 100 - newPercentage,
    } as ExpenseSplit);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <HeartPulse className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>Medical Expense Split</CardTitle>
            <CardDescription>Split percentage for medical costs.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="parent1-split">{parentNames['Parent 1']} (%)</Label>
          <Input
            id="parent1-split"
            type="number"
            value={expenseSplit['Parent 1']}
            onChange={(e) => handleSplitChange('Parent 1', e)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="parent2-split">{parentNames['Parent 2']} (%)</Label>
          <Input
            id="parent2-split"
            type="number"
            value={expenseSplit['Parent 2']}
            onChange={(e) => handleSplitChange('Parent 2', e)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
