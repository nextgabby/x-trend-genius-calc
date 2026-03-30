'use client';

import { WizardProvider } from '@/context/WizardContext';
import WizardContainer from './WizardContainer';

export default function WizardApp() {
  return (
    <WizardProvider>
      <WizardContainer />
    </WizardProvider>
  );
}
