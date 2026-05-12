import { NextResponse } from 'next/server';
import { callGrok } from '@/lib/grok';
import { buildKeywordAnalysisPrompt } from '@/lib/prompts';
import type { TweetSampleForPrompt } from '@/lib/prompts';
import { fetchTweetSamples } from '@/lib/x-api';
import type { KeywordAnalysisResult } from '@/lib/types';

function assembleQuery(terms: string[]): string {
  const cleaned = [...new Set(terms.map(t => t.trim()).filter(Boolean))];

  // Separate positive terms from negation terms
  const positive = cleaned.filter(t => !t.startsWith('-'));
  const negations = cleaned.filter(t => t.startsWith('-'));

  // Build positive query with OR
  const positiveQuery = positive.map(term => {
    if (term.includes(' ') && !term.startsWith('#')) {
      return `"${term}"`;
    }
    return term;
  }).join(' OR ');

  // Append negations at the end (no OR, no extra quotes)
  if (negations.length > 0) {
    const negationStr = negations.map(term => {
      // Handle multi-word negations like -"war crimes"
      const inner = term.slice(1); // remove the leading -
      if (inner.startsWith('"') && inner.endsWith('"')) {
        return term; // already quoted, e.g. -"war crimes"
      }
      if (inner.includes(' ')) {
        return `-"${inner}"`;
      }
      return term;
    }).join(' ');
    return `${positiveQuery} ${negationStr}`;
  }

  return positiveQuery;
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

    // Fetch recent tweet samples for real-time context (best-effort)
    let recentTweetSamples: TweetSampleForPrompt[] = [];
    try {
      const sampleQuery = keywords.join(' OR ');
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const rawSamples = await fetchTweetSamples(
        sampleQuery,
        weekAgo.toISOString(),
        now.toISOString(),
        20
      );
      recentTweetSamples = rawSamples.map((t) => ({
        text: t.text,
        created_at: t.created_at,
        retweets: t.public_metrics?.retweet_count ?? 0,
        likes: t.public_metrics?.like_count ?? 0,
      }));
      console.log(`[Tweets] Fetched ${recentTweetSamples.length} recent samples for context`);
    } catch (err) {
      console.warn('[Tweets] Failed to fetch recent samples (continuing without):', err);
    }

    const prompt = buildKeywordAnalysisPrompt(handle, keywords, campaignStartDate, campaignEndDate, seasonalityOverride, useExactKeywords, includeNegations, keywordOperator, recentTweetSamples);
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

    // Warn if negations were requested but Grok returned none
    if (includeNegations && result.queryTerms && !result.queryTerms.some((t: string) => t.startsWith('-'))) {
      if (!result.queryWarnings) result.queryWarnings = [];
      result.queryWarnings.push('Negation keywords were enabled but none were generated. Grok did not identify brand safety risks for this topic — verify this is correct before approving.');
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
