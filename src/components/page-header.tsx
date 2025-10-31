'use client';

import { Download, Sparkles } from 'lucide-react';

import { AiAdviceSheet } from '@/components/ai-advice-sheet';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PageHeaderProps {
  totalExpenses: number;
}

export function PageHeader({
  totalExpenses,
}: PageHeaderProps) {

  const handlePrint = () => {
    window.print();
  };

  return (
    <header className="no-print sticky top-0 z-10 border-b bg-background/80 p-4 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <AiAdviceSheet currentMonthlyExpenses={totalExpenses}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Sparkles className="h-4 w-4" />
                      <span className="sr-only">Smart Budgeting Advice</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Smart Budgeting Advice</p>
                  </TooltipContent>
                </Tooltip>
              </AiAdviceSheet>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrint}
                    aria-label="Export Monthly Report"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export Monthly Report</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </header>
  );
}
