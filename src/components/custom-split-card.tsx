'use client';

import { useState, useEffect, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import { Plus, Trash2, Sliders, Tag, Check, Sparkles, RefreshCw, Info, HelpCircle } from 'lucide-react';

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
import { Switch } from '@/components/ui/switch';
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
import {
  DEFAULT_CATEGORIES,
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
    name: '100% Reimbursed',
    split: { 'Parent 1': 0, 'Parent 2': 0 },
    categories: ['Reimbursement'],
    isReimbursement: true,
  },
];

function sanitizeSplits(splits: CustomSplit[]): CustomSplit[] {
  if (!splits || splits.length === 0) return DEFAULT_INITIAL_SPLITS;

  let result = [...splits];

  // If the user's data does not yet have a Reimbursement profile, add one automatically
  const hasReimbursementProfile = result.some(
    (s) => s.isReimbursement || s.name.toLowerCase().includes('reimburse')
  );

  if (!hasReimbursementProfile) {
    result.push({
      id: 'split-reimbursement',
      name: '100% Reimbursed',
      split: { 'Parent 1': 0, 'Parent 2': 0 },
      categories: ['Reimbursement'],
      isReimbursement: true,
    });
  } else {
    // Ensure the reimbursement profile has isReimbursement set to true
    result = result.map((s) =>
      s.name.toLowerCase().includes('reimburse') && s.isReimbursement === undefined
        ? { ...s, isReimbursement: true }
        : s
    );
  }

  // Ensure 'Reimbursement' is mapped to a split profile
  const isReimbursementMapped = result.some(
    (s) => Array.isArray(s.categories) && s.categories.includes('Reimbursement')
  );

  if (!isReimbursementMapped) {
    const reimbProfile = result.find((s) => s.isReimbursement);
    if (reimbProfile) {
      reimbProfile.categories = [...(reimbProfile.categories || []), 'Reimbursement'];
    }
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

  // Compute all available categories from default list + any custom categories in localSplits
  const categoriesList = useMemo(() => {
    const raw = getAllCategories(localSplits);
    return raw.filter((c) => !removedDefaultCategories.includes(c));
  }, [localSplits, removedDefaultCategories]);

  // Find which split profile currently owns a category
  const getAssignedSplitId = (category: string): string => {
    const found = localSplits.find(
      (s) => Array.isArray(s.categories) && s.categories.includes(category as any)
    );
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

  // Toggle Reimbursement Mode on a split profile
  const handleToggleReimbursement = (id: string, isReimb: boolean) => {
    const updated = localSplits.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          isReimbursement: isReimb,
          split: isReimb
            ? { 'Parent 1': 0, 'Parent 2': 0 }
            : { 'Parent 1': 50, 'Parent 2': 50 },
        };
      }
      return s;
    });
    setLocalSplits(updated);
    onUpdate(updated);
    toast({
      title: isReimb ? '100% Reimbursement Enabled' : 'Percentage Split Enabled',
      description: isReimb
        ? 'Categories mapped to this profile will be 100% reimbursed to the upfront paying parent.'
        : 'Categories mapped to this profile will use percentage splits.',
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
        categories: Array.from(
          new Set([...remainingSplits[0].categories, ...orphanCategories])
        ),
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

    // Capitalize first letter if entered lowercase
    const formattedCategory =
      trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    // Target split: if user adds a category named 'Reimbursement' or with 'reimburse', assign to reimbursement split
    const targetSplit =
      formattedCategory.toLowerCase().includes('reimburse')
        ? localSplits.find((s) => s.isReimbursement) || localSplits[0]
        : localSplits[0];

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

    // If it was previously removed from default list, remove from removedDefaultCategories
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
                  Define percentage splits or 100% reimbursement profiles.
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
          {localSplits.map((split) => (
            <div
              key={split.id}
              className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
            >
              <div className="flex flex-col gap-3">
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

                  {/* Percentage Inputs OR 100% Reimbursement Notice */}
                  {split.isReimbursement ? (
                    <div className="w-full sm:w-1/2 flex items-center gap-2 rounded-lg bg-teal-500/10 border border-teal-500/25 px-3.5 py-2 text-xs text-teal-800 dark:text-teal-200">
                      <Check className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                      <div>
                        <span className="font-semibold block">100% to Paying Parent</span>
                        <span className="text-muted-foreground text-[11px]">
                          Whichever parent pays is reimbursed 100% by the other parent.
                        </span>
                      </div>
                    </div>
                  ) : (
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
                  )}

                  {/* Delete Profile button */}
                  <div className="self-end sm:self-center pt-2 sm:pt-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveSplit(split.id)}
                      disabled={localSplits.length <= 1}
                      title={
                        localSplits.length <= 1
                          ? 'At least one split profile is required'
                          : 'Delete split profile'
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Reimbursement Mode Toggle */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`reimb-switch-${split.id}`}
                      checked={split.isReimbursement || false}
                      onCheckedChange={(val) => handleToggleReimbursement(split.id, val)}
                    />
                    <Label
                      htmlFor={`reimb-switch-${split.id}`}
                      className="text-xs font-medium cursor-pointer"
                    >
                      100% Reimbursement profile (payer reimbursed in full)
                    </Label>
                  </div>
                  {split.isReimbursement && (
                    <Badge variant="outline" className="text-[11px] bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30">
                      Reimbursement Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SECTION 2: CATEGORY TO SPLIT MAPPING & ADD CATEGORY */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground">
                <Tag className="h-5 w-5" />
              </span>
              <div>
                <CardTitle>Category to Split Mapping</CardTitle>
                <CardDescription>
                  Assign each expense category to its designated split profile or reimbursement rule.
                </CardDescription>
              </div>
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
                placeholder="e.g. Reimbursement, Sports, Tutoring, Music..."
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
              Tip: You can add a category like &quot;Reimbursement&quot; and assign it to your &quot;100% Reimbursed&quot; split profile below.
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
                            100% Reimbursed
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
                          {localSplits.map((split) => (
                            <SelectItem key={split.id} value={split.id} className="text-xs">
                              <span className="font-semibold">{split.name}</span>{' '}
                              <span className="text-muted-foreground">
                                {split.isReimbursement
                                  ? '(100% to Payer)'
                                  : `(${split.split['Parent 1']}% / ${split.split['Parent 2']}%)`}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Delete Category Button (allowed for all except when it's the very last category) */}
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
