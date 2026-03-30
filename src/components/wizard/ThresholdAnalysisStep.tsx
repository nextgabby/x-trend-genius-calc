'use client';

import { useEffect } from 'react';
import { useWizard } from '@/context/WizardContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ThresholdChart from '@/components/charts/ThresholdChart';
import { formatNumber } from '@/lib/utils';

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
    setThresholdRecommendation,
    isLoading,
    setIsLoading,
    error,
    setError,
    nextStep,
    prevStep,
  } = useWizard();

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Threshold calculation failed');
      } finally {
        setIsLoading(false);
      }
    }

    calculateThresholds();
  }, [approvedQuery, keywordAnalysis, campaignInput, countsData, thresholdRecommendation, setThresholdRecommendation, setIsLoading, setError]);

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

  if (!thresholdRecommendation || !countsData) return null;

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
        Grok has analyzed the data and recommends the following thresholds.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-black rounded-xl p-4 border border-[#00BA7C]/30">
          <p className="text-[#00BA7C] text-xs font-medium mb-1">ON Threshold</p>
          <p className="text-white text-2xl font-bold">{formatNumber(thresholdRecommendation.onThreshold)}</p>
          <p className="text-x-gray text-xs">posts/hour</p>
        </div>
        <div className="bg-black rounded-xl p-4 border border-[#F4212E]/30">
          <p className="text-[#F4212E] text-xs font-medium mb-1">OFF Threshold</p>
          <p className="text-white text-2xl font-bold">{formatNumber(thresholdRecommendation.offThreshold)}</p>
          <p className="text-x-gray text-xs">posts/hour</p>
        </div>
        <div className="bg-black rounded-xl p-4 border border-x-border">
          <p className="text-x-blue text-xs font-medium mb-1">Consecutive Hours</p>
          <p className="text-white text-2xl font-bold">{thresholdRecommendation.consecutiveHours}</p>
          <p className="text-x-gray text-xs">before trigger</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-black rounded-xl p-4 border border-x-blue/30">
          <p className="text-x-blue text-xs font-medium mb-1">Total Budget</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(campaignInput.totalBudget)}</p>
        </div>
        <div className="bg-black rounded-xl p-4 border border-x-blue/30">
          <p className="text-x-blue text-xs font-medium mb-1">Est. Trend Days</p>
          <p className="text-white text-2xl font-bold">{thresholdRecommendation.estimatedTrendDays}</p>
          <p className="text-x-gray text-xs">days above threshold</p>
        </div>
        <div className="bg-black rounded-xl p-4 border border-[#00BA7C]/30">
          <p className="text-[#00BA7C] text-xs font-medium mb-1">Max Daily Spend</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(thresholdRecommendation.recommendedMaxDailySpend)}</p>
          <p className="text-x-gray text-xs">recommended cap</p>
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
