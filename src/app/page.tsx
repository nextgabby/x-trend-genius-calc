'use client';

import dynamic from 'next/dynamic';

const WizardApp = dynamic(() => import('@/components/wizard/WizardApp'), {
  ssr: false,
});

export default function Home() {
  return <WizardApp />;
}
