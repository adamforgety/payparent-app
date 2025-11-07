'use client';

import { useState, useEffect } from 'react';
import { X, Share } from 'lucide-react';
import { Button } from './ui/button';

export function AddToHomeScreenPrompt() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };

    const isInStandaloneMode = () =>
      'standalone' in window.navigator && window.navigator.standalone;

    if (isIos() && !isInStandaloneMode()) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-md bg-background border rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-primary/20 text-primary rounded-lg p-2 flex items-center justify-center">
            <Share className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-sm">Add to Home Screen</p>
            <p className="text-xs text-muted-foreground">
              Tap the share button then "Add to Home Screen".
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
