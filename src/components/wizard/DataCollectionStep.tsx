'use client';

import { useEffect } from 'react';
import { useWizard } from '@/context/WizardContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import VolumeChart from '@/components/charts/VolumeChart';
import { formatNumber, formatDate } from '@/lib/utils';

export default function DataCollectionStep() {
  const {
    approvedQuery,
    keywordAnalysis,
    campaignInput,
    countsData,
    setCountsData,
    isLoading,
    setIsLoading,
    error,
    setError,
    nextStep,
    prevStep,
  } = useWizard();

  useEffect(() => {
    if (countsData) return;

    async function fetchCounts() {
      setIsLoading(true);
      setError(null);

      try {
        // Use the lookback query (adapted for historical period) for fetching counts
        const lookbackQuery = keywordAnalysis?.lookbackQuery || approvedQuery;
        const res = await fetch('/api/fetch-counts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: lookbackQuery,
            lookbackStartDate: keywordAnalysis?.lookbackStartDate,
            lookbackEndDate: keywordAnalysis?.lookbackEndDate,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch tweet counts');
        }

        const result = await res.json();
        setCountsData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tweet counts');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCounts();
  }, [approvedQuery, keywordAnalysis, campaignInput, countsData, setCountsData, setIsLoading, setError]);

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner message="Fetching historical post data from X API..." />
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
            <Button onClick={() => { setCountsData(null as unknown as Parameters<typeof setCountsData>[0]); setError(null); }}>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!countsData) return null;

  return (
    <Card>
      <h2 className="text-xl font-bold text-white mb-1">Historical Post Volume</h2>
      <p className="text-x-gray text-sm mb-4">
        Hourly post counts for your query over the lookback period.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-black rounded-xl p-3 border border-x-border">
          <p className="text-x-gray text-xs">Hours Collected</p>
          <p className="text-white text-lg font-bold">{formatNumber(countsData.data.length)}</p>
        </div>
        <div className="bg-black rounded-xl p-3 border border-x-border">
          <p className="text-x-gray text-xs">Total Post Volume</p>
          <p className="text-white text-lg font-bold">{formatNumber(countsData.totalTweets)}</p>
        </div>
        <div className="bg-black rounded-xl p-3 border border-x-border">
          <p className="text-x-gray text-xs">Period</p>
          <p className="text-white text-sm font-medium">
            {formatDate(countsData.startTime)} — {formatDate(countsData.endTime)}
          </p>
        </div>
      </div>

      <div className="bg-black rounded-xl border border-x-border p-4">
        <VolumeChart data={countsData.data} />
      </div>

      {keywordAnalysis?.lookbackQuery && keywordAnalysis.lookbackQuery !== approvedQuery ? (
        <div className="space-y-2 mt-4">
          <div className="bg-black rounded-xl border border-x-border p-3">
            <p className="text-x-gray text-xs mb-1">Lookback Query (used for historical data)</p>
            <p className="text-white text-xs font-mono break-all">{keywordAnalysis.lookbackQuery}</p>
          </div>
          <div className="bg-black rounded-xl border border-x-blue/20 p-3">
            <p className="text-x-blue text-xs mb-1">Campaign Trigger Query (will be used live)</p>
            <p className="text-white text-xs font-mono break-all">{approvedQuery}</p>
          </div>
        </div>
      ) : (
        <div className="bg-black rounded-xl border border-x-border p-3 mt-4">
          <p className="text-x-gray text-xs font-mono break-all">Query: {approvedQuery}</p>
        </div>
      )}

      <div className="flex justify-between mt-6 pt-4 border-t border-x-border">
        <Button variant="secondary" onClick={prevStep}>Back</Button>
        <Button onClick={nextStep} size="lg">
          Calculate Thresholds
        </Button>
      </div>
    </Card>
  );
}
