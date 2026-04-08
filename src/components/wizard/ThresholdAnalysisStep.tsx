'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWizard } from '@/context/WizardContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ThresholdChart from '@/components/charts/ThresholdChart';
import { formatNumber, recalculateBudget } from '@/lib/utils';

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function ThresholdAnalysisStep() {
  const {
    approvedQuery,
    keywordAnalysis,
    campaignInput,
    countsData,
    thresholdRecommendation,
    originalThresholdRecommendation,
    setThresholdRecommendation,
    setOriginalThresholdRecommendation,
    isLoading,
    setIsLoading,
    error,
    setError,
    nextStep,
    prevStep,
  } = useWizard();

  const [editOn, setEditOn] = useState<string>('');
  const [editOff, setEditOff] = useState<string>('');
  const [editConsecutive, setEditConsecutive] = useState<string>('');

  // Sync local edit state when recommendation loads
  useEffect(() => {
    if (thresholdRecommendation) {
      setEditOn(String(thresholdRecommendation.onThreshold));
      setEditOff(String(thresholdRecommendation.offThreshold));
      setEditConsecutive(String(thresholdRecommendation.consecutiveHours));
    }
  }, [thresholdRecommendation]);

  useEffect(() => {
    if (thresholdRecommendation) return;

    async function calculateThresholds() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/calculate-thresholds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: approvedQuery,
            data: countsData?.data,
            seasonality: keywordAnalysis?.seasonality || 'non-seasonal',
            campaignStartDate: campaignInput.campaignStartDate,
            campaignEndDate: campaignInput.campaignEndDate,
            totalBudget: campaignInput.totalBudget,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Threshold calculation failed');
        }

        const result = await res.json();
        setThresholdRecommendation(result);
        setOriginalThresholdRecommendation(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Threshold calculation failed');
      } finally {
        setIsLoading(false);
      }
    }

    calculateThresholds();
  }, [approvedQuery, keywordAnalysis, campaignInput, countsData, thresholdRecommendation, setThresholdRecommendation, setOriginalThresholdRecommendation, setIsLoading, setError]);

  const campaignDays = useMemo(() => {
    const start = new Date(campaignInput.campaignStartDate);
    const end = new Date(campaignInput.campaignEndDate);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [campaignInput.campaignStartDate, campaignInput.campaignEndDate]);

  const totalDaysInData = useMemo(() => {
    if (!countsData) return 0;
    const days = new Set(countsData.data.map((d) => d.timestamp.split('T')[0]));
    return days.size;
  }, [countsData]);

  // Recalculate budget when thresholds change
  const budget = useMemo(() => {
    if (!countsData || !thresholdRecommendation) return null;
    return recalculateBudget(
      countsData.data,
      thresholdRecommendation.onThreshold,
      campaignInput.totalBudget,
      campaignDays,
      totalDaysInData
    );
  }, [countsData, thresholdRecommendation, campaignInput.totalBudget, campaignDays, totalDaysInData]);

  const isModified = originalThresholdRecommendation && thresholdRecommendation && (
    thresholdRecommendation.onThreshold !== originalThresholdRecommendation.onThreshold ||
    thresholdRecommendation.offThreshold !== originalThresholdRecommendation.offThreshold ||
    thresholdRecommendation.consecutiveHours !== originalThresholdRecommendation.consecutiveHours
  );

  function applyThresholdEdit(field: 'on' | 'off' | 'consecutive', rawValue: string) {
    if (!thresholdRecommendation || !countsData) return;
    const value = Number(rawValue);
    if (isNaN(value) || value < 0) return;

    const updated = { ...thresholdRecommendation };
    if (field === 'on') updated.onThreshold = value;
    if (field === 'off') updated.offThreshold = value;
    if (field === 'consecutive') updated.consecutiveHours = value;

    const newBudget = recalculateBudget(
      countsData.data,
      updated.onThreshold,
      campaignInput.totalBudget,
      campaignDays,
      totalDaysInData
    );
    updated.estimatedTrendDays = newBudget.estimatedTrendDays;
    updated.recommendedMaxDailySpend = newBudget.recommendedMaxDailySpend;

    setThresholdRecommendation(updated);
  }

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner message="Grok is analyzing thresholds..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={prevStep}>Back</Button>
            <Button onClick={() => { setThresholdRecommendation(null as unknown as Parameters<typeof setThresholdRecommendation>[0]); setError(null); }}>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!thresholdRecommendation || !countsData || !budget) return null;

  const confidenceBadge = {
    high: 'success' as const,
    medium: 'warning' as const,
    low: 'error' as const,
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-white">Threshold Recommendations</h2>
        <Badge variant={confidenceBadge[thresholdRecommendation.confidence]}>
          {thresholdRecommendation.confidence} confidence
        </Badge>
      </div>
      <p className="text-x-gray text-sm mb-6">
        Grok has analyzed the data and recommends the following thresholds. Edit values below to adjust.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-black rounded-xl p-4 border border-[#00BA7C]/30">
          <p className="text-[#00BA7C] text-xs font-medium mb-1">ON Threshold</p>
          <input
            type="number"
            value={editOn}
            onChange={(e) => setEditOn(e.target.value)}
            onBlur={() => applyThresholdEdit('on', editOn)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyThresholdEdit('on', editOn); }}
            className="bg-transparent text-white text-2xl font-bold w-full outline-none border-b border-[#00BA7C]/40 focus:border-[#00BA7C] pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <p className="text-x-gray text-xs mt-1">posts/hour</p>
          {originalThresholdRecommendation && (
            <p className="text-x-gray text-[10px] mt-1">Grok: {formatNumber(originalThresholdRecommendation.onThreshold)}</p>
          )}
        </div>
        <div className="bg-black rounded-xl p-4 border border-[#F4212E]/30">
          <p className="text-[#F4212E] text-xs font-medium mb-1">OFF Threshold</p>
          <input
            type="number"
            value={editOff}
            onChange={(e) => setEditOff(e.target.value)}
            onBlur={() => applyThresholdEdit('off', editOff)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyThresholdEdit('off', editOff); }}
            className="bg-transparent text-white text-2xl font-bold w-full outline-none border-b border-[#F4212E]/40 focus:border-[#F4212E] pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <p className="text-x-gray text-xs mt-1">posts/hour</p>
          {originalThresholdRecommendation && (
            <p className="text-x-gray text-[10px] mt-1">Grok: {formatNumber(originalThresholdRecommendation.offThreshold)}</p>
          )}
        </div>
        <div className="bg-black rounded-xl p-4 border border-x-border">
          <p className="text-x-blue text-xs font-medium mb-1">Consecutive Hours</p>
          <input
            type="number"
            value={editConsecutive}
            onChange={(e) => setEditConsecutive(e.target.value)}
            onBlur={() => applyThresholdEdit('consecutive', editConsecutive)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyThresholdEdit('consecutive', editConsecutive); }}
            className="bg-transparent text-white text-2xl font-bold w-full outline-none border-b border-x-blue/40 focus:border-x-blue pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <p className="text-x-gray text-xs mt-1">before trigger</p>
          {originalThresholdRecommendation && (
            <p className="text-x-gray text-[10px] mt-1">Grok: {originalThresholdRecommendation.consecutiveHours}</p>
          )}
        </div>
      </div>

      {isModified && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[#1D9BF0]/10 border border-[#1D9BF0]/20">
          <span className="text-x-blue text-xs">Thresholds modified from Grok recommendation. Budget recalculated.</span>
          <button
            onClick={() => {
              if (!originalThresholdRecommendation) return;
              setThresholdRecommendation(originalThresholdRecommendation);
              setEditOn(String(originalThresholdRecommendation.onThreshold));
              setEditOff(String(originalThresholdRecommendation.offThreshold));
              setEditConsecutive(String(originalThresholdRecommendation.consecutiveHours));
            }}
            className="text-x-blue text-xs underline hover:text-x-blue/80 ml-auto whitespace-nowrap"
          >
            Reset to Grok
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-black rounded-xl p-4 border border-x-blue/30">
          <p className="text-x-blue text-xs font-medium mb-1">Total Budget</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(campaignInput.totalBudget)}</p>
        </div>
        <div className="bg-black rounded-xl p-4 border border-x-blue/30">
          <p className="text-x-blue text-xs font-medium mb-1">Est. Trend Days</p>
          <p className="text-white text-2xl font-bold">{budget.estimatedTrendDays}</p>
          <p className="text-x-gray text-xs">days above threshold</p>
          {isModified && originalThresholdRecommendation && (
            <p className="text-x-gray text-[10px] mt-1">Grok: {originalThresholdRecommendation.estimatedTrendDays}</p>
          )}
        </div>
        <div className="bg-black rounded-xl p-4 border border-[#00BA7C]/30">
          <p className="text-[#00BA7C] text-xs font-medium mb-1">Max Daily Spend</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(budget.recommendedMaxDailySpend)}</p>
          <p className="text-x-gray text-xs">recommended cap</p>
          {isModified && originalThresholdRecommendation && (
            <p className="text-x-gray text-[10px] mt-1">Grok: {formatCurrency(originalThresholdRecommendation.recommendedMaxDailySpend)}</p>
          )}
        </div>
      </div>

      <div className="bg-black rounded-xl border border-x-border p-4 mb-4">
        <ThresholdChart
          data={countsData.data}
          onThreshold={thresholdRecommendation.onThreshold}
          offThreshold={thresholdRecommendation.offThreshold}
        />
      </div>

      <div className="space-y-3 mb-6">
        <div>
          <span className="text-sm font-medium text-x-lightgray">Reasoning</span>
          <p className="text-x-gray text-sm mt-1">{thresholdRecommendation.reasoning}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-x-lightgray">Budget Allocation</span>
          <p className="text-x-gray text-sm mt-1">{thresholdRecommendation.budgetReasoning}</p>
        </div>
        {thresholdRecommendation.peakHours.length > 0 && (
          <div>
            <span className="text-sm font-medium text-x-lightgray">Typical Peak Hours</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {thresholdRecommendation.peakHours.map((h) => (
                <Badge key={h}>{h}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4 border-t border-x-border">
        <Button variant="secondary" onClick={prevStep}>Back</Button>
        <Button onClick={nextStep} size="lg">
          View Results
        </Button>
      </div>
    </Card>
  );
}
