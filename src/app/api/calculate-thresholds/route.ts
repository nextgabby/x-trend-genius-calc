import { NextResponse } from 'next/server';
import { callGrok } from '@/lib/grok';
import { buildThresholdAnalysisPrompt } from '@/lib/prompts';
import { computeStats, recalculateBudget, cleanRound } from '@/lib/utils';
import type { HourlyDataPoint, ThresholdRecommendation } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, lookbackQuery, data, seasonality, campaignStartDate, campaignEndDate, totalBudget } = body;

    if (!query || !data?.length || !seasonality || !campaignStartDate || !campaignEndDate || !totalBudget) {
      return NextResponse.json(
        { error: 'Missing required fields: query, data, seasonality, campaignStartDate, campaignEndDate, totalBudget' },
        { status: 400 }
      );
    }

    console.log(`\n=== /api/calculate-thresholds ===`);
    console.log(`[Input] query: "${query}"`);
    if (lookbackQuery) console.log(`[Input] lookbackQuery: "${lookbackQuery}"`);
    console.log(`[Input] ${data.length} data points, seasonality: ${seasonality}, budget: $${totalBudget.toLocaleString()}`);

    const hourlyData: HourlyDataPoint[] = data;
    const dataChecksum = hourlyData.reduce((sum: number, d: HourlyDataPoint) => sum + d.count, 0);
    console.log(`[Input] Data checksum (sum of all counts): ${dataChecksum.toLocaleString()}`);

    const stats = computeStats(hourlyData);

    console.log(`[Stats] mean: ${stats.mean}, median: ${stats.median}, stdDev: ${stats.stdDev}, p75: ${stats.p75}, p90: ${stats.p90}, p95: ${stats.p95}`);

    const prompt = buildThresholdAnalysisPrompt(
      query,
      stats,
      seasonality,
      campaignStartDate,
      campaignEndDate,
      lookbackQuery || undefined
    );

    const result = await callGrok<ThresholdRecommendation>(prompt);

    console.log(`[Grok raw] ON: ${result.onThreshold}, OFF: ${result.offThreshold}, consecutive: ${result.consecutiveHours}h, confidence: ${result.confidence}`);

    // Ensure ON > OFF after rounding
    const cleaned = cleanRound(result.onThreshold, result.offThreshold);
    result.onThreshold = cleaned.on;
    result.offThreshold = cleaned.off;

    // Compute budget server-side — single source of truth
    const campStart = new Date(campaignStartDate);
    const campEnd = new Date(campaignEndDate);
    const campaignDays = Math.round((campEnd.getTime() - campStart.getTime()) / (1000 * 60 * 60 * 24));
    const totalDaysInData = stats.totalDaysInData;

    const budget = recalculateBudget(hourlyData, result.onThreshold, totalBudget, campaignDays, totalDaysInData);
    result.estimatedTrendDays = budget.estimatedTrendDays;
    result.recommendedMaxDailySpend = budget.recommendedMaxDailySpend;

    const daysAbove = new Set<string>();
    for (const d of hourlyData) {
      if (d.count >= result.onThreshold) {
        daysAbove.add(d.timestamp.split('T')[0]);
      }
    }
    result.budgetReasoning = `Based on the ON threshold of ${result.onThreshold.toLocaleString()} posts/hour, ${daysAbove.size} out of ${totalDaysInData} days in the historical data had at least one hour above this threshold. Scaling this ratio to the ${campaignDays}-day campaign period gives an estimated ${budget.estimatedTrendDays} trend days, with a recommended max daily spend of $${budget.recommendedMaxDailySpend.toLocaleString()}.`;

    console.log(`[Result] ON: ${result.onThreshold}, OFF: ${result.offThreshold}, consecutive: ${result.consecutiveHours}h, confidence: ${result.confidence}`);
    console.log(`[Budget] Est. trend days: ${result.estimatedTrendDays}, Max daily spend: $${result.recommendedMaxDailySpend.toLocaleString()}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Threshold calculation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Threshold calculation failed' },
      { status: 500 }
    );
  }
}
