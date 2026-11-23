'use client';

import { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { Plus, Trash2, PieChart, Sliders, Tag, Check, Sparkles } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type {
  CustomSplit,
  Parent,
  ParentNames,
  ExpenseCategory,
  ExpenseSplit,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const ALL_CATEGORIES: ExpenseCategory[] = [
  'Medical',
  'Child Care',
  'Education',
  'Activities',
  'Clothing',
  'Food',
  'Other',
];

const CATEGORY_COLORS: { [key: string]: string } = {
  'Child Care': '#f59e0b',
  'Education': '#10b981',
  'Activities': '#3b82f6',
  'Medical': '#ec4899',
  'Clothing': '#8b5cf6',
  'Food': '#f97316',
  'Other': '#64748b',
};

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
  const { toast } = useToast();
  const [localSplits, setLocalSplits] = useState<CustomSplit[]>(() => {
    if (customSplits && customSplits.length > 0) return customSplits;
    return [
      {
        id: 'split-standard',
        name: 'Standard',
        split: { 'Parent 1': 50, 'Parent 2': 50 },
        categories: ['Activities', 'Clothing', 'Education', 'Food', 'Other'],
      },
      {
        id: 'split-court-mandated',
        name: 'Court-Mandated',
        split: { 'Parent 1': 57, 'Parent 2': 43 },
        categories: ['Medical', 'Child Care'],
      },
    ];
  });

  useEffect(() => {
    if (customSplits && customSplits.length > 0) {
      setLocalSplits(customSplits);
    }
  }, [customSplits]);

  const p1Name = parentNames['Parent 1'] || 'Parent 1';
  const p2Name = parentNames['Parent 2'] || 'Parent 2';

  // Find which split profile currently owns a category
  const getAssignedSplitId = (category: ExpenseCategory): string => {
    const found = localSplits.find((s) => s.categories.includes(category));
    return found ? found.id : localSplits[0]?.id || '';
  };

  // Add a new split profile
  const handleAddNewSplit = () => {
    const newId = `split-${Date.now()}`;
    const newSplit: CustomSplit = {
      id: newId,
      name: `Custom Split ${localSplits.length + 1}`,
      split: { 'Parent 1': 50, 'Parent 2': 50 },
      categories: [],
    };
    const updated = [...localSplits, newSplit];
    setLocalSplits(updated);
    onUpdate(updated);
    toast({
      title: 'Split Profile Created',
      description: `Added "${newSplit.name}". You can now assign categories to it below.`,
    });
  };

  // Remove a split profile
  const handleRemoveSplit = (id: string) => {
    if (localSplits.length <= 1) return;

    const splitToRemove = localSplits.find((s) => s.id === id);
    const orphanCategories = splitToRemove?.categories || [];
    const remainingSplits = localSplits.filter((s) => s.id !== id);

    // Reassign orphan categories to the first remaining split profile
    if (orphanCategories.length > 0 && remainingSplits.length > 0) {
      remainingSplits[0] = {
        ...remainingSplits[0],
        categories: Array.from(new Set([...remainingSplits[0].categories, ...orphanCategories])),
      };
    }

    setLocalSplits(remainingSplits);
    onUpdate(remainingSplits);
    toast({
      title: 'Profile Deleted',
      description: `Removed "${splitToRemove?.name || 'Split'}". Any assigned categories were moved to ${remainingSplits[0]?.name}.`,
    });
  };

  // Change percentage for Parent 1 or Parent 2
  const handleSplitChange = (
    id: string,
    parent: Parent,
    value: string
  ) => {
    const numericValue = parseInt(value, 10);
    const otherParent: Parent = parent === 'Parent 1' ? 'Parent 2' : 'Parent 1';

    const updatedSplits = localSplits.map((s) => {
      if (s.id === id) {
        if (value === '' || (numericValue >= 0 && numericValue <= 100)) {
          const otherValue = value === '' ? 50 : 100 - numericValue;
          return {
            ...s,
            split: {
              ...s.split,
              [parent]: value === '' ? 0 : numericValue,
              [otherParent]: otherValue,
            } as ExpenseSplit,
          };
        }
      }
      return s;
    });

    setLocalSplits(updatedSplits);
  };

  const handleSplitBlur = (id: string) => {
    onUpdate(localSplits);
  };

  // Change split name
  const handleNameChange = (id: string, newName: string) => {
    const updatedSplits = localSplits.map((s) =>
      s.id === id ? { ...s, name: newName } : s
    );
    setLocalSplits(updatedSplits);
  };

  const handleNameBlur = () => {
    onUpdate(localSplits);
  };

  // Assign a category to a split profile via the dropdown selector
  const handleAssignCategory = (category: ExpenseCategory, targetSplitId: string) => {
    const targetSplit = localSplits.find((s) => s.id === targetSplitId);
    if (!targetSplit) return;

    const updatedSplits = localSplits.map((split) => {
      if (split.id === targetSplitId) {
        // Add category to target split if not already there
        const categories = split.categories.includes(category)
          ? split.categories
          : [...split.categories, category];
        return { ...split, categories };
      } else {
        // Remove category from any other split
        return {
          ...split,
          categories: split.categories.filter((c) => c !== category),
        };
      }
    });

    setLocalSplits(updatedSplits);
    onUpdate(updatedSplits);
    toast({
      title: 'Category Assigned',
      description: `${category} is now split using "${targetSplit.name}" (${targetSplit.split['Parent 1']}% / ${targetSplit.split['Parent 2']}%).`,
    });
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: SPLIT PROFILES */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sliders className="h-5 w-5" />
              </span>
              <div>
                <CardTitle>Split Profiles</CardTitle>
                <CardDescription>
                  Define percentage splits (e.g., Court-Mandated 57/43, Standard 50/50).
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddNewSplit} className="gap-1.5 font-medium">
              <Plus className="h-4 w-4" />
              Add Split Profile
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {localSplits.map((split, idx) => (
            <div
              key={split.id}
              className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Profile Name */}
                <div className="w-full sm:w-1/3 space-y-1.5">
                  <Label htmlFor={`name-${split.id}`} className="text-xs font-semibold text-muted-foreground uppercase">
                    Profile Name
                  </Label>
                  <Input
                    id={`name-${split.id}`}
                    value={split.name}
                    onChange={(e) => handleNameChange(split.id, e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder="e.g. Court-Mandated"
                    className="font-medium h-9"
                  />
                </div>

                {/* Percentage Inputs */}
                <div className="grid grid-cols-2 gap-3 w-full sm:w-1/2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`p1-${split.id}`} className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      {p1Name} (%)
                    </Label>
                    <div className="relative">
                      <Input
                        id={`p1-${split.id}`}
                        type="number"
                        min="0"
                        max="100"
                        value={split.split['Parent 1']}
                        onChange={(e) => handleSplitChange(split.id, 'Parent 1', e.target.value)}
                        onBlur={() => handleSplitBlur(split.id)}
                        className="h-9 font-semibold pr-7"
                      />
                      <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-semibold">%</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`p2-${split.id}`} className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {p2Name} (%)
                    </Label>
                    <div className="relative">
                      <Input
                        id={`p2-${split.id}`}
                        type="number"
                        min="0"
                        max="100"
                        value={split.split['Parent 2']}
                        onChange={(e) => handleSplitChange(split.id, 'Parent 2', e.target.value)}
                        onBlur={() => handleSplitBlur(split.id)}
                        className="h-9 font-semibold pr-7"
                      />
                      <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-semibold">%</span>
                    </div>
                  </div>
                </div>

                {/* Delete button */}
                <div className="self-end sm:self-center pt-2 sm:pt-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveSplit(split.id)}
                    disabled={localSplits.length <= 1}
                    title={localSplits.length <= 1 ? "At least one split profile is required" : "Delete split profile"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SECTION 2: CATEGORY TO SPLIT MAPPING (Dropdown selector for every category) */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground">
              <Tag className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Category to Split Mapping</CardTitle>
              <CardDescription>
                Assign each expense category to its designated split profile. New expenses in that category will automatically follow that split.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="divide-y divide-border/60">
            {ALL_CATEGORIES.map((category) => {
              const currentSplitId = getAssignedSplitId(category);
              const activeSplit = localSplits.find((s) => s.id === currentSplitId) || localSplits[0];
              const dotColor = CATEGORY_COLORS[category] || '#6c5ce7';

              return (
                <div
                  key={category}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: dotColor }}
                    />
                    <div>
                      <span className="font-semibold text-sm text-foreground">{category}</span>
                      <p className="text-xs text-muted-foreground">
                        Currently: <span className="font-medium text-foreground">{activeSplit?.name}</span> ({activeSplit?.split['Parent 1']}% {p1Name} / {activeSplit?.split['Parent 2']}% {p2Name})
                      </p>
                    </div>
                  </div>

                  <div className="w-full sm:w-64">
                    <Select
                      value={currentSplitId}
                      onValueChange={(newSplitId) => handleAssignCategory(category, newSplitId)}
                    >
                      <SelectTrigger className="h-9 text-xs font-medium bg-background">
                        <SelectValue placeholder="Select Split Profile" />
                      </SelectTrigger>
                      <SelectContent>
                        {localSplits.map((split) => (
                          <SelectItem key={split.id} value={split.id} className="text-xs">
                            <span className="font-semibold">{split.name}</span>{' '}
                            <span className="text-muted-foreground">
                              ({split.split['Parent 1']}% / {split.split['Parent 2']}%)
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>

        <CardFooter className="bg-muted/20 border-t border-border/60 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>Categories are updated across the current month and future months.</span>
          <Badge variant="outline" className="text-[11px] font-normal">
            Auto-saved
          </Badge>
        </CardFooter>
      </Card>
    </div>
  );
}
