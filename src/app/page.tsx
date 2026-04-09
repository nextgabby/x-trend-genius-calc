'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const WizardApp = dynamic(() => import('@/components/wizard/WizardApp'), {
  ssr: false,
});

const ThresholdAnalysisTool = dynamic(
  () => import('@/components/analysis/ThresholdAnalysisTool'),
  { ssr: false }
);

type Tab = 'wizard' | 'analysis';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('wizard');

  return (
    <div className="w-full px-4 py-6">
      {/* Tab Switcher */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-x-darkgray rounded-full p-1 border border-x-border">
          <button
            onClick={() => setActiveTab('wizard')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeTab === 'wizard'
                ? 'bg-x-blue text-white'
                : 'text-x-gray hover:text-white'
            }`}
          >
            Campaign Setup
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeTab === 'analysis'
                ? 'bg-x-blue text-white'
                : 'text-x-gray hover:text-white'
            }`}
          >
            Threshold Analysis
          </button>
        </div>
      </div>

      {activeTab === 'wizard' ? <WizardApp /> : <ThresholdAnalysisTool />}
    </div>
  );
}
