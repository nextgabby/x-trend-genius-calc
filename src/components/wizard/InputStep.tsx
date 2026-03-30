'use client';

import { useState } from 'react';
import { useWizard } from '@/context/WizardContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function InputStep() {
  const { campaignInput, setCampaignInput, nextStep } = useWizard();
  const [handle, setHandle] = useState(campaignInput.handle);
  const [startDate, setStartDate] = useState(campaignInput.campaignStartDate);
  const [endDate, setEndDate] = useState(campaignInput.campaignEndDate);
  const [keywordInput, setKeywordInput] = useState(campaignInput.keywords.join(', '));
  const [budget, setBudget] = useState(campaignInput.totalBudget ? campaignInput.totalBudget.toString() : '');
  const [useExact, setUseExact] = useState(campaignInput.useExactKeywords);

  const isValid = handle.trim() && startDate && endDate && keywordInput.trim() && budget && Number(budget) > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const keywords = keywordInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    setCampaignInput({
      handle: handle.replace(/^@/, ''),
      campaignStartDate: startDate,
      campaignEndDate: endDate,
      keywords,
      totalBudget: Number(budget),
      useExactKeywords: useExact,
    });

    nextStep();
  };

  return (
    <Card>
      <h2 className="text-xl font-bold text-white mb-1">Campaign Details</h2>
      <p className="text-x-gray text-sm mb-6">
        Enter your campaign information to get started with threshold calculations.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="handle" className="block text-sm font-medium text-x-lightgray mb-1.5">
            X Handle
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-x-gray">@</span>
            <input
              id="handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="brand_handle"
              className="w-full bg-black border border-x-border rounded-lg pl-8 pr-3 py-2.5 text-white placeholder-x-gray focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-x-lightgray mb-1.5">
              Campaign Start
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-black border border-x-border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue [color-scheme:dark]"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-x-lightgray mb-1.5">
              Campaign End
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-black border border-x-border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue [color-scheme:dark]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="keywords" className="block text-sm font-medium text-x-lightgray mb-1.5">
            Keywords / Topics
          </label>
          <textarea
            id="keywords"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="NFL, football, Super Bowl, touchdown"
            rows={3}
            className="w-full bg-black border border-x-border rounded-lg px-3 py-2.5 text-white placeholder-x-gray focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue resize-none"
          />
          <p className="text-x-gray text-xs mt-1">Separate multiple keywords with commas</p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setUseExact(false)}
            className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
              !useExact
                ? 'border-x-blue bg-x-blue/10 text-white'
                : 'border-x-border bg-black text-x-gray hover:border-x-gray'
            }`}
          >
            <p className="text-sm font-semibold">Let Grok optimize</p>
            <p className="text-xs mt-0.5 opacity-70">Grok expands keywords with variations, hashtags, and related terms</p>
          </button>
          <button
            type="button"
            onClick={() => setUseExact(true)}
            className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
              useExact
                ? 'border-x-blue bg-x-blue/10 text-white'
                : 'border-x-border bg-black text-x-gray hover:border-x-gray'
            }`}
          >
            <p className="text-sm font-semibold">Use exact keywords</p>
            <p className="text-xs mt-0.5 opacity-70">Use the keywords above as-is (client-approved terms)</p>
          </button>
        </div>

        <div>
          <label htmlFor="budget" className="block text-sm font-medium text-x-lightgray mb-1.5">
            Total Ad Spend Budget
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-x-gray">$</span>
            <input
              id="budget"
              type="number"
              min="1"
              step="any"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="50,000"
              className="w-full bg-black border border-x-border rounded-lg pl-7 pr-3 py-2.5 text-white placeholder-x-gray focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <p className="text-x-gray text-xs mt-1">Total campaign budget in USD</p>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={!isValid} size="lg">
            Analyze Keywords
          </Button>
        </div>
      </form>
    </Card>
  );
}
