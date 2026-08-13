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
    const negationStr = negations.map(term => formatNegationTerm(term)).join(' ');
    return `${positiveQuery} ${negationStr}`;
  }

  return positiveQuery;
}

function formatNegationTerm(term: string): string {
  // Handle multi-word negations like -"war crimes"
  const inner = term.slice(1); // remove the leading -
  if (inner.startsWith('"') && inner.endsWith('"')) {
    return term; // already quoted, e.g. -"war crimes"
  }
  if (inner.includes(' ')) {
    return `-"${inner}"`;
  }
  return term;
}

/**
 * Exact-keywords mode: preserve AND/OR/parentheses and keyword text;
 * only fix syntax by quoting multi-word phrases that aren't already quoted.
 */
function normalizeExactQuery(input: string): string {
  const src = input.replace(/\s+/g, ' ').trim();
  if (!src) return '';

  const tokens: string[] = [];
  let i = 0;

  while (i < src.length) {
    if (src[i] === ' ') {
      i++;
      continue;
    }

    // Parentheses
    if (src[i] === '(' || src[i] === ')') {
      tokens.push(src[i]);
      i++;
      continue;
    }

    // Already-quoted phrase
    if (src[i] === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j++;
      tokens.push(src.slice(i, Math.min(j + 1, src.length)));
      i = j < src.length ? j + 1 : src.length;
      continue;
    }

    // Negation: -term or -"multi word"
    if (src[i] === '-' && i + 1 < src.length && src[i + 1] !== ' ') {
      if (src[i + 1] === '"') {
        let j = i + 2;
        while (j < src.length && src[j] !== '"') j++;
        tokens.push(src.slice(i, Math.min(j + 1, src.length)));
        i = j < src.length ? j + 1 : src.length;
      } else {
        let j = i + 1;
        while (j < src.length && src[j] !== ' ' && src[j] !== '(' && src[j] !== ')') j++;
        tokens.push(src.slice(i, j));
        i = j;
      }
      continue;
    }

    // AND / OR operators (case-insensitive)
    const andMatch = src.slice(i).match(/^AND\b/i);
    if (andMatch) {
      tokens.push('AND');
      i += andMatch[0].length;
      continue;
    }
    const orMatch = src.slice(i).match(/^OR\b/i);
    if (orMatch) {
      tokens.push('OR');
      i += orMatch[0].length;
      continue;
    }

    // Leaf term: consume until operator, paren, or quote boundary
    let j = i;
    while (j < src.length) {
      if (src[j] === '(' || src[j] === ')' || src[j] === '"') break;
      if (src[j] === ' ') {
        const rest = src.slice(j + 1);
        if (/^AND\b/i.test(rest) || /^OR\b/i.test(rest) || rest.startsWith('(') || rest.startsWith(')')) {
          break;
        }
      }
      j++;
    }
    const term = src.slice(i, j).trim();
    if (term) {
      if (term.includes(' ') && !term.startsWith('#')) {
        tokens.push(`"${term}"`);
      } else {
        tokens.push(term);
      }
    }
    i = j;
  }

  // Join with spaces; no space after '(' or before ')'
  let out = '';
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    const prev = tokens[t - 1];
    if (t === 0) {
      out = tok;
    } else if (tok === ')' || prev === '(') {
      out += tok;
    } else {
      out += ` ${tok}`;
    }
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { handle, keywords, rawKeywordInput, campaignStartDate, campaignEndDate, seasonalityOverride, useExactKeywords, includeNegations, keywordOperator } = body;

    if (!handle || !keywords?.length || !campaignStartDate || !campaignEndDate) {
      return NextResponse.json(
        { error: 'Missing required fields: handle, keywords, campaignStartDate, campaignEndDate' },
        { status: 400 }
      );
    }

    console.log(`\n=== /api/analyze-keywords ===`);
    console.log(`[Input] handle: @${handle}, keywords: [${keywords.join(', ')}], dates: ${campaignStartDate} → ${campaignEndDate}${seasonalityOverride ? `, seasonality override: ${seasonalityOverride}` : ''}${useExactKeywords ? ', exact keywords mode' : ''}`);

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
    if (useExactKeywords) {
      // Exact mode: keep user's AND/OR/parens; only fix quoting syntax
      const exactSource = (typeof rawKeywordInput === 'string' && rawKeywordInput.trim())
        ? rawKeywordInput
        : keywords.join(keywordOperator === 'AND' ? ' AND ' : ' OR ');
      let exactQuery = normalizeExactQuery(exactSource);

      // Opt-in brand-safety negations from Grok still append at the end
      if (includeNegations && result.queryTerms && Array.isArray(result.queryTerms)) {
        const existingLower = exactQuery.toLowerCase();
        const grokNegations = result.queryTerms
          .filter((t: string) => typeof t === 'string' && t.startsWith('-'))
          .map((t: string) => formatNegationTerm(t.trim()))
          .filter((t: string) => t && !existingLower.includes(t.toLowerCase()));
        if (grokNegations.length > 0) {
          exactQuery = `${exactQuery} ${grokNegations.join(' ')}`;
        }
      }

      result.suggestedQuery = exactQuery;
    } else if (result.queryTerms && Array.isArray(result.queryTerms)) {
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
    console.log(`[Result] queryTerms (${result.queryTerms?.length ?? 0}): ${JSON.stringify(result.queryTerms)}`);
    console.log(`[Result] assembledQuery: "${result.suggestedQuery}"`);
    if (result.lookbackQuery) {
      console.log(`[Result] lookbackTerms (${result.lookbackQueryTerms?.length ?? 0}): ${JSON.stringify(result.lookbackQueryTerms)}`);
      console.log(`[Result] assembledLookbackQuery: "${result.lookbackQuery}"`);
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
