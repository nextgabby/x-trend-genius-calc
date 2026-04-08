'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWizard } from '@/context/WizardContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ThresholdChart from '@/components/charts/ThresholdChart';
import { formatNumber, formatDate, recalculateBudget } from '@/lib/utils';

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
    originalThresholdRecommendation,
    setThresholdRecommendation,
    reset,
  } = useWizard();

  const [copied, setCopied] = useState(false);
  const [queryCopied, setQueryCopied] = useState(false);

  const [editOn, setEditOn] = useState<string>('');
  const [editOff, setEditOff] = useState<string>('');
  const [editConsecutive, setEditConsecutive] = useState<string>('');

  useEffect(() => {
    if (thresholdRecommendation) {
      setEditOn(String(thresholdRecommendation.onThreshold));
      setEditOff(String(thresholdRecommendation.offThreshold));
      setEditConsecutive(String(thresholdRecommendation.consecutiveHours));
    }
  }, [thresholdRecommendation]);

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

  if (!thresholdRecommendation || !countsData || !keywordAnalysis || !budget) return null;

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
    estimatedTrendDays: budget.estimatedTrendDays,
    recommendedMaxDailySpend: budget.recommendedMaxDailySpend,
    ...(isModified && originalThresholdRecommendation ? {
      grokOriginal: {
        onThreshold: originalThresholdRecommendation.onThreshold,
        offThreshold: originalThresholdRecommendation.offThreshold,
        consecutiveHours: originalThresholdRecommendation.consecutiveHours,
        estimatedTrendDays: originalThresholdRecommendation.estimatedTrendDays,
        recommendedMaxDailySpend: originalThresholdRecommendation.recommendedMaxDailySpend,
      },
    } : {}),
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

        <div className="grid grid-cols-3 gap-4 mb-4">
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
