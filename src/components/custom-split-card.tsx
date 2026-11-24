'use client';

import { useState, useEffect, useMemo, type KeyboardEvent } from 'react';
import { Plus, Trash2, Sliders, Tag, Check, RefreshCw } from 'lucide-react';

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
import {
  getAllCategories,
  getCategoryColor,
} from '@/lib/splits';
import { useToast } from '@/hooks/use-toast';

interface CustomSplitCardProps {
  customSplits: CustomSplit[];
  onUpdate: (data: CustomSplit[]) => void;
  parentNames: ParentNames;
}

const DEFAULT_INITIAL_SPLITS: CustomSplit[] = [
  {
    id: 'split-standard',
    name: 'Standard',
    split: { 'Parent 1': 50, 'Parent 2': 50 },
    categories: ['Activities', 'Clothing', 'Education', 'Food', 'Other'],
    isReimbursement: false,
  },
  {
    id: 'split-court-mandated',
    name: 'Court-Mandated',
    split: { 'Parent 1': 57, 'Parent 2': 43 },
    categories: ['Medical', 'Child Care'],
    isReimbursement: false,
  },
  {
    id: 'split-reimbursement',
    name: 'Reimbursement',
    split: { 'Parent 1': 0, 'Parent 2': 0 },
    categories: ['Reimbursement'],
    isReimbursement: true,
  },
];

function sanitizeSplits(splits: CustomSplit[]): CustomSplit[] {
  if (!splits || splits.length === 0) return DEFAULT_INITIAL_SPLITS;

  let result = splits.map((s) => {
    const isReimb =
      s.isReimbursement ||
      s.name.toLowerCase().includes('reimburse') ||
      s.name.toLowerCase().includes('reconcil');
    return {
      ...s,
      name:
        s.name === '100% Reimbursed' || s.name.toLowerCase() === 'reconciliation'
          ? 'Reimbursement'
          : s.name,
      isReimbursement: isReimb,
      categories: (s.categories || []).filter((c) => c !== 'Reconciliation'),
    };
  });

  const hasReimbursement = result.some((s) => s.isReimbursement);

  if (!hasReimbursement) {
    result.push({
      id: 'split-reimbursement',
      name: 'Reimbursement',
      split: { 'Parent 1': 0, 'Parent 2': 0 },
      categories: ['Reimbursement'],
      isReimbursement: true,
    });
  } else {
    // Ensure Reimbursement is in the reimbursement profile's categories
    const reimbProfile = result.find((s) => s.isReimbursement)!;
    const cats = new Set(reimbProfile.categories || []);
    cats.delete('Reconciliation');
    cats.add('Reimbursement');
    reimbProfile.categories = Array.from(cats);
  }

  return result;
}

export function CustomSplitCard({
  customSplits,
  onUpdate,
  parentNames,
}: CustomSplitCardProps) {
  const { toast } = useToast();

  const [localSplits, setLocalSplits] = useState<CustomSplit[]>(() =>
    sanitizeSplits(customSplits)
  );

  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [removedDefaultCategories, setRemovedDefaultCategories] = useState<string[]>([]);

  useEffect(() => {
    if (customSplits && customSplits.length > 0) {
      setLocalSplits(sanitizeSplits(customSplits));
    }
  }, [customSplits]);

  const p1Name = parentNames['Parent 1'] || 'Parent 1';
  const p2Name = parentNames['Parent 2'] || 'Parent 2';

  // Percentage-based profiles only
  const percentageSplits = useMemo(() => {
    return localSplits.filter((s) => !s.isReimbursement);
  }, [localSplits]);

  // Dedicated reimbursement profile
  const reimbursementSplit = useMemo(() => {
    return (
      localSplits.find((s) => s.isReimbursement) || {
        id: 'split-reimbursement',
        name: 'Reimbursement',
        split: { 'Parent 1': 0, 'Parent 2': 0 },
        categories: ['Reimbursement'],
        isReimbursement: true,
      }
    );
  }, [localSplits]);

  // Compute all available categories from default list + any in localSplits
  const categoriesList = useMemo(() => {
    const raw = getAllCategories(localSplits);
    return raw.filter(
      (c) => c !== 'Reconciliation' && !removedDefaultCategories.includes(c)
    );
  }, [localSplits, removedDefaultCategories]);

  // Find which split profile currently owns a category
  const getAssignedSplitId = (category: string): string => {
    const found = localSplits.find(
      (s) => Array.isArray(s.categories) && s.categories.includes(category as any)
    );
    return found ? found.id : localSplits[0]?.id || '';
  };

  // Add a new percentage split profile
  const handleAddNewSplit = () => {
    const newId = `split-${Date.now()}`;
    const newSplit: CustomSplit = {
      id: newId,
      name: `Custom Split ${percentageSplits.length + 1}`,
      split: { 'Parent 1': 50, 'Parent 2': 50 },
      categories: [],
      isReimbursement: false,
    };
    const updated = [...localSplits, newSplit];
    setLocalSplits(updated);
    onUpdate(updated);
    toast({
      title: 'Split Profile Created',
      description: `Added "${newSplit.name}". You can now assign categories to it below.`,
    });
  };

  // Remove a percentage split profile
  const handleRemoveSplit = (id: string) => {
    if (percentageSplits.length <= 1) return;

    const splitToRemove = localSplits.find((s) => s.id === id);
    const orphanCategories = splitToRemove?.categories || [];
    const remainingSplits = localSplits.filter((s) => s.id !== id);

    // Reassign orphan categories to the first remaining percentage split profile
    const firstRemaining = remainingSplits.find((s) => !s.isReimbursement);
    if (orphanCategories.length > 0 && firstRemaining) {
      firstRemaining.categories = Array.from(
        new Set([...firstRemaining.categories, ...orphanCategories])
      );
    }

    setLocalSplits(remainingSplits);
    onUpdate(remainingSplits);
    toast({
      title: 'Profile Deleted',
      description: `Removed "${splitToRemove?.name || 'Split'}". Any assigned categories were moved to ${firstRemaining?.name || 'Standard'}.`,
    });
  };

  // Change percentage for Parent 1 or Parent 2
  const handleSplitChange = (id: string, parent: Parent, value: string) => {
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

  const handleSplitBlur = () => {
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
  const handleAssignCategory = (category: string, targetSplitId: string) => {
    const targetSplit = localSplits.find((s) => s.id === targetSplitId);
    if (!targetSplit) return;

    const updatedSplits = localSplits.map((split) => {
      if (split.id === targetSplitId) {
        const categories = split.categories.includes(category as any)
          ? split.categories
          : [...split.categories, category as ExpenseCategory];
        return { ...split, categories };
      } else {
        return {
          ...split,
          categories: split.categories.filter((c) => c !== category),
        };
      }
    });

    setLocalSplits(updatedSplits);
    onUpdate(updatedSplits);

    const splitDesc = targetSplit.isReimbursement
      ? '100% Reimbursed to Payer'
      : `${targetSplit.split['Parent 1']}% / ${targetSplit.split['Parent 2']}%`;

    toast({
      title: 'Category Assigned',
      description: `"${category}" is now split using "${targetSplit.name}" (${splitDesc}).`,
    });
  };

  // Add a brand new category
  const handleAddNewCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) {
      toast({
        title: 'Category Name Required',
        description: 'Please enter a name for the new category.',
        variant: 'destructive',
      });
      return;
    }

    const exists = categoriesList.some(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast({
        title: 'Category Exists',
        description: `"${trimmed}" is already in your category list.`,
        variant: 'destructive',
      });
      return;
    }

    const formattedCategory =
      trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    // Target split: if user adds a category named 'Reimbursement', assign to reimbursement
    const isReimbursementTarget = formattedCategory
      .toLowerCase()
      .includes('reimburse');

    const targetSplit = isReimbursementTarget
      ? reimbursementSplit
      : percentageSplits[0] || localSplits[0];

    const updatedSplits = localSplits.map((split) => {
      if (split.id === targetSplit.id) {
        return {
          ...split,
          categories: [...split.categories, formattedCategory as ExpenseCategory],
        };
      }
      return split;
    });

    setLocalSplits(updatedSplits);
    onUpdate(updatedSplits);
    setNewCategoryInput('');

    setRemovedDefaultCategories((prev) =>
      prev.filter((c) => c.toLowerCase() !== formattedCategory.toLowerCase())
    );

    const splitDesc = targetSplit.isReimbursement
      ? '100% Reimbursed to Payer'
      : `${targetSplit.split['Parent 1']}% / ${targetSplit.split['Parent 2']}%`;

    toast({
      title: 'Category Created',
      description: `Added "${formattedCategory}" and mapped to "${targetSplit.name}" (${splitDesc}).`,
    });
  };

  const handleCategoryKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewCategory();
    }
  };

  // Delete/remove a category
  const handleDeleteCategory = (category: string) => {
    const updatedSplits = localSplits.map((split) => ({
      ...split,
      categories: split.categories.filter((c) => c !== category),
    }));

    setLocalSplits(updatedSplits);
    onUpdate(updatedSplits);
    setRemovedDefaultCategories((prev) => [...prev, category]);

    toast({
      title: 'Category Removed',
      description: `"${category}" has been removed from category mapping.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: PERCENTAGE SPLIT PROFILES */}
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
                  Define custom percentage splits (e.g., Standard 50/50, Court-Mandated 57/43).
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddNewSplit}
              className="gap-1.5 font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Split Profile
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {percentageSplits.map((split) => (
            <div
              key={split.id}
              className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Profile Name */}
                <div className="w-full sm:w-1/3 space-y-1.5">
                  <Label
                    htmlFor={`name-${split.id}`}
                    className="text-xs font-semibold text-muted-foreground uppercase"
                  >
                    Profile Name
                  </Label>
                  <Input
                    id={`name-${split.id}`}
                    value={split.name}
                    onChange={(e) => handleNameChange(split.id, e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder="e.g. Standard, Court-Mandated"
                    className="font-medium h-9"
                  />
                </div>

                {/* Percentage Inputs */}
                <div className="grid grid-cols-2 gap-3 w-full sm:w-1/2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`p1-${split.id}`}
                      className="text-xs font-semibold text-purple-600 dark:text-purple-400"
                    >
                      {p1Name} (%)
                    </Label>
                    <div className="relative">
                      <Input
                        id={`p1-${split.id}`}
                        type="number"
                        min="0"
                        max="100"
                        value={split.split['Parent 1']}
                        onChange={(e) =>
                          handleSplitChange(split.id, 'Parent 1', e.target.value)
                        }
                        onBlur={handleSplitBlur}
                        className="h-9 font-semibold pr-7"
                      />
                      <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-semibold">
                        %
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`p2-${split.id}`}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400"
                    >
                      {p2Name} (%)
                    </Label>
                    <div className="relative">
                      <Input
                        id={`p2-${split.id}`}
                        type="number"
                        min="0"
                        max="100"
                        value={split.split['Parent 2']}
                        onChange={(e) =>
                          handleSplitChange(split.id, 'Parent 2', e.target.value)
                        }
                        onBlur={handleSplitBlur}
                        className="h-9 font-semibold pr-7"
                      />
                      <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-semibold">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delete Profile button */}
                <div className="self-end sm:self-center pt-2 sm:pt-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveSplit(split.id)}
                    disabled={percentageSplits.length <= 1}
                    title={
                      percentageSplits.length <= 1
                        ? 'At least one percentage split profile is required'
                        : 'Delete split profile'
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SECTION 2: DEDICATED REIMBURSEMENT PROFILE */}
      <Card className="border-teal-500/30 bg-teal-500/5 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300">
                <RefreshCw className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold">Reimbursement Profile</CardTitle>
                  <Badge variant="outline" className="bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30 text-xs">
                    100% Reimbursed
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Dedicated profile for expenses reimbursed 100% back to the upfront paying parent.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-teal-500/20 bg-background/80 p-3.5 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Check className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>100% Reimbursement to Paying Parent</span>
              </div>
              <p className="text-muted-foreground text-[11px] pl-6">
                Whichever parent pays an expense assigned to Reimbursement upfront is reimbursed 100% by the other parent ($0 share to payer, 100% debt to other parent).
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap shrink-0 pl-6 sm:pl-0">
              <span className="text-[11px] text-muted-foreground font-medium">Mapped Categories:</span>
              {(reimbursementSplit.categories || []).map((cat) => (
                <Badge
                  key={cat}
                  variant="outline"
                  className="text-[10px] bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 font-semibold"
                >
                  {cat}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: CATEGORY TO SPLIT MAPPING & ADD CATEGORY */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground">
              <Tag className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Category to Split Mapping</CardTitle>
              <CardDescription>
                Assign each expense category to its designated percentage profile or the Reimbursement profile.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Add Category Input Bar */}
          <div className="rounded-xl border border-dashed border-border p-3.5 bg-muted/20">
            <Label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">
              Add New Category
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                onKeyDown={handleCategoryKeyDown}
                placeholder="e.g. Reimbursement, Tutoring, Sports, Camp..."
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                onClick={handleAddNewCategory}
                className="gap-1.5 shrink-0 h-9 font-medium"
              >
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Tip: You can assign any category to either your percentage profiles (e.g. Standard 50/50) or the Reimbursement profile below.
            </p>
          </div>

          {/* Categories List */}
          <div className="divide-y divide-border/60">
            {categoriesList.map((category) => {
              const currentSplitId = getAssignedSplitId(category);
              const activeSplit =
                localSplits.find((s) => s.id === currentSplitId) || localSplits[0];
              const dotColor = getCategoryColor(category);

              return (
                <div
                  key={category}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: dotColor }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {category}
                        </span>
                        {activeSplit?.isReimbursement && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 font-medium"
                          >
                            Reimbursement (100% to payer)
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Currently:{' '}
                        <span className="font-medium text-foreground">
                          {activeSplit?.name}
                        </span>{' '}
                        {activeSplit?.isReimbursement ? (
                          <span className="text-teal-600 dark:text-teal-400 font-medium">
                            (100% back to payer)
                          </span>
                        ) : (
                          <span>
                            ({activeSplit?.split['Parent 1']}% {p1Name} /{' '}
                            {activeSplit?.split['Parent 2']}% {p2Name})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="w-full sm:w-64">
                      <Select
                        value={currentSplitId}
                        onValueChange={(newSplitId) =>
                          handleAssignCategory(category, newSplitId)
                        }
                      >
                        <SelectTrigger className="h-9 text-xs font-medium bg-background">
                          <SelectValue placeholder="Select Split Profile" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Percentage split profiles */}
                          {percentageSplits.map((split) => (
                            <SelectItem key={split.id} value={split.id} className="text-xs">
                              <span className="font-semibold">{split.name}</span>{' '}
                              <span className="text-muted-foreground">
                                ({split.split['Parent 1']}% / {split.split['Parent 2']}%)
                              </span>
                            </SelectItem>
                          ))}
                          {/* Dedicated Reimbursement profile */}
                          <SelectItem
                            key={reimbursementSplit.id}
                            value={reimbursementSplit.id}
                            className="text-xs font-medium text-teal-700 dark:text-teal-300"
                          >
                            <span className="font-semibold">Reimbursement</span>{' '}
                            <span>(100% to Payer)</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Delete Category Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleDeleteCategory(category)}
                      title={`Remove "${category}"`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>

        <CardFooter className="bg-muted/20 border-t border-border/60 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>Categories and split profiles are automatically synchronized across all months.</span>
          <Badge variant="outline" className="text-[11px] font-normal">
            Auto-saved
          </Badge>
        </CardFooter>
      </Card>
    </div>
  );
}
