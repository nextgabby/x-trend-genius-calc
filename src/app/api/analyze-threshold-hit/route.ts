import { NextResponse } from 'next/server';
import { callGrok } from '@/lib/grok';
import { buildTrendExplanationPrompt } from '@/lib/prompts';
import type { SpikeContext } from '@/lib/prompts';
import type { TrendExplanation } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, spike, campaignStartDate, campaignEndDate } = body as {
      query: string;
      spike: SpikeContext;
      campaignStartDate?: string;
      campaignEndDate?: string;
    };

    if (!query || !spike?.timestamp || spike.peakVolume == null) {
      return NextResponse.json(
        { error: 'Missing required fields: query, spike (with timestamp, peakVolume, avgVolume, medianVolume, spikeDurationHours, surroundingHours, eventHours)' },
        { status: 400 }
      );
    }

    console.log(`\n=== /api/analyze-threshold-hit ===`);
    console.log(`[Input] query: "${query.substring(0, 80)}...", peak: ${spike.timestamp}, volume: ${spike.peakVolume}, duration: ${spike.spikeDurationHours}h`);

    const prompt = buildTrendExplanationPrompt(query, spike, campaignStartDate, campaignEndDate);
    const result = await callGrok<TrendExplanation>(prompt);

    console.log(`[Result] confidence: ${result.confidence}, events: ${result.keyEvents?.length ?? 0}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Analyze threshold hit error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze threshold hit' },
      { status: 500 }
    );
  }
}
