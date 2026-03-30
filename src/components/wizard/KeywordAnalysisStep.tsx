'use client';

import { useEffect, useState, useRef } from 'react';
import { useWizard } from '@/context/WizardContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { KeywordAnalysisResult } from '@/lib/types';

const SEASONALITY_OPTIONS: { value: KeywordAnalysisResult['seasonality']; label: string }[] = [
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'non-seasonal', label: 'Non-seasonal / Evergreen' },
  { value: 'event-driven', label: 'Event-driven' },
];

export default function KeywordAnalysisStep() {
  const {
    campaignInput,
    keywordAnalysis,
    setKeywordAnalysis,
    setApprovedQuery,
    setCountsData,
    setThresholdRecommendation,
    isLoading,
    setIsLoading,
    error,
    setError,
    nextStep,
    prevStep,
  } = useWizard();

  const [editedQuery, setEditedQuery] = useState('');
  const [editedLookbackQuery, setEditedLookbackQuery] = useState('');
  const [editedSeasonality, setEditedSeasonality] = useState<KeywordAnalysisResult['seasonality']>('non-seasonal');
  const [editedLookbackStart, setEditedLookbackStart] = useState('');
  const [editedLookbackEnd, setEditedLookbackEnd] = useState('');

  // Persist the user's seasonality override across re-analyses
  const seasonalityOverrideRef = useRef<KeywordAnalysisResult['seasonality'] | null>(null);

  useEffect(() => {
    if (keywordAnalysis) {
      setEditedQuery(keywordAnalysis.suggestedQuery);
      setEditedLookbackQuery(keywordAnalysis.lookbackQuery || '');
      // If there's a user override, keep it; otherwise use Grok's
      setEditedSeasonality(seasonalityOverrideRef.current ?? keywordAnalysis.seasonality);
      setEditedLookbackStart(keywordAnalysis.lookbackStartDate);
      setEditedLookbackEnd(keywordAnalysis.lookbackEndDate);
      return;
    }

    async function analyze() {
      setIsLoading(true);
      setError(null);

      try {
        const body: Record<string, unknown> = {
          handle: campaignInput.handle,
          keywords: campaignInput.keywords,
          campaignStartDate: campaignInput.campaignStartDate,
          campaignEndDate: campaignInput.campaignEndDate,
          useExactKeywords: campaignInput.useExactKeywords,
        };

        // If the user has overridden seasonality, tell Grok
        if (seasonalityOverrideRef.current) {
          body.seasonalityOverride = seasonalityOverrideRef.current;
        }

        const res = await fetch('/api/analyze-keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Keyword analysis failed');
        }

        const result = await res.json();
        setKeywordAnalysis(result);
        setEditedQuery(result.suggestedQuery);
        setEditedLookbackQuery(result.lookbackQuery || '');
        setEditedSeasonality(seasonalityOverrideRef.current ?? result.seasonality);
        setEditedLookbackStart(result.lookbackStartDate);
        setEditedLookbackEnd(result.lookbackEndDate);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Keyword analysis failed');
      } finally {
        setIsLoading(false);
      }
    }

    analyze();
  }, [campaignInput, keywordAnalysis, setKeywordAnalysis, setIsLoading, setError]);

  const handleSeasonalityChange = (value: KeywordAnalysisResult['seasonality']) => {
    setEditedSeasonality(value);
    seasonalityOverrideRef.current = value;
  };

  const handleReanalyze = () => {
    // Keep the seasonality override in the ref — it persists
    setKeywordAnalysis(null as unknown as Parameters<typeof setKeywordAnalysis>[0]);
    setCountsData(null as unknown as Parameters<typeof setCountsData>[0]);
    setThresholdRecommendation(null as unknown as Parameters<typeof setThresholdRecommendation>[0]);
    setError(null);
  };

  const handleApprove = () => {
    if (keywordAnalysis) {
      const changed =
        editedQuery !== keywordAnalysis.suggestedQuery ||
        editedSeasonality !== keywordAnalysis.seasonality ||
        editedLookbackStart !== keywordAnalysis.lookbackStartDate ||
        editedLookbackEnd !== keywordAnalysis.lookbackEndDate ||
        (keywordAnalysis.lookbackQuery && editedLookbackQuery !== keywordAnalysis.lookbackQuery);

      setKeywordAnalysis({
        ...keywordAnalysis,
        suggestedQuery: editedQuery,
        ...(keywordAnalysis.lookbackQuery ? { lookbackQuery: editedLookbackQuery } : {}),
        seasonality: editedSeasonality,
        lookbackStartDate: editedLookbackStart,
        lookbackEndDate: editedLookbackEnd,
      });

      if (changed) {
        setCountsData(null as unknown as Parameters<typeof setCountsData>[0]);
        setThresholdRecommendation(null as unknown as Parameters<typeof setThresholdRecommendation>[0]);
      }
    }
    setApprovedQuery(editedQuery);
    nextStep();
  };

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner message={`Analyzing keywords with Grok${seasonalityOverrideRef.current ? ` (as ${seasonalityOverrideRef.current})` : ''}...`} />
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
            <Button onClick={handleReanalyze}>Retry</Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!keywordAnalysis) return null;

  const seasonalityBadge = {
    seasonal: 'success' as const,
    'non-seasonal': 'default' as const,
    'event-driven': 'warning' as const,
  };

  const hasOverrides =
    editedSeasonality !== keywordAnalysis.seasonality ||
    editedLookbackStart !== keywordAnalysis.lookbackStartDate ||
    editedLookbackEnd !== keywordAnalysis.lookbackEndDate ||
    (keywordAnalysis.lookbackQuery && editedLookbackQuery !== keywordAnalysis.lookbackQuery);

  return (
    <Card>
      <h2 className="text-xl font-bold text-white mb-1">Keyword Analysis</h2>
      <p className="text-x-gray text-sm mb-6">
        Grok has analyzed your keywords and suggested an optimized search query. You can override any field below.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="seasonality" className="text-sm font-medium text-x-lightgray block mb-1.5">
            Seasonality
          </label>
          <div className="flex items-center gap-3">
            <select
              id="seasonality"
              value={editedSeasonality}
              onChange={(e) => handleSeasonalityChange(e.target.value as KeywordAnalysisResult['seasonality'])}
              className="bg-black border border-x-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue"
            >
              {SEASONALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Badge variant={seasonalityBadge[editedSeasonality]}>
              {editedSeasonality}
            </Badge>
            {editedSeasonality !== keywordAnalysis.seasonality && (
              <span className="text-yellow-400 text-xs">overridden</span>
            )}
          </div>
          <p className="text-x-gray text-sm mt-1">{keywordAnalysis.seasonalityExplanation}</p>
        </div>

        <div>
          <span className="text-sm font-medium text-x-lightgray block mb-1">Reasoning</span>
          <p className="text-x-gray text-sm">{keywordAnalysis.reasoning}</p>
        </div>

        <div className="bg-black rounded-xl p-4 border border-x-border">
          <span className="text-sm font-medium text-x-lightgray block mb-2">Historical Lookback Period</span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lookbackStart" className="text-x-gray text-xs block mb-1">Start Date</label>
              <input
                id="lookbackStart"
                type="date"
                value={editedLookbackStart}
                onChange={(e) => setEditedLookbackStart(e.target.value)}
                className="w-full bg-black border border-x-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue [color-scheme:dark]"
              />
            </div>
            <div>
              <label htmlFor="lookbackEnd" className="text-x-gray text-xs block mb-1">End Date</label>
              <input
                id="lookbackEnd"
                type="date"
                value={editedLookbackEnd}
                onChange={(e) => setEditedLookbackEnd(e.target.value)}
                className="w-full bg-black border border-x-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue [color-scheme:dark]"
              />
            </div>
          </div>
          {(editedLookbackStart !== keywordAnalysis.lookbackStartDate || editedLookbackEnd !== keywordAnalysis.lookbackEndDate) && (
            <p className="text-yellow-400 text-xs mt-2">Lookback dates overridden from Grok suggestion</p>
          )}
          <p className="text-x-gray text-sm mt-2">{keywordAnalysis.lookbackReasoning}</p>
        </div>

        <div>
          <label htmlFor="query" className="text-sm font-medium text-x-lightgray block mb-1.5">
            {keywordAnalysis.lookbackQuery ? 'Campaign Trigger Query' : 'Search Query'}
          </label>
          <textarea
            id="query"
            value={editedQuery}
            onChange={(e) => setEditedQuery(e.target.value)}
            rows={4}
            className="w-full bg-black border border-x-border rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue resize-none"
          />
          <p className="text-x-gray text-xs mt-1">
            {keywordAnalysis.lookbackQuery
              ? 'This query will be used as the live trigger for your Trend Genius campaign.'
              : 'You can edit this query before proceeding.'}
          </p>
        </div>

        {keywordAnalysis.lookbackQuery && (
          <div className="bg-black rounded-xl p-4 border border-x-border">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="lookbackQuery" className="text-sm font-medium text-x-lightgray">
                Historical Lookback Query
              </label>
              {editedLookbackQuery !== keywordAnalysis.lookbackQuery && (
                <span className="text-yellow-400 text-xs">overridden</span>
              )}
            </div>
            <textarea
              id="lookbackQuery"
              value={editedLookbackQuery}
              onChange={(e) => setEditedLookbackQuery(e.target.value)}
              rows={4}
              className="w-full bg-black border border-x-border rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue resize-none"
            />
            {keywordAnalysis.lookbackQueryReasoning && (
              <p className="text-x-gray text-sm mt-2">{keywordAnalysis.lookbackQueryReasoning}</p>
            )}
            <p className="text-yellow-400/70 text-xs mt-1">Adapted for the historical lookback period — different terms than the campaign query.</p>
          </div>
        )}

        {keywordAnalysis.suggestedKeywords && keywordAnalysis.suggestedKeywords.length > 0 && (
          <div>
            <span className="text-sm font-medium text-x-lightgray block mb-2">Suggested Additional Keywords</span>
            <div className="flex flex-wrap gap-2">
              {keywordAnalysis.suggestedKeywords.map((kw) => (
                <Badge key={kw}>{kw}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6 pt-4 border-t border-x-border">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={prevStep}>Back</Button>
          <Button variant="ghost" onClick={handleReanalyze}>
            Re-analyze with Grok
          </Button>
        </div>
        <Button onClick={handleApprove} size="lg">
          {hasOverrides ? 'Apply Overrides & Fetch Data' : 'Approve & Fetch Data'}
        </Button>
      </div>
    </Card>
  );
}
