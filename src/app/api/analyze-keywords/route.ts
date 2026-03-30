import { NextResponse } from 'next/server';
import { callGrok } from '@/lib/grok';
import { buildKeywordAnalysisPrompt } from '@/lib/prompts';
import type { KeywordAnalysisResult } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { handle, keywords, campaignStartDate, campaignEndDate, seasonalityOverride, useExactKeywords } = body;

    if (!handle || !keywords?.length || !campaignStartDate || !campaignEndDate) {
      return NextResponse.json(
        { error: 'Missing required fields: handle, keywords, campaignStartDate, campaignEndDate' },
        { status: 400 }
      );
    }

    console.log(`\n=== /api/analyze-keywords ===`);
    console.log(`[Input] handle: @${handle}, keywords: [${keywords.join(', ')}], dates: ${campaignStartDate} → ${campaignEndDate}${seasonalityOverride ? `, seasonality override: ${seasonalityOverride}` : ''}`);

    const prompt = buildKeywordAnalysisPrompt(handle, keywords, campaignStartDate, campaignEndDate, seasonalityOverride, useExactKeywords);
    const result = await callGrok<KeywordAnalysisResult>(prompt);

    console.log(`[Result] valid: ${result.isValid}, seasonality: ${result.seasonality}, lookback: ${result.lookbackStartDate} → ${result.lookbackEndDate}`);
    console.log(`[Result] query: ${result.suggestedQuery.substring(0, 120)}...`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Keyword analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Keyword analysis failed' },
      { status: 500 }
    );
  }
}
