
'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { Plus, Trash2, PieChart, Settings2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import type {
  CustomSplit,
  Parent,
  ParentNames,
  ExpenseCategory,
  ExpenseSplit,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';

const ALL_CATEGORIES: ExpenseCategory[] = [
  'Medical',
  'Education',
  'Child Care',
  'Activities',
  'Clothing',
  'Food',
  'Other',
];

interface CustomSplitCardProps {
  customSplits: CustomSplit[];
  onUpdate: (data: CustomSplit[]) => void;
  parentNames: ParentNames;
}

export function CustomSplitCard({
  customSplits,
  onUpdate,
  parentNames,
}: CustomSplitCardProps) {
  const [localSplits, setLocalSplits] = useState<CustomSplit[]>(customSplits || []);

  useEffect(() => {
    setLocalSplits(customSplits || []);
  }, [customSplits]);

  const handleAddNewSplit = () => {
    const newSplit: CustomSplit = {
      id: `split-${Date.now()}`,
      name: 'New Split',
      split: { 'Parent 1': 50, 'Parent 2': 50 },
      categories: [],
    };
    onUpdate([...localSplits, newSplit]);
  };

  const handleRemoveSplit = (id: string) => {
    onUpdate(localSplits.filter((split) => split.id !== id));
  };

  const handleSplitChange = (
    id: string,
    parent: Parent,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    const numericValue = parseInt(value, 10);
    const otherParent: Parent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';

    const updatedSplits = localSplits.map((s) => {
      if (s.id === id) {
        if (value === '' || (numericValue >= 0 && numericValue <= 100)) {
          const otherValue = value === '' ? '' : String(100 - numericValue);
          return {
            ...s,
            split: {
              ...s.split,
              [parent]: value,
              [otherParent]: otherValue,
            },
          };
        }
      }
      return s;
    });
    setLocalSplits(updatedSplits);
  };

  const handleSplitBlur = (id: string, parent: Parent) => {
    const split = localSplits.find(s => s.id === id);
    if (!split) return;

    const value = parseInt(String(split.split[parent]), 10);
    const newPercentage = isNaN(value) ? 0 : Math.max(0, Math.min(100, value));

    const otherParent: Parent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';
    const otherPercentage = 100 - newPercentage;

    const updatedSplits = localSplits.map((s) => {
        if(s.id === id) {
            return {
                ...s,
                split: {
                    [parent]: newPercentage,
                    [otherParent]: otherPercentage
                } as ExpenseSplit
            }
        }
        return s;
    });

    onUpdate(updatedSplits);
  };
  
  const handleNameChange = (id: string, newName: string) => {
    const updatedSplits = localSplits.map((s) =>
      s.id === id ? { ...s, name: newName } : s
    );
    setLocalSplits(updatedSplits);
  };
  
  const handleNameBlur = () => {
    onUpdate(localSplits);
  };

  const handleCategoryChange = (
    id: string,
    category: ExpenseCategory,
    checked: boolean
  ) => {
    const updatedSplits = localSplits.map((s) => {
      if (s.id === id) {
        const newCategories = checked
          ? [...s.categories, category]
          : s.categories.filter((c) => c !== category);
        return { ...s, categories: newCategories };
      } else {
        // Ensure category is removed from other splits if it's being added to this one
        if (checked) {
            return { ...s, categories: s.categories.filter(c => c !== category) };
        }
      }
      return s;
    });
    onUpdate(updatedSplits);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <PieChart className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>Custom Expense Splits</CardTitle>
            <CardDescription>
              Create and manage how different expense categories are split.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={(localSplits || []).map(s => s.id)} className="w-full">
          {(localSplits || []).map((split) => (
            <AccordionItem value={split.id} key={split.id}>
              <AccordionTrigger>
                <div className='flex justify-between items-center w-full pr-4'>
                    <Input
                        value={split.name}
                        onChange={(e) => handleNameChange(split.id, e.target.value)}
                        onBlur={handleNameBlur}
                        onClick={(e) => e.stopPropagation()}
                        className="text-base font-semibold border-none focus-visible:ring-1 focus-visible:ring-ring p-1 h-auto"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSplit(split.id);
                      }}
                      disabled={localSplits.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`split-${split.id}-p1`}>
                        {parentNames['Parent 1']} (%)
                      </Label>
                      <Input
                        id={`split-${split.id}-p1`}
                        type="number"
                        value={split.split['Parent 1']}
                        onChange={(e) => handleSplitChange(split.id, 'Parent 1', e)}
                        onBlur={() => handleSplitBlur(split.id, 'Parent 1')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`split-${split.id}-p2`}>
                        {parentNames['Parent 2']} (%)
                      </Label>
                      <Input
                        id={`split-${split.id}-p2`}
                        type="number"
                        value={split.split['Parent 2']}
                        onChange={(e) => handleSplitChange(split.id, 'Parent 2', e)}
                        onBlur={() => handleSplitBlur(split.id, 'Parent 2')}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <Label className="font-medium">Assigned Categories</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Select which categories this split applies to.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_CATEGORIES.map((category) => (
                        <div
                          key={category}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`check-${split.id}-${category}`}
                            checked={split.categories.includes(category)}
                            onCheckedChange={(checked) =>
                              handleCategoryChange(split.id, category, !!checked)
                            }
                          />
                          <label
                            htmlFor={`check-${split.id}-${category}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {category}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={handleAddNewSplit}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Split
        </Button>
      </CardFooter>
    </Card>
  );
}
