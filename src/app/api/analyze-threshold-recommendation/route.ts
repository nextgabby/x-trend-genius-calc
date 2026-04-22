import { NextResponse } from 'next/server';
import { callGrok } from '@/lib/grok';
import { buildThresholdRecommendationPrompt } from '@/lib/prompts';
import { computeStats } from '@/lib/utils';
import type { HourlyDataPoint, ThresholdRecommendationResult } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, onThreshold, offThreshold, campaignStartDate, campaignEndDate, data } = body as {
      query: string;
      onThreshold: number;
      offThreshold: number;
      campaignStartDate?: string;
      campaignEndDate?: string;
      data: HourlyDataPoint[];
    };

    if (!query || onThreshold == null || offThreshold == null || !data?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: query, onThreshold, offThreshold, data' },
        { status: 400 }
      );
    }

    console.log(`\n=== /api/analyze-threshold-recommendation ===`);
    console.log(`[Input] query: "${query.substring(0, 80)}...", ON: ${onThreshold}, OFF: ${offThreshold}, dataPoints: ${data.length}`);

    // Compute full stats server-side from raw data
    const stats = computeStats(data);

    // Compute exact hours above thresholds from raw data
    const hoursAboveOn = data.filter((d) => d.count >= onThreshold).length;
    const hoursAboveOff = data.filter((d) => d.count >= offThreshold).length;

    // Determine the actual date range of the data
    const timestamps = data.map((d) => d.timestamp).sort();
    const dataStartDate = timestamps[0];
    const dataEndDate = timestamps[timestamps.length - 1];

    console.log(`[Stats] mean=${stats.mean}, median=${stats.median}, P90=${stats.p90}, P95=${stats.p95}, spikes=${stats.spikeCount}`);
    console.log(`[Thresholds] hoursAboveOn=${hoursAboveOn}/${data.length} (${(hoursAboveOn/data.length*100).toFixed(1)}%), hoursAboveOff=${hoursAboveOff}/${data.length}`);

    const prompt = buildThresholdRecommendationPrompt(
      query, onThreshold, offThreshold, stats,
      hoursAboveOn, hoursAboveOff, dataStartDate, dataEndDate,
      campaignStartDate, campaignEndDate
    );
    const result = await callGrok<ThresholdRecommendationResult>(prompt);

    console.log(`[Result] action: ${result.action}, confidence: ${result.confidence}`);

    // Attach computed stats to response for client display
    return NextResponse.json({
      ...result,
      stats: {
        mean: stats.mean,
        median: stats.median,
        p90: stats.p90,
        p95: stats.p95,
        p99: stats.p99,
        max: stats.max,
        spikeCount: stats.spikeCount,
        spikeDays: stats.spikeDays,
        totalDaysInData: stats.totalDaysInData,
      },
    });
  } catch (error) {
    console.error('Analyze threshold recommendation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze thresholds' },
      { status: 500 }
    );
  }
}
