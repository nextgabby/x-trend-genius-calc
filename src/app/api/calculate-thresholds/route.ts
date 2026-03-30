import { NextResponse } from 'next/server';
import { callGrok } from '@/lib/grok';
import { buildThresholdAnalysisPrompt } from '@/lib/prompts';
import { computeStats } from '@/lib/utils';
import type { HourlyDataPoint, ThresholdRecommendation } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, data, seasonality, campaignStartDate, campaignEndDate, totalBudget } = body;

    if (!query || !data?.length || !seasonality || !campaignStartDate || !campaignEndDate || !totalBudget) {
      return NextResponse.json(
        { error: 'Missing required fields: query, data, seasonality, campaignStartDate, campaignEndDate, totalBudget' },
        { status: 400 }
      );
    }

    console.log(`\n=== /api/calculate-thresholds ===`);
    console.log(`[Input] query: "${query.substring(0, 80)}...", ${data.length} data points, seasonality: ${seasonality}, budget: $${totalBudget.toLocaleString()}`);

    const hourlyData: HourlyDataPoint[] = data;
    const stats = computeStats(hourlyData);

    console.log(`[Stats] mean: ${stats.mean}, median: ${stats.median}, stdDev: ${stats.stdDev}, p75: ${stats.p75}, p90: ${stats.p90}, p95: ${stats.p95}`);

    const prompt = buildThresholdAnalysisPrompt(
      query,
      stats,
      seasonality,
      campaignStartDate,
      campaignEndDate,
      totalBudget
    );

    const result = await callGrok<ThresholdRecommendation>(prompt);

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
