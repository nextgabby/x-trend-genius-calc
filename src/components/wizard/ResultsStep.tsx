'use client';

import { useState } from 'react';
import { useWizard } from '@/context/WizardContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ThresholdChart from '@/components/charts/ThresholdChart';
import { formatNumber, formatDate } from '@/lib/utils';

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function ResultsStep() {
  const {
    campaignInput,
    approvedQuery,
    keywordAnalysis,
    countsData,
    thresholdRecommendation,
    reset,
  } = useWizard();

  const [copied, setCopied] = useState(false);
  const [queryCopied, setQueryCopied] = useState(false);

  if (!thresholdRecommendation || !countsData || !keywordAnalysis) return null;

  const configSummary: Record<string, unknown> = {
    handle: `@${campaignInput.handle}`,
    campaignDates: `${campaignInput.campaignStartDate} to ${campaignInput.campaignEndDate}`,
    query: approvedQuery,
    ...(keywordAnalysis.lookbackQuery && keywordAnalysis.lookbackQuery !== approvedQuery
      ? { lookbackQuery: keywordAnalysis.lookbackQuery }
      : {}),
    seasonality: keywordAnalysis.seasonality,
    onThreshold: thresholdRecommendation.onThreshold,
    offThreshold: thresholdRecommendation.offThreshold,
    consecutiveHours: thresholdRecommendation.consecutiveHours,
    confidence: thresholdRecommendation.confidence,
    avgHourlyVolume: thresholdRecommendation.avgHourlyVolume,
    medianHourlyVolume: thresholdRecommendation.medianHourlyVolume,
    totalBudget: campaignInput.totalBudget,
    estimatedTrendDays: thresholdRecommendation.estimatedTrendDays,
    recommendedMaxDailySpend: thresholdRecommendation.recommendedMaxDailySpend,
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(configSummary, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    const headers = 'timestamp,count\n';
    const rows = countsData.data.map((d) => `${d.timestamp},${d.count}`).join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trend-genius-${campaignInput.handle}-data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confidenceBadge = {
    high: 'success' as const,
    medium: 'warning' as const,
    low: 'error' as const,
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Trigger Configuration</h2>
          <Badge variant={confidenceBadge[thresholdRecommendation.confidence]}>
            {thresholdRecommendation.confidence} confidence
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-black rounded-xl p-4 border border-x-border">
            <p className="text-x-gray text-xs">Handle</p>
            <p className="text-white font-semibold">@{campaignInput.handle}</p>
          </div>
          <div className="bg-black rounded-xl p-4 border border-x-border">
            <p className="text-x-gray text-xs">Campaign Period</p>
            <p className="text-white font-semibold text-sm">
              {formatDate(campaignInput.campaignStartDate)} — {formatDate(campaignInput.campaignEndDate)}
            </p>
          </div>
        </div>

        <div className="bg-black rounded-xl p-4 border border-x-border mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-x-gray text-xs">Search Query</p>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(approvedQuery);
                setQueryCopied(true);
                setTimeout(() => setQueryCopied(false), 2000);
              }}
              className="text-x-blue text-xs hover:text-x-blue/80 transition-colors"
            >
              {queryCopied ? 'Copied!' : 'Copy Query'}
            </button>
          </div>
          <pre className="text-white font-mono text-sm whitespace-pre-wrap break-all select-all">{approvedQuery}</pre>
        </div>

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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-black rounded-lg p-3 border border-x-border">
            <p className="text-x-gray text-xs">Avg Volume</p>
            <p className="text-white font-semibold">{formatNumber(thresholdRecommendation.avgHourlyVolume)}/hr</p>
          </div>
          <div className="bg-black rounded-lg p-3 border border-x-border">
            <p className="text-x-gray text-xs">Median Volume</p>
            <p className="text-white font-semibold">{formatNumber(thresholdRecommendation.medianHourlyVolume)}/hr</p>
          </div>
          <div className="bg-black rounded-lg p-3 border border-x-border">
            <p className="text-x-gray text-xs">Std Deviation</p>
            <p className="text-white font-semibold">{formatNumber(thresholdRecommendation.stdDeviation)}</p>
          </div>
          <div className="bg-black rounded-lg p-3 border border-x-border">
            <p className="text-x-gray text-xs">Seasonality</p>
            <p className="text-white font-semibold capitalize">{keywordAnalysis.seasonality}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-white mb-4">Volume with Thresholds</h3>
        <div className="bg-black rounded-xl border border-x-border p-4">
          <ThresholdChart
            data={countsData.data}
            onThreshold={thresholdRecommendation.onThreshold}
            offThreshold={thresholdRecommendation.offThreshold}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-white mb-2">Analysis</h3>
        <p className="text-x-gray text-sm">{thresholdRecommendation.reasoning}</p>
        <div className="mt-3">
          <span className="text-sm font-medium text-x-lightgray">Budget Allocation</span>
          <p className="text-x-gray text-sm mt-1">{thresholdRecommendation.budgetReasoning}</p>
        </div>
        {thresholdRecommendation.peakHours.length > 0 && (
          <div className="mt-3">
            <span className="text-sm font-medium text-x-lightgray">Peak Hours: </span>
            {thresholdRecommendation.peakHours.map((h) => (
              <Badge key={h} variant="default">{h}</Badge>
            ))}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button onClick={handleCopy} variant="primary" size="lg">
          {copied ? 'Copied!' : 'Copy Config JSON'}
        </Button>
        <Button onClick={handleExportCSV} variant="secondary" size="lg">
          Export Data CSV
        </Button>
        <Button onClick={reset} variant="ghost" size="lg">
          Start Over
        </Button>
      </div>
    </div>
  );
}
