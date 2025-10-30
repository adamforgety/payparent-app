'use client';

import { Users } from 'lucide-react';
import { useState, useEffect, type ChangeEvent } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Parent, ParentNames } from '@/lib/types';

interface ParentNamesCardProps {
  parentNames: ParentNames;
  onUpdate: (data: ParentNames) => void;
}

export function ParentNamesCard({
  parentNames,
  onUpdate,
}: ParentNamesCardProps) {
  const [localParentNames, setLocalParentNames] = useState(parentNames);

  useEffect(() => {
    setLocalParentNames(parentNames);
  }, [parentNames]);


  const handleNameChange = (
    parent: Parent,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const newName = e.target.value;
    setLocalParentNames(prev => ({
        ...prev,
        [parent]: newName
    }));
  };

  const handleBlur = () => {
    // Only call the expensive update function when the user is done editing.
    onUpdate(localParentNames);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Users className="h-5 w-5 text-secondary-foreground" />
          </span>
          <div>
            <CardTitle>Parent Names</CardTitle>
            <CardDescription>Customize the display names.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="parent1-name">Parent 1 Name</Label>
          <Input
            id="parent1-name"
            value={localParentNames['Parent 1']}
            onChange={(e) => handleNameChange('Parent 1', e)}
            onBlur={handleBlur}
            placeholder="e.g., Mother, Jane"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="parent2-name">Parent 2 Name</Label>
          <Input
            id="parent2-name"
            value={localParentNames['Parent 2']}
            onChange={(e) => handleNameChange('Parent 2', e)}
            onBlur={handleBlur}
            placeholder="e.g., Father, Joe"
          />
        </div>
      </CardContent>
    </Card>
  );
}
