'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ThresholdChart from '@/components/charts/ThresholdChart';
import { formatNumber, formatDateTime } from '@/lib/utils';
import type { HourlyDataPoint, ThresholdHit, TrendExplanation, ThresholdRecommendationResult } from '@/lib/types';

interface DailySummary {
  date: string;
  avg: number;
  max: number;
  hoursAboveOn: number;
}

interface RichThresholdHit extends ThresholdHit {
  durationHours: number;
  eventHours: { timestamp: string; count: number }[];
}

interface RecommendationWithStats extends ThresholdRecommendationResult {
  stats: {
    mean: number;
    median: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    spikeCount: number;
    spikeDays: number;
    totalDaysInData: number;
  };
}

function groupThresholdHits(
  data: HourlyDataPoint[],
  onThreshold: number
): RichThresholdHit[] {
  const sorted = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const events: RichThresholdHit[] = [];
  let currentEvent: HourlyDataPoint[] = [];

  for (const point of sorted) {
    if (point.count >= onThreshold) {
      currentEvent.push(point);
    } else if (currentEvent.length > 0) {
      const peak = currentEvent.reduce((a, b) => (a.count > b.count ? a : b));
      events.push({
        timestamp: peak.timestamp,
        count: peak.count,
        durationHours: currentEvent.length,
        eventHours: currentEvent.map((h) => ({ timestamp: h.timestamp, count: h.count })),
      });
      currentEvent = [];
    }
  }
  if (currentEvent.length > 0) {
    const peak = currentEvent.reduce((a, b) => (a.count > b.count ? a : b));
    events.push({
      timestamp: peak.timestamp,
      count: peak.count,
      durationHours: currentEvent.length,
      eventHours: currentEvent.map((h) => ({ timestamp: h.timestamp, count: h.count })),
    });
  }

  return events;
}

function getSurroundingHours(
  data: HourlyDataPoint[],
  peakTimestamp: string,
  windowHours: number = 12
): { timestamp: string; count: number }[] {
  const sorted = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const peakTime = new Date(peakTimestamp).getTime();
  const windowMs = windowHours * 60 * 60 * 1000;

  return sorted
    .filter((d) => {
      const t = new Date(d.timestamp).getTime();
      return t >= peakTime - windowMs && t <= peakTime + windowMs;
    })
    .map((d) => ({ timestamp: d.timestamp, count: d.count }));
}

function computeDailySummaries(
  data: HourlyDataPoint[],
  onThreshold: number
): DailySummary[] {
  const byDay: Record<string, HourlyDataPoint[]> = {};
  for (const d of data) {
    const day = d.timestamp.split('T')[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(d);
  }

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, points]) => {
      const counts = points.map((p) => p.count);
      return {
        date,
        avg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
        max: Math.max(...counts),
        hoursAboveOn: counts.filter((c) => c >= onThreshold).length,
      };
    });
}

export default function ThresholdAnalysisTool() {
  const [query, setQuery] = useState('');
  const [onThreshold, setOnThreshold] = useState('');
  const [offThreshold, setOffThreshold] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HourlyDataPoint[] | null>(null);
  const [hits, setHits] = useState<RichThresholdHit[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [recommendation, setRecommendation] = useState<RecommendationWithStats | null>(null);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);

  const onVal = Number(onThreshold);
  const offVal = Number(offThreshold);

  const handleAnalyze = async () => {
    if (!query.trim() || !onThreshold || !offThreshold) return;

    setIsLoading(true);
    setError(null);
    setData(null);
    setHits([]);
    setDailySummaries([]);
    setRecommendation(null);

    try {
      const now = new Date();
      const endDate = new Date(now.getTime() - 60_000);
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const res = await fetch('/api/fetch-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          lookbackStartDate: startDate.toISOString(),
          lookbackEndDate: endDate.toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch data');
      }

      const result = await res.json();
      const hourlyData: HourlyDataPoint[] = result.data;
      setData(hourlyData);

      const foundHits = groupThresholdHits(hourlyData, onVal);
      setHits(foundHits);

      const summaries = computeDailySummaries(hourlyData, onVal);
      setDailySummaries(summaries);

      // Fetch Grok-powered recommendation in parallel
      fetchRecommendation(hourlyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecommendation = async (hourlyData: HourlyDataPoint[]) => {
    setIsRecommendationLoading(true);
    try {
      const res = await fetch('/api/analyze-threshold-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          onThreshold: onVal,
          offThreshold: offVal,
          data: hourlyData,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to get recommendation');
      }

      const result: RecommendationWithStats = await res.json();
      setRecommendation(result);
    } catch (err) {
      console.error('Recommendation error:', err);
      // Non-fatal — show data without recommendation
    } finally {
      setIsRecommendationLoading(false);
    }
  };

  const handleExplainHit = async (index: number) => {
    if (!data) return;
    const hit = hits[index];

    setHits((prev) =>
      prev.map((h, i) => (i === index ? { ...h, isLoading: true, error: undefined } : h))
    );

    try {
      const avgVolume =
        data.length > 0
          ? Math.round(data.reduce((sum, d) => sum + d.count, 0) / data.length)
          : 0;

      const counts = data.map((d) => d.count).sort((a, b) => a - b);
      const medianVolume = counts.length > 0
        ? counts[Math.floor(counts.length / 2)]
        : 0;

      const surroundingHours = getSurroundingHours(data, hit.timestamp);

      const res = await fetch('/api/analyze-threshold-hit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          spike: {
            timestamp: hit.timestamp,
            peakVolume: hit.count,
            avgVolume,
            medianVolume,
            spikeDurationHours: hit.durationHours,
            surroundingHours,
            eventHours: hit.eventHours,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to analyze');
      }

      const result: TrendExplanation = await res.json();
      setHits((prev) =>
        prev.map((h, i) =>
          i === index
            ? {
                ...h,
                explanation: result.explanation,
                keyEvents: result.keyEvents,
                confidence: result.confidence,
                isLoading: false,
              }
            : h
        )
      );
    } catch (err) {
      setHits((prev) =>
        prev.map((h, i) =>
          i === index
            ? { ...h, isLoading: false, error: err instanceof Error ? err.message : 'Failed' }
            : h
        )
      );
    }
  };

  const confidenceBadge = {
    high: 'success' as const,
    medium: 'warning' as const,
    low: 'error' as const,
  };

  const actionStyles = {
    raise: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Raise Threshold' },
    lower: { color: 'text-[#F4212E]', bg: 'bg-[#F4212E]/10 border-[#F4212E]/20', label: 'Lower Threshold' },
    keep: { color: 'text-[#00BA7C]', bg: 'bg-[#00BA7C]/10 border-[#00BA7C]/20', label: 'Well Calibrated' },
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <h2 className="text-xl font-bold text-white mb-4">Threshold Analysis</h2>
        <p className="text-x-gray text-sm mb-6">
          Test your thresholds against the last 7 days of real data. See how often
          they would trigger and get per-spike explanations from Grok.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-x-lightgray mb-1">
              Search Query
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "NFL" OR #NFL OR "football" -fantasy -betting'
              rows={3}
              className="w-full bg-black border border-x-border rounded-xl px-4 py-3 text-white text-sm placeholder-x-gray focus:outline-none focus:ring-2 focus:ring-x-blue focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#00BA7C] mb-1">
                ON Threshold
              </label>
              <input
                type="number"
                value={onThreshold}
                onChange={(e) => setOnThreshold(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full bg-black border border-[#00BA7C]/30 rounded-xl px-4 py-3 text-white text-sm placeholder-x-gray focus:outline-none focus:ring-2 focus:ring-[#00BA7C] focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="text-x-gray text-xs mt-1">posts/hour to trigger ON</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#F4212E] mb-1">
                OFF Threshold
              </label>
              <input
                type="number"
                value={offThreshold}
                onChange={(e) => setOffThreshold(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full bg-black border border-[#F4212E]/30 rounded-xl px-4 py-3 text-white text-sm placeholder-x-gray focus:outline-none focus:ring-2 focus:ring-[#F4212E] focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="text-x-gray text-xs mt-1">posts/hour to trigger OFF</p>
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            variant="primary"
            size="lg"
            isLoading={isLoading}
            disabled={!query.trim() || !onThreshold || !offThreshold}
            className="w-full"
          >
            Analyze
          </Button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </Card>

      {data && (
        <>
          {/* Chart */}
          <Card>
            <h3 className="text-lg font-bold text-white mb-4">
              7-Day Volume with Thresholds
            </h3>
            <div className="bg-black rounded-xl border border-x-border p-4">
              <ThresholdChart
                data={data}
                onThreshold={onVal}
                offThreshold={offVal}
              />
            </div>
          </Card>

          {/* Grok Recommendation */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">Recommendation</h3>
              {recommendation?.confidence && (
                <Badge variant={confidenceBadge[recommendation.confidence]}>
                  {recommendation.confidence} confidence
                </Badge>
              )}
            </div>

            {isRecommendationLoading && (
              <div className="flex items-center gap-3 py-6">
                <svg className="animate-spin h-5 w-5 text-x-blue" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-x-gray text-sm">Grok is analyzing your thresholds against the data...</span>
              </div>
            )}

            {recommendation && (
              <>
                <div className={`p-4 rounded-xl border ${actionStyles[recommendation.action].bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-semibold uppercase ${actionStyles[recommendation.action].color}`}>
                      {actionStyles[recommendation.action].label}
                    </span>
                    {recommendation.hoursAboveOnPct && (
                      <span className="text-x-gray text-xs">
                        ({recommendation.hoursAboveOnPct} of hours above ON)
                      </span>
                    )}
                  </div>
                  <p className="text-x-lightgray text-sm">{recommendation.reasoning}</p>
                </div>

                {(recommendation.suggestedOnThreshold || recommendation.suggestedOffThreshold) && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {recommendation.suggestedOnThreshold && (
                      <div className="bg-black rounded-lg p-3 border border-[#00BA7C]/30">
                        <p className="text-[#00BA7C] text-xs font-medium">Suggested ON</p>
                        <p className="text-white text-lg font-bold">
                          {formatNumber(recommendation.suggestedOnThreshold)}
                        </p>
                        <p className="text-x-gray text-xs">posts/hour</p>
                      </div>
                    )}
                    {recommendation.suggestedOffThreshold && (
                      <div className="bg-black rounded-lg p-3 border border-[#F4212E]/30">
                        <p className="text-[#F4212E] text-xs font-medium">Suggested OFF</p>
                        <p className="text-white text-lg font-bold">
                          {formatNumber(recommendation.suggestedOffThreshold)}
                        </p>
                        <p className="text-x-gray text-xs">posts/hour</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Data context so user can see what Grok saw */}
                {recommendation.stats && (
                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    <div className="bg-black rounded-lg p-2 border border-x-border">
                      <p className="text-x-gray text-[10px]">Mean</p>
                      <p className="text-white text-sm font-semibold">{formatNumber(recommendation.stats.mean)}/hr</p>
                    </div>
                    <div className="bg-black rounded-lg p-2 border border-x-border">
                      <p className="text-x-gray text-[10px]">Median</p>
                      <p className="text-white text-sm font-semibold">{formatNumber(recommendation.stats.median)}/hr</p>
                    </div>
                    <div className="bg-black rounded-lg p-2 border border-x-border">
                      <p className="text-x-gray text-[10px]">P90</p>
                      <p className="text-white text-sm font-semibold">{formatNumber(recommendation.stats.p90)}/hr</p>
                    </div>
                    <div className="bg-black rounded-lg p-2 border border-x-border">
                      <p className="text-x-gray text-[10px]">P95</p>
                      <p className="text-white text-sm font-semibold">{formatNumber(recommendation.stats.p95)}/hr</p>
                    </div>
                    <div className="bg-black rounded-lg p-2 border border-x-border">
                      <p className="text-x-gray text-[10px]">Max</p>
                      <p className="text-white text-sm font-semibold">{formatNumber(recommendation.stats.max)}/hr</p>
                    </div>
                    <div className="bg-black rounded-lg p-2 border border-x-border">
                      <p className="text-x-gray text-[10px]">Spike Events</p>
                      <p className="text-white text-sm font-semibold">{recommendation.stats.spikeCount}</p>
                    </div>
                    <div className="bg-black rounded-lg p-2 border border-x-border">
                      <p className="text-x-gray text-[10px]">Spike Days</p>
                      <p className="text-white text-sm font-semibold">{recommendation.stats.spikeDays}/{recommendation.stats.totalDaysInData}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Daily Breakdown */}
          <Card>
            <h3 className="text-lg font-bold text-white mb-4">Daily Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-x-border">
                    <th className="text-left text-x-gray py-2 pr-4">Date</th>
                    <th className="text-right text-x-gray py-2 px-4">Avg/hr</th>
                    <th className="text-right text-x-gray py-2 px-4">Peak/hr</th>
                    <th className="text-right text-x-gray py-2 pl-4">Hours Above ON</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummaries.map((day) => (
                    <tr key={day.date} className="border-b border-x-border/50">
                      <td className="text-white py-2 pr-4">{day.date}</td>
                      <td className="text-x-lightgray text-right py-2 px-4">
                        {formatNumber(day.avg)}
                      </td>
                      <td className="text-x-lightgray text-right py-2 px-4">
                        {formatNumber(day.max)}
                      </td>
                      <td className="text-right py-2 pl-4">
                        <span
                          className={
                            day.hoursAboveOn > 0 ? 'text-[#00BA7C]' : 'text-x-gray'
                          }
                        >
                          {day.hoursAboveOn}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Threshold Hits */}
          <Card>
            <h3 className="text-lg font-bold text-white mb-2">
              Threshold Hits
              <span className="text-x-gray text-sm font-normal ml-2">
                {hits.length} event{hits.length !== 1 ? 's' : ''} detected
              </span>
            </h3>
            <p className="text-x-gray text-xs mb-4">
              Consecutive hours above ON threshold grouped into distinct events.
              Peak hour shown for each event.
            </p>

            {hits.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-x-gray text-sm">
                  No threshold hits in the past 7 days.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {hits.map((hit, index) => (
                  <div
                    key={hit.timestamp}
                    className="bg-black rounded-xl border border-x-border p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-white text-sm font-medium">
                          {formatDateTime(hit.timestamp)}
                        </span>
                        <span className="text-x-gray text-sm ml-3">
                          {formatNumber(hit.count)} posts/hr
                        </span>
                        <span className="text-x-gray text-xs ml-2">
                          ({hit.durationHours}h duration)
                        </span>
                      </div>
                      {!hit.explanation && !hit.isLoading && (
                        <Button
                          onClick={() => handleExplainHit(index)}
                          variant="ghost"
                          size="sm"
                        >
                          Explain with Grok
                        </Button>
                      )}
                      {hit.isLoading && (
                        <span className="text-x-gray text-xs animate-pulse">
                          Analyzing...
                        </span>
                      )}
                    </div>

                    {hit.explanation && (
                      <div className="mt-3 pt-3 border-t border-x-border">
                        <div className="flex items-center gap-2 mb-2">
                          {hit.confidence && (
                            <Badge variant={confidenceBadge[hit.confidence]}>
                              {hit.confidence} confidence
                            </Badge>
                          )}
                        </div>
                        <p className="text-x-lightgray text-sm">
                          {hit.explanation}
                        </p>
                        {hit.keyEvents && hit.keyEvents.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {hit.keyEvents.map((event) => (
                              <Badge key={event} variant="default">
                                {event}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {hit.error && (
                      <div className="mt-2 text-red-400 text-xs">{hit.error}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
