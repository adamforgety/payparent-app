'use client';

import { HeartPulse } from 'lucide-react';
import { type ChangeEvent, useState, useEffect } from 'react';

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
  const [localSplit, setLocalSplit] = useState({
    'Parent 1': String(expenseSplit['Parent 1']),
    'Parent 2': String(expenseSplit['Parent 2']),
  });

  useEffect(() => {
    setLocalSplit({
      'Parent 1': String(expenseSplit['Parent 1']),
      'Parent 2': String(expenseSplit['Parent 2']),
    });
  }, [expenseSplit]);

  const handleSplitChange = (
    parent: Parent,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    const otherParent: Parent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
    
    const numericValue = parseInt(value, 10);
    
    if (value === '' || (numericValue >= 0 && numericValue <= 100)) {
       const otherValue = value === '' ? '' : String(100 - numericValue);
       setLocalSplit({
          [parent]: value,
          [otherParent]: otherValue,
       } as Record<Parent, string>);
    }
  };

  const handleBlur = (parent: Parent) => {
    const value = parseInt(localSplit[parent], 10);
    const newPercentage = isNaN(value) ? 0 : Math.max(0, Math.min(100, value));

    const otherParent: Parent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
    const otherPercentage = 100 - newPercentage;
    
    if (expenseSplit[parent] !== newPercentage || expenseSplit[otherParent] !== otherPercentage) {
        onUpdate({
            [parent]: newPercentage,
            [otherParent]: otherPercentage,
        } as ExpenseSplit);
    } else {
        // If the value is invalid (e.g. empty) but didn't change the parent's state
        // we need to reset it to the parent state.
         setLocalSplit({
          'Parent 1': String(expenseSplit['Parent 1']),
          'Parent 2': String(expenseSplit['Parent 2']),
        });
    }
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
          <Label htmlFor="parent1-medical-split">{parentNames['Parent 1']} (%)</Label>
          <Input
            id="parent1-medical-split"
            type="number"
            value={localSplit['Parent 1']}
            onChange={(e) => handleSplitChange('Parent 1', e)}
            onBlur={() => handleBlur('Parent 1')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="parent2-medical-split">{parentNames['Parent 2']} (%)</Label>
          <Input
            id="parent2-medical-split"
            type="number"
            value={localSplit['Parent 2']}
            onChange={(e) => handleSplitChange('Parent 2', e)}
            onBlur={() => handleBlur('Parent 2')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
