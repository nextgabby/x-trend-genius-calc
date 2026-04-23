import { subMinutes, subMonths, subYears, format } from 'date-fns';
import type { HourlyDataPoint, StatsResult } from './types';

export function computeStats(data: HourlyDataPoint[]): StatsResult {
  const counts = data.map((d) => d.count).sort((a, b) => a - b);
  const n = counts.length;

  const empty: StatsResult = {
    mean: 0, median: 0, stdDev: 0, min: 0, max: 0,
    p25: 0, p75: 0, p90: 0, p95: 0, p99: 0, totalDataPoints: 0,
    dayOfWeekAvg: {}, hourOfDayAvg: {}, spikeCount: 0,
    avgSpikeDurationHours: 0, spikeDays: 0, quietHourPct: 0, totalDaysInData: 0,
  };

  if (n === 0) return empty;

  const sum = counts.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  const variance = counts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const percentile = (p: number) => {
    const idx = (p / 100) * (n - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return counts[lower];
    return counts[lower] + (counts[upper] - counts[lower]) * (idx - lower);
  };

  const p90 = percentile(90);

  // --- Day-of-week averages ---
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayBuckets: Record<string, number[]> = {};
  for (const name of dayNames) dayBuckets[name] = [];

  for (const d of data) {
    const dt = new Date(d.timestamp);
    dayBuckets[dayNames[dt.getUTCDay()]].push(d.count);
  }

  const dayOfWeekAvg: Record<string, number> = {};
  for (const name of dayNames) {
    const arr = dayBuckets[name];
    dayOfWeekAvg[name] = arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  }

  // --- Hour-of-day averages (UTC) ---
  const hourBuckets: Record<string, number[]> = {};
  for (let h = 0; h < 24; h++) hourBuckets[String(h).padStart(2, '0')] = [];

  for (const d of data) {
    const dt = new Date(d.timestamp);
    hourBuckets[String(dt.getUTCHours()).padStart(2, '0')].push(d.count);
  }

  const hourOfDayAvg: Record<string, number> = {};
  for (let h = 0; h < 24; h++) {
    const key = String(h).padStart(2, '0');
    const arr = hourBuckets[key];
    hourOfDayAvg[key] = arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  }

  // --- Spike detection (above P90) ---
  // Walk data in chronological order, detect contiguous spike periods
  const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let spikeCount = 0;
  let totalSpikeHours = 0;
  const spikeDaySet = new Set<string>();
  let inSpike = false;
  let currentSpikeDuration = 0;

  for (const d of sorted) {
    if (d.count >= p90) {
      if (!inSpike) {
        inSpike = true;
        spikeCount++;
        currentSpikeDuration = 0;
      }
      currentSpikeDuration++;
      spikeDaySet.add(d.timestamp.split('T')[0]);
    } else {
      if (inSpike) {
        totalSpikeHours += currentSpikeDuration;
        inSpike = false;
      }
    }
  }
  if (inSpike) totalSpikeHours += currentSpikeDuration;

  const avgSpikeDurationHours = spikeCount > 0 ? Math.round((totalSpikeHours / spikeCount) * 10) / 10 : 0;

  // --- Quiet hours (below 25% of mean) ---
  const quietThreshold = mean * 0.25;
  const quietHours = counts.filter((c) => c < quietThreshold).length;
  const quietHourPct = Math.round((quietHours / n) * 1000) / 10;

  // --- Total calendar days ---
  const allDays = new Set(data.map((d) => d.timestamp.split('T')[0]));

  return {
    mean: Math.round(mean * 100) / 100,
    median: percentile(50),
    stdDev: Math.round(stdDev * 100) / 100,
    min: counts[0],
    max: counts[n - 1],
    p25: percentile(25),
    p75: percentile(75),
    p90: p90,
    p95: percentile(95),
    p99: percentile(99),
    totalDataPoints: n,
    dayOfWeekAvg,
    hourOfDayAvg,
    spikeCount,
    avgSpikeDurationHours,
    spikeDays: spikeDaySet.size,
    quietHourPct,
    totalDaysInData: allDays.size,
  };
}

export function getLookbackPeriod(
  seasonality: 'seasonal' | 'non-seasonal' | 'event-driven',
  campaignStartDate: string
): { startTime: string; endTime: string } {
  const campaignStart = new Date(campaignStartDate);

  let startTime: Date;
  let endTime: Date;

  switch (seasonality) {
    case 'seasonal':
      // Same dates 1 year prior
      startTime = subYears(campaignStart, 1);
      endTime = subYears(campaignStart, 1);
      // Look at a 2-month window around the same time last year
      startTime = subMonths(endTime, 1);
      endTime = new Date(endTime.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days
      break;
    case 'event-driven':
      // Recent 2 months, end 1 minute ago to satisfy X API constraint
      endTime = subMinutes(new Date(), 1);
      startTime = subMonths(endTime, 2);
      break;
    case 'non-seasonal':
    default:
      // Most recent 3 months, end 1 minute ago to satisfy X API constraint
      endTime = subMinutes(new Date(), 1);
      startTime = subMonths(endTime, 3);
      break;
  }

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };
}

export function recalculateBudget(
  data: HourlyDataPoint[],
  onThreshold: number,
  totalBudget: number,
  campaignDays: number,
  totalDaysInData: number
): { estimatedTrendDays: number; recommendedMaxDailySpend: number } {
  // Count unique days with at least one hour above the ON threshold
  const daysAbove = new Set<string>();
  for (const d of data) {
    if (d.count >= onThreshold) {
      daysAbove.add(d.timestamp.split('T')[0]);
    }
  }

  const ratio = totalDaysInData > 0 ? daysAbove.size / totalDaysInData : 0;
  const estimatedTrendDays = Math.max(1, Math.round(ratio * campaignDays));
  const recommendedMaxDailySpend = Math.round(totalBudget / estimatedTrendDays);

  return { estimatedTrendDays, recommendedMaxDailySpend };
}

export function findThresholdForTrendDays(
  data: HourlyDataPoint[],
  desiredTrendDays: number,
  campaignDays: number,
  totalDaysInData: number
): number {
  // How many days in the historical data need to be "above threshold" days
  const targetDaysAbove = Math.max(1, Math.round((desiredTrendDays / campaignDays) * totalDaysInData));

  // Find each day's maximum hourly volume
  const dailyMaxes: Record<string, number> = {};
  for (const d of data) {
    const day = d.timestamp.split('T')[0];
    dailyMaxes[day] = Math.max(dailyMaxes[day] || 0, d.count);
  }

  // Sort descending — the Nth value is the threshold that gives us N days above
  const sortedMaxes = Object.values(dailyMaxes).sort((a, b) => b - a);

  if (targetDaysAbove >= sortedMaxes.length) {
    // Want more trend days than we have data days — use the lowest daily max
    return sortedMaxes[sortedMaxes.length - 1];
  }

  // Threshold = the daily max of the targetDaysAbove-th day (0-indexed)
  // This ensures exactly targetDaysAbove days have at least one hour >= threshold
  return sortedMaxes[targetDaysAbove - 1];
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatDateTime(isoString: string): string {
  return format(new Date(isoString), 'MMM d, yyyy h:mm a');
}

export function formatDate(isoString: string): string {
  return format(new Date(isoString), 'MMM d, yyyy');
}
