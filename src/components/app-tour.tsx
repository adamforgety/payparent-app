'use client';

import React from 'react';
import { Joyride, CallBackProps, STATUS, Step } from 'react-joyride';
import { useAppContext } from '@/context/app-context';

interface AppTourProps {
  setActiveTab: (tab: string) => void;
}

export function AppTour({ setActiveTab }: AppTourProps) {
  const { runTour, setRunTour } = useAppContext();

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to PayParent! Let\'s take a quick look around.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#tour-month-selector',
      content: 'Select the month you want to view or edit.',
      placement: 'bottom',
    },
    {
      target: '#tour-bottom-nav',
      content: 'Navigate between your Dashboard, Expenses, Reporting, and Settings.',
      placement: 'top',
    },
    {
      target: '#tour-add-expense',
      content: 'Click here to log a new expense. You can also download the Excel template and upload bulk transactions here.',
      placement: 'top',
    },
    {
      target: '#tour-settings-tab',
      content: 'We will head to Settings to configure your account.',
      placement: 'top',
    },
    {
      target: '#tour-account-tab',
      content: 'Click here to set up your display name and find your Co-Parent code to link accounts.',
      placement: 'bottom',
    },
    {
      target: '#tour-child-support-card',
      content: 'Enter the recurring monthly child support amount and who pays it here.',
      placement: 'bottom',
    },
    {
      target: '#tour-help',
      content: 'If you ever need to see this tour again, just click this button. Have a great day!',
      placement: 'bottom',
    }
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index, action } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as string)) {
      setRunTour(false);
      setActiveTab('dashboard'); // Reset to dashboard when done
    }

    // Intercept step before it renders to switch tabs if needed
    if (type === 'step:after') {
        const nextIndex = action === 'next' ? index + 1 : index - 1;
        const nextStep = steps[nextIndex];
        
        if (nextStep?.target === '#tour-account-tab' || nextStep?.target === '#tour-child-support-card' || nextStep?.target === '#tour-settings-tab') {
          setActiveTab('settings');
        } else if (nextStep?.target === '#tour-help' || nextStep?.target === '#tour-month-selector') {
          setActiveTab('dashboard');
        }
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={runTour}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: 'hsl(221.2 83.2% 53.3%)', // Matches tailwind primary
        },
      }}
    />
  );
}
