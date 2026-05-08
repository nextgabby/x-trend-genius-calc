import { NextResponse } from 'next/server';
import { callGrok } from '@/lib/grok';
import { buildKeywordAnalysisPrompt } from '@/lib/prompts';
import type { KeywordAnalysisResult } from '@/lib/types';

function assembleQuery(terms: string[]): string {
  const cleaned = [...new Set(terms.map(t => t.trim()).filter(Boolean))];
  return cleaned.map(term => {
    if (term.includes(' ') && !term.startsWith('#')) {
      return `"${term}"`;
    }
    return term;
  }).join(' OR ');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { handle, keywords, campaignStartDate, campaignEndDate, seasonalityOverride, useExactKeywords, includeNegations, keywordOperator } = body;

    if (!handle || !keywords?.length || !campaignStartDate || !campaignEndDate) {
      return NextResponse.json(
        { error: 'Missing required fields: handle, keywords, campaignStartDate, campaignEndDate' },
        { status: 400 }
      );
    }

    console.log(`\n=== /api/analyze-keywords ===`);
    console.log(`[Input] handle: @${handle}, keywords: [${keywords.join(', ')}], dates: ${campaignStartDate} → ${campaignEndDate}${seasonalityOverride ? `, seasonality override: ${seasonalityOverride}` : ''}`);

    const prompt = buildKeywordAnalysisPrompt(handle, keywords, campaignStartDate, campaignEndDate, seasonalityOverride, useExactKeywords, includeNegations, keywordOperator);
    const result = await callGrok<KeywordAnalysisResult>(prompt);

    // Assemble query strings from terms arrays (server-side deterministic assembly)
    if (result.queryTerms && Array.isArray(result.queryTerms)) {
      result.suggestedQuery = assembleQuery(result.queryTerms);
    }
    if (result.lookbackQueryTerms && Array.isArray(result.lookbackQueryTerms)) {
      result.lookbackQuery = assembleQuery(result.lookbackQueryTerms);
    } else {
      result.lookbackQueryTerms = null;
    }

    console.log(`[Result] valid: ${result.isValid}, seasonality: ${result.seasonality}, lookback: ${result.lookbackStartDate} → ${result.lookbackEndDate}`);
    console.log(`[Result] queryTerms: ${result.queryTerms?.length ?? 0} terms → ${result.suggestedQuery?.substring(0, 120)}...`);
    if (result.lookbackQuery) {
      console.log(`[Result] lookbackTerms: ${result.lookbackQueryTerms?.length ?? 0} terms → ${result.lookbackQuery.substring(0, 120)}...`);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Keyword analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Keyword analysis failed' },
      { status: 500 }
    );
  }
}
